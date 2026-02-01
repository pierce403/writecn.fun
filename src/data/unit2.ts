export type Word = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
};

// Unit 2 Literacy assessment: items marked with (W) need writing practice.
export const UNIT2_WRITE_WORDS: Word[] = [
  { id: "xi-west", hanzi: "西", pinyin: "xī", english: "west" },
  { id: "jia-home", hanzi: "家", pinyin: "jiā", english: "home" },
  { id: "wo-i", hanzi: "我", pinyin: "wǒ", english: "I" },
  { id: "de-of", hanzi: "的", pinyin: "de", english: "of / 's" },
  { id: "nv-woman", hanzi: "女", pinyin: "nǚ", english: "woman" },
  { id: "kou-mouth", hanzi: "口", pinyin: "kǒu", english: "mouth" },
  { id: "qu-go", hanzi: "去", pinyin: "qù", english: "go" },
  { id: "zi-child", hanzi: "子", pinyin: "zǐ", english: "child (depends on context)" },
  { id: "zhi-only", hanzi: "只", pinyin: "zhǐ", english: "only / measure word" },
  { id: "chang-long", hanzi: "长", pinyin: "cháng", english: "long" },
  { id: "fang-square", hanzi: "方", pinyin: "fāng", english: "square" },
  { id: "zai-at", hanzi: "在", pinyin: "zài", english: "at" },
  { id: "le-already", hanzi: "了", pinyin: "le", english: "already" },
];

