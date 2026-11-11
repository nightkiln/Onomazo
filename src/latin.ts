// Latin from Whitaker's Words (DICTLINE.GEN): stems plus codes, turned into dictionary forms.
import type { Word } from "./words.ts";

/** Best-effort dictionary form from stem 1 and the declension or conjugation code. */
export function lemma(stem: string, pos: string, a: string, b: string, kind: string): string {
  if (stem === "zzz") return "";
  switch (pos) {
    case "N":
      if (a === "1") return stem + "a";
      if (a === "2") {
        if (b === "2" || (b === "4" && kind === "N")) return stem + "um";
        if (b === "3") return stem;
        return stem + "us";
      }
      if (a === "4") return stem + (b === "2" ? "u" : "us");
      if (a === "5") return stem + "es";
      return stem; // 3rd declension: stem 1 is the nominative
    case "V":
      if (kind === "DEP") return stem + (a === "2" ? "eor" : a === "4" ? "ior" : "or");
      if (a === "2") return stem + "eo";
      if (a === "4" || (a === "3" && b === "4")) return stem + "io";
      return stem + "o";
    case "ADJ":
      if (a === "1" && b === "1") return stem + "us";
      if (a === "3" && b === "2") return stem + "is";
      return stem;
    default:
      return stem;
  }
}

/** Columns: 76 stem chars, 24 chars of part of speech and codes, 5 flags (age, area, geo, frequency, source), meaning. */
export function parseDictline(text: string): Word[] {
  const out: Word[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.length < 110) continue;
    const stem = line.slice(0, 19).trim();
    const codes = line.slice(76, 100).trim().split(/\s+/);
    const flags = line.slice(100, 109);
    if (!/^[A-Z] [A-Z] [A-Z] [A-Z] [A-Z]$/.test(flags)) continue;
    const [pos = "", a = "", b = "", kind = ""] = codes;
    if (pos === "PACK" || pos === "NUM" || pos === "PRON") continue;
    const word = lemma(stem, pos, a, b, kind).toLowerCase();
    if (!/^[a-z]+$/.test(word)) continue;
    out.push({ word, lang: "la", pos, freq: flags[6] ?? "X", meaning: line.slice(110).trim() });
  }
  return out;
}
