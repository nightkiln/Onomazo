// Word lists with English meanings, one shape for every language.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./names.ts";

export type Lang = "la" | "grc" | "egy";
export const LANGS: Record<Lang, string> = { la: "Latin", grc: "Greek", egy: "Egyptian" };

export type Word = {
  word: string;
  lang: Lang;
  pos: string;
  /** A very common .. F rare, I inscriptions, N names, X unknown. */
  freq: string;
  meaning: string;
};

const FREQ_RANK = "ABCDEFINX";
export function freqRank(f: string): number {
  const i = FREQ_RANK.indexOf(f);
  return i < 0 ? FREQ_RANK.length : i;
}

/** Plain ASCII letters for a transliteration: accents and macrons dropped (neúō -> neuo, ḥkꜣw -> hkaw). */
export function plain(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ꜣꜥ]/g, "a")
    .replace(/[ꜢꜤ]/g, "a")
    .replace(/ı͗|i͗|ỉ/g, "i")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function toTsv(words: Word[]): string {
  return words.map((w) => [w.word, w.lang, w.pos, w.freq, w.meaning.replace(/\s+/g, " ")].join("\t")).join("\n") + "\n";
}

export function fromTsv(text: string): Word[] {
  return text
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [word = "", lang = "la", pos = "", freq = "X", meaning = ""] = l.split("\t");
      return { word, lang: lang as Lang, pos, freq, meaning };
    });
}

/** Where each language's list lives. Egyptian ships with the tool; the rest are downloaded. */
export function wordFile(lang: Lang): string {
  if (lang === "egy") return new URL("../data/egyptian.tsv", import.meta.url).pathname;
  return join(dataDir(), lang === "la" ? "latin.tsv" : "greek.tsv");
}

export function loadWords(langs: Lang[]): Word[] {
  const out: Word[] = [];
  for (const l of langs) {
    const f = wordFile(l);
    if (existsSync(f)) out.push(...fromTsv(readFileSync(f, "utf8")));
  }
  return out;
}

export type SearchOptions = { min: number; max: number; pos?: string[] };
export type Hit = Word & { hits: number };

/**
 * Words whose meaning mentions any of the terms as a whole word (plain
 * endings allowed, so "choose" also finds "chooses" but "will" skips
 * "willow"). Ranked by how many terms match, then frequency, then length.
 */
export function search(words: Word[], terms: string[], opts: SearchOptions): Hit[] {
  const res = terms.map(
    (t) => new RegExp(`\\b${t.toLowerCase().replace(/[^a-z]/g, "")}(?:e|s|es|ed|d|ing|er|ers)?\\b`, "i"),
  );
  const seen = new Map<string, Hit>();
  for (const w of words) {
    if (w.word.length < opts.min || w.word.length > opts.max) continue;
    if (opts.pos && !opts.pos.includes(w.pos)) continue;
    const hits = res.filter((r) => r.test(w.meaning)).length;
    if (!hits) continue;
    const id = `${w.lang}:${w.word}`;
    const prev = seen.get(id);
    if (!prev || hits > prev.hits || (hits === prev.hits && freqRank(w.freq) < freqRank(prev.freq))) {
      seen.set(id, { ...w, hits });
    }
  }
  return [...seen.values()].sort(
    (x, y) => y.hits - x.hits || freqRank(x.freq) - freqRank(y.freq) || x.word.length - y.word.length,
  );
}
