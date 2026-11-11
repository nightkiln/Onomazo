// Ancient Greek, transliterated: Strong's Greek dictionary (small, default) and LSJ (large, opt-in).
import type { Word } from "./words.ts";
import { plain } from "./words.ts";

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Strong's: one <entry> per word with translit, a definition and the KJV renderings. Proper names skipped. */
export function parseStrongs(xml: string): Word[] {
  const out: Word[] = [];
  for (const m of xml.matchAll(/<entry strongs="\d+">([\s\S]*?)<\/entry>/g)) {
    const body = m[1] ?? "";
    const tr = body.match(/translit="([^"]+)"/)?.[1];
    if (!tr || /^\p{Lu}/u.test(tr)) continue;
    const word = plain(tr);
    if (!word) continue;
    const def = strip(body.match(/<strongs_def>([\s\S]*?)<\/strongs_def>/)?.[1] ?? "");
    const kjv = strip(body.match(/<kjv_def>([\s\S]*?)<\/kjv_def>/)?.[1] ?? "").replace(/^:--/, "");
    out.push({ word, lang: "grc", pos: "", freq: "X", meaning: [def, kjv && `(KJV: ${kjv})`].filter(Boolean).join(" ") });
  }
  return out;
}

const BETA: Record<string, string> = {
  a: "a", b: "b", g: "g", d: "d", e: "e", z: "z", h: "e", q: "th", i: "i", k: "k", l: "l", m: "m",
  n: "n", c: "x", o: "o", p: "p", r: "r", s: "s", j: "s", t: "t", u: "y", f: "ph", x: "ch", y: "ps", w: "o", v: "w",
};

/** Beta Code to plain Latin letters: rough breathing becomes a leading h, gamma before g/k/x/c becomes n. */
export function betaToLatin(beta: string): string {
  const b = beta.toLowerCase().replace(/\d+$/, "");
  const rough = /^\*?\(?[aeiouhwr]{0,2}[\/\\=|]*\(/.test(b);
  const letters = b.replace(/[^a-z]/g, "");
  let out = "";
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!;
    const next = letters[i + 1] ?? "";
    out += ch === "g" && "gkxc".includes(next) ? "n" : (BETA[ch] ?? "");
  }
  if (rough && /^[aeiouyr]/.test(out)) out = out.startsWith("r") ? "rh" + out.slice(1) : "h" + out;
  // "ou" is the usual spelling of omicron-upsilon, and "y" after a vowel is "u" (au, eu).
  return out.replace(/oy/g, "ou").replace(/([aeo])y/g, "$1u");
}

/** LSJ (Perseus TEI): headword key in Beta Code, English glosses in <tr> elements. */
export function parseLsj(xml: string): Word[] {
  const out: Word[] = [];
  for (const m of xml.matchAll(/<entryFree[^>]*?key="([^"]+)"[^>]*>([\s\S]*?)<\/entryFree>/g)) {
    const key = m[1] ?? "";
    if (key.startsWith("*") || key.startsWith("-")) continue; // proper names, suffixes
    const word = betaToLatin(key);
    if (!word) continue;
    const trs = [...(m[2] ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((t) => strip(t[1] ?? "").replace(/[,;:.]$/, ""));
    if (!trs.length) continue;
    out.push({ word, lang: "grc", pos: "", freq: "X", meaning: [...new Set(trs)].slice(0, 8).join("; ") });
  }
  return out;
}
