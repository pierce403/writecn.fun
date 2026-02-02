import HanziWriter, { type StrokeData } from "hanzi-writer";
import { useEffect, useMemo, useRef, useState } from "react";
import { UNIT2_WRITE_WORDS, type Word } from "./data/unit2";
import { burstConfetti } from "./lib/confetti";
import { shuffleInPlace } from "./lib/random";
import { playDing, playPop, playTada } from "./lib/sfx";
import { speakChineseSequence, stopSpeech } from "./lib/speech";

const AUDIO_STORAGE_KEY = "writecn.audioEnabled";

const PROMPT_ZH = "这个字怎么写？";
const STREAK_MILESTONE = 10;
const NEXT_DELAY_MS = 900;
const FLASH_DURATION_MS = 650;

function loadStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "true";
  } catch {
    return fallback;
  }
}

function storeBool(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeDeck(previousWordId: string | null): string[] {
  const ids = UNIT2_WRITE_WORDS.map((word) => word.id);
  shuffleInPlace(ids);

  if (previousWordId && ids.length > 1 && ids[ids.length - 1] === previousWordId) {
    [ids[ids.length - 1], ids[ids.length - 2]] = [ids[ids.length - 2], ids[ids.length - 1]];
  }

  return ids;
}

function computeTotalStrokesFallback(strokeData: StrokeData): number {
  return Math.max(1, strokeData.strokeNum + strokeData.strokesRemaining + 1);
}

export default function App() {
  const wordsById = useMemo<Record<string, Word>>(
    () => Object.fromEntries(UNIT2_WRITE_WORDS.map((word) => [word.id, word])) as Record<string, Word>,
    [],
  );

  const [started, setStarted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(() => loadStoredBool(AUDIO_STORAGE_KEY, true));

  const audioEnabledRef = useRef(audioEnabled);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const [word, setWord] = useState<Word | null>(null);
  const [quizKey, setQuizKey] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState<number | null>(null);
  const [strokeProgress, setStrokeProgress] = useState<{ done: number; total: number } | null>(null);
  const [mistakePulse, setMistakePulse] = useState<{ token: number; strokeNum: number } | null>(null);

  const [correctCount, setCorrectCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [streakFlash, setStreakFlash] = useState<{ token: number; value: number } | null>(null);

  const deckRef = useRef<string[]>([]);
  const lastWordIdRef = useRef<string | null>(null);
  const nextTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutsRef = useRef<number[]>([]);
  const lastCelebratedStreakRef = useRef<number>(0);
  const hadMistakeThisWordRef = useRef<boolean>(false);
  const streakRef = useRef<number>(0);
  const flashTokenRef = useRef<number>(0);
  const mistakeTokenRef = useRef<number>(0);
  const totalStrokesRef = useRef<number | null>(null);

  const writerRef = useRef<HanziWriter | null>(null);
  const nextStrokeNumRef = useRef<number>(0);
  const [boardEl, setBoardEl] = useState<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState(0);

  function clearNextTimeout(): void {
    if (nextTimeoutRef.current === null) return;
    window.clearTimeout(nextTimeoutRef.current);
    nextTimeoutRef.current = null;
  }

  function clearCelebrationTimeouts(): void {
    for (const timeoutId of celebrationTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    celebrationTimeoutsRef.current = [];
  }

  function flashStreak(value: number): void {
    flashTokenRef.current += 1;
    const token = flashTokenRef.current;
    setStreakFlash({ token, value });

    celebrationTimeoutsRef.current.push(
      window.setTimeout(() => {
        setStreakFlash((current) => (current?.token === token ? null : current));
      }, FLASH_DURATION_MS),
    );
  }

  function pulseMistake(strokeNum: number): void {
    mistakeTokenRef.current += 1;
    const token = mistakeTokenRef.current;
    setMistakePulse({ token, strokeNum });
    window.setTimeout(() => {
      setMistakePulse((current) => (current?.token === token ? null : current));
    }, 520);
  }

  function nextWord(): void {
    clearNextTimeout();
    clearCelebrationTimeouts();
    stopSpeech();
    hadMistakeThisWordRef.current = false;
    nextStrokeNumRef.current = 0;
    setTotalStrokes(null);
    setStrokeProgress(null);
    setMistakePulse(null);

    if (deckRef.current.length === 0) {
      deckRef.current = makeDeck(lastWordIdRef.current);
    }

    const nextId = deckRef.current.pop();
    if (!nextId) return;
    lastWordIdRef.current = nextId;
    const next = wordsById[nextId];
    if (!next) return;

    setWord(next);
    setQuizKey((key) => key + 1);
  }

  function start(): void {
    clearNextTimeout();
    clearCelebrationTimeouts();
    stopSpeech();

    setStarted(true);
    setCorrectCount(0);
    setMistakeCount(0);
    setStreak(0);
    setBestStreak(0);
    setStreakFlash(null);
    setTotalStrokes(null);
    setStrokeProgress(null);
    setMistakePulse(null);

    lastCelebratedStreakRef.current = 0;
    hadMistakeThisWordRef.current = false;
    lastWordIdRef.current = null;
    deckRef.current = makeDeck(null);
    nextWord();
  }

  function restart(): void {
    start();
  }

  function replayPrompt(): void {
    if (!word) return;
    if (!audioEnabledRef.current) return;
    stopSpeech();
    void speakChineseSequence([PROMPT_ZH, word.hanzi], { rate: 0.95 });
  }

  function hintStroke(): void {
    const writer = writerRef.current;
    if (!writer) return;
    void writer.highlightStroke(nextStrokeNumRef.current);
  }

  function skipStroke(): void {
    const writer = writerRef.current;
    if (!writer) return;
    hadMistakeThisWordRef.current = true;
    writer.skipQuizStroke();
  }

  function resetWord(): void {
    hadMistakeThisWordRef.current = true;
    setQuizKey((key) => key + 1);
  }

  useEffect(() => {
    storeBool(AUDIO_STORAGE_KEY, audioEnabled);
  }, [audioEnabled]);

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    totalStrokesRef.current = totalStrokes;
  }, [totalStrokes]);

  useEffect(() => {
    if (!boardEl) return;

    const update = () => {
      const rect = boardEl.getBoundingClientRect();
      const size = Math.floor(Math.min(rect.width, rect.height));
      setBoardSize(size);
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const ro = new ResizeObserver(() => update());
    ro.observe(boardEl);
    return () => ro.disconnect();
  }, [boardEl]);

  useEffect(() => {
    if (!started) return;
    if (!word) return;
    if (!audioEnabledRef.current) return;
    stopSpeech();
    void speakChineseSequence([PROMPT_ZH, word.hanzi], { rate: 0.95 });
  }, [started, word?.id]);

  useEffect(() => {
    if (!started) return;
    if (!word) return;
    if (boardSize <= 0) return;
    if (!boardEl) return;

    clearNextTimeout();
    writerRef.current?.cancelQuiz();
    writerRef.current = null;

    boardEl.innerHTML = "";

    const padding = clamp(Math.round(boardSize * 0.08), 10, 28);
    const writer = HanziWriter.create(boardEl, word.hanzi, {
      width: boardSize,
      height: boardSize,
      padding,
      showOutline: false,
      showCharacter: false,
      outlineColor: "rgba(148, 163, 184, 0.22)",
      strokeColor: "#cbd5e1",
      drawingColor: "#34d399",
      highlightColor: "rgba(56, 189, 248, 0.45)",
      highlightCompleteColor: "#fbbf24",
      drawingWidth: clamp(Math.round(boardSize * 0.012), 3, 8),
      strokeWidth: clamp(Math.round(boardSize * 0.007), 2, 6),
      outlineWidth: clamp(Math.round(boardSize * 0.006), 1, 5),
    });

    writerRef.current = writer;
    hadMistakeThisWordRef.current = false;
    nextStrokeNumRef.current = 0;
    setTotalStrokes(null);
    setStrokeProgress(null);
    setMistakePulse(null);

    let canceled = false;
    void writer
      .getCharacterData()
      .then((character) => {
        if (canceled) return;
        setTotalStrokes(character.strokes.length);
      })
      .catch(() => {
        // ignore
      });

    void writer.quiz({
      showHintAfterMisses: 1,
      acceptBackwardsStrokes: false,
      onMistake: (strokeData) => {
        hadMistakeThisWordRef.current = true;
        nextStrokeNumRef.current = strokeData.strokeNum;
        setMistakeCount((count) => count + 1);
        setStrokeProgress({
          done: strokeData.strokeNum,
          total: totalStrokesRef.current ?? computeTotalStrokesFallback(strokeData),
        });
        pulseMistake(strokeData.strokeNum);
        if (audioEnabledRef.current) playPop();
        if (strokeData.totalMistakes === 2) void writer.showOutline({ duration: 250 });
      },
      onCorrectStroke: (strokeData) => {
        nextStrokeNumRef.current = strokeData.strokeNum + 1;
        setStrokeProgress({
          done: strokeData.strokeNum + 1,
          total: totalStrokesRef.current ?? computeTotalStrokesFallback(strokeData),
        });
      },
      onComplete: ({ totalMistakes }) => {
        const didHaveMistake = hadMistakeThisWordRef.current || totalMistakes > 0;
        const nextStreak = didHaveMistake ? 0 : streakRef.current + 1;

        setCorrectCount((count) => count + 1);
        setStreak(nextStreak);
        setBestStreak((best) => Math.max(best, nextStreak));
        lastCelebratedStreakRef.current = didHaveMistake ? 0 : lastCelebratedStreakRef.current;

        if (audioEnabledRef.current) playDing();
        if (audioEnabledRef.current) void speakChineseSequence([word.hanzi], { rate: 0.95 });

        if (nextStreak > 0 && nextStreak % STREAK_MILESTONE === 0) {
          if (lastCelebratedStreakRef.current !== nextStreak) {
            lastCelebratedStreakRef.current = nextStreak;
            flashStreak(nextStreak);
            burstConfetti();
            if (audioEnabledRef.current) playTada();
          }
        }

        nextTimeoutRef.current = window.setTimeout(() => {
          nextWord();
        }, NEXT_DELAY_MS);
      },
    });

    return () => {
      canceled = true;
      writer.cancelQuiz();
    };
  }, [started, word?.id, boardSize, quizKey, boardEl]);

  useEffect(() => {
    return () => {
      clearNextTimeout();
      clearCelebrationTimeouts();
      stopSpeech();
      writerRef.current?.cancelQuiz();
    };
  }, []);

  const progressLabel =
    strokeProgress && strokeProgress.total > 0
      ? `${Math.min(strokeProgress.done, strokeProgress.total)} / ${strokeProgress.total} strokes`
      : null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center justify-center p-4 sm:p-6 [padding-top:calc(theme(spacing.4)+env(safe-area-inset-top))] [padding-bottom:calc(theme(spacing.4)+env(safe-area-inset-bottom))]">
        <div className="w-full rounded-3xl bg-slate-900/50 p-6 shadow-2xl ring-1 ring-slate-700/40 backdrop-blur sm:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">writecn.fun</h1>
              <p className="text-sm text-slate-300">Listen, then write the character with correct stroke order.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={restart}
                className="inline-flex touch-manipulation items-center rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-slate-700/40 hover:bg-slate-700"
              >
                Restart
              </button>
            </div>
          </header>

          {!started ? (
            <div className="mt-10 text-center">
              <div className="text-6xl font-semibold leading-none text-slate-200 sm:text-7xl">写字</div>

              <p className="mx-auto mt-4 max-w-md text-sm text-slate-300">
                You’ll hear a prompt. Draw the character in the box. If you miss, it will show stroke hints until you
                finish.
              </p>

              <button
                type="button"
                onClick={start}
                className="mt-8 inline-flex touch-manipulation items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                Start
              </button>

              <p className="mt-4 text-xs text-slate-400">
                Tip: browsers require a click before they’ll play speech audio.
              </p>
            </div>
          ) : word ? (
            <div className="mt-8">
              <div className="flex flex-col items-center text-center">
                <div className="text-sm font-medium uppercase tracking-wide text-slate-400">Write</div>
                <div className="mt-1 text-5xl font-semibold tracking-tight text-slate-100 sm:text-6xl">
                  {word.pinyin}
                </div>
                <div className="mt-2 text-sm text-slate-300">{word.english}</div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={replayPrompt}
                    disabled={!audioEnabled}
                    className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-slate-700/40 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Play audio
                  </button>

                  <button
                    type="button"
                    onClick={hintStroke}
                    className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-slate-700/40 hover:bg-slate-700"
                  >
                    Hint stroke
                  </button>

                  <button
                    type="button"
                    onClick={skipStroke}
                    className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-slate-700/40 hover:bg-slate-700"
                  >
                    Skip stroke
                  </button>

                  <button
                    type="button"
                    onClick={resetWord}
                    className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-slate-700/40 hover:bg-slate-700"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-4 flex min-h-10 flex-col items-center justify-center gap-1">
                  {progressLabel ? (
                    <div data-testid="stroke-progress" className="text-xs text-slate-400">
                      {progressLabel}
                    </div>
                  ) : (
                    <div className="h-4" aria-hidden="true" />
                  )}

                  {mistakePulse ? (
                    <div className="text-xs text-rose-300">Miss on stroke {mistakePulse.strokeNum + 1}</div>
                  ) : (
                    <div className="h-4" aria-hidden="true" />
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center">
                <div
                  data-testid="writing-board"
                  className="grid-board aspect-square w-full max-w-[380px] overflow-hidden rounded-3xl bg-slate-950/40 ring-1 ring-slate-700/40"
                >
                  <div
                    ref={setBoardEl}
                    data-testid="writing-target"
                    className="h-full w-full touch-none select-none"
                  />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-950/40 px-4 py-3 ring-1 ring-slate-700/30">
                  <div className="text-xs text-slate-400">Completed</div>
                  <div className="mt-1 text-lg font-semibold text-slate-100">{correctCount}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 px-4 py-3 ring-1 ring-slate-700/30">
                  <div className="text-xs text-slate-400">Mistakes</div>
                  <div data-testid="mistake-count" className="mt-1 text-lg font-semibold text-slate-100">
                    {mistakeCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 px-4 py-3 ring-1 ring-slate-700/30">
                  <div className="text-xs text-slate-400">Perfect streak</div>
                  <div className="mt-1 text-lg font-semibold text-slate-100">{streak}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 px-4 py-3 ring-1 ring-slate-700/30">
                  <div className="text-xs text-slate-400">Best</div>
                  <div className="mt-1 text-lg font-semibold text-slate-100">{bestStreak}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed z-50 flex flex-col gap-2 [right:calc(theme(spacing.4)+env(safe-area-inset-right))] [bottom:calc(theme(spacing.4)+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setAudioEnabled((value) => !value)}
          className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-slate-800/90 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg ring-1 ring-slate-700/40 backdrop-blur hover:bg-slate-700"
          aria-pressed={audioEnabled}
          title="Toggle audio"
        >
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              audioEnabled ? "bg-emerald-400" : "bg-slate-500",
            ].join(" ")}
            aria-hidden="true"
          />
          Audio {audioEnabled ? "On" : "Off"}
        </button>
      </div>

      {streakFlash ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div
            key={streakFlash.token}
            className="animate-[streak-flash_650ms_cubic-bezier(0.2,0.9,0.2,1)] rounded-3xl bg-slate-950/35 px-8 py-5 text-center shadow-2xl ring-1 ring-slate-200/10 backdrop-blur"
          >
            <div className="text-7xl font-extrabold tracking-tight text-amber-200">{streakFlash.value}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
