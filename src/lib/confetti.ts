import confetti from "canvas-confetti";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function burstConfetti(): void {
  if (typeof window === "undefined") return;

  const reduced = prefersReducedMotion();
  const particleCount = reduced ? 60 : 160;

  confetti({
    particleCount: Math.floor(particleCount * 0.6),
    spread: 70,
    startVelocity: 45,
    scalar: 1.05,
    origin: { x: 0.5, y: 0.7 },
  });

  if (reduced) return;

  window.setTimeout(() => {
    confetti({
      particleCount: Math.floor(particleCount * 0.2),
      spread: 100,
      startVelocity: 55,
      scalar: 1.1,
      origin: { x: 0.2, y: 0.7 },
    });

    confetti({
      particleCount: Math.floor(particleCount * 0.2),
      spread: 100,
      startVelocity: 55,
      scalar: 1.1,
      origin: { x: 0.8, y: 0.7 },
    });
  }, 120);
}

