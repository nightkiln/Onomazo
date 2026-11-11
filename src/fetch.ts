// Downloads the lists once (about 65 MB, seconds). `fetch --lsj` adds the full Greek lexicon (about 280 MB).
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dataDir, listPath, compact } from "./names.ts";
import { parseDictline } from "./latin.ts";
import { parseLsj, parseStrongs } from "./greek.ts";
import { toTsv, wordFile, type Word } from "./words.ts";

const NPM_META = "https://registry.npmjs.org/all-the-package-names/latest";
const PYPI_INDEX = "https://pypi.org/simple/";
// Word lists come from small third-party repositories, so they are pinned to a
// reviewed commit and, where practical, a SHA-256: a later upstream change
// cannot slip in unnoticed. They are only ever parsed as data, never run.
// To update: review the new commit, then change the commit and hash here.
const WHITAKER = {
  url: "https://raw.githubusercontent.com/mk270/whitakers-words/fb7fb6f04c0c05b68d496a521d8c32abe823e57b/DICTLINE.GEN",
  sha256: "8f6c0fc84d12859abc863eac84ddd49b7e039503855ca34c1d44a6e78abf7569",
};
const STRONGS = {
  url: "https://raw.githubusercontent.com/morphgnt/strongs-dictionary-xml/dd6758b82f46b620804a8ea677d715844679eea1/strongsgreek.xml",
  sha256: "91474213b208a4e487d35f85c10e5c90737acc69082dad15dec5431406003545",
};
const LSJ = (i: number) =>
  `https://raw.githubusercontent.com/PerseusDL/lexica/1c34cdf756c63cf37db61bd366d733431dbd7aa0/CTS_XML_TEI/perseus/pdllex/grc/lsj/grc.lsj.perseus-eng${i}.xml`;

/** Downloads text and refuses it if its SHA-256 differs from the pinned one. */
export async function getPinned(src: { url: string; sha256: string }): Promise<string> {
  const bytes = new Uint8Array(await (await get(src.url)).arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== src.sha256) throw new Error(`${src.url}: SHA-256 ${actual} does not match pinned ${src.sha256}; not used.`);
  return new TextDecoder().decode(bytes);
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": "onomazo", ...headers } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

/** Reads one file out of a tar archive (512-byte headers, size in octal at offset 124). */
export function untarFile(tar: Uint8Array, wanted: string): Uint8Array {
  const dec = new TextDecoder();
  let off = 0;
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512);
    const name = dec.decode(header.subarray(0, 100)).replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(dec.decode(header.subarray(124, 136)).replace(/\0.*$/s, "").trim() || "0", 8);
    const body = off + 512;
    if (name === wanted || name.endsWith("/" + wanted)) return tar.subarray(body, body + size);
    off = body + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${wanted} not found in archive`);
}

async function fetchNpm(): Promise<number> {
  const meta = (await (await get(NPM_META)).json()) as { dist: { tarball: string } };
  const tgz = new Uint8Array(await (await get(meta.dist.tarball)).arrayBuffer());
  const names = compact(JSON.parse(new TextDecoder().decode(untarFile(gunzipSync(tgz), "names.json"))) as string[]);
  writeFileSync(listPath("npm"), names.join("\n") + "\n");
  return names.length;
}

async function fetchPypi(): Promise<number> {
  const body = (await (await get(PYPI_INDEX, { accept: "application/vnd.pypi.simple.v1+json" })).json()) as { projects: { name: string }[] };
  const names = compact(body.projects.map((p) => p.name));
  writeFileSync(listPath("pypi"), names.join("\n") + "\n");
  return names.length;
}

async function fetchLatin(): Promise<number> {
  const words = parseDictline(await getPinned(WHITAKER));
  writeFileSync(wordFile("la"), toTsv(words));
  return words.length;
}

async function fetchGreek(lsj: boolean): Promise<number> {
  const words: Word[] = parseStrongs(await getPinned(STRONGS));
  if (lsj) {
    const parts = await Promise.all(Array.from({ length: 27 }, (_, i) => get(LSJ(i + 1)).then((r) => r.text())));
    for (const xml of parts) words.push(...parseLsj(xml));
  }
  writeFileSync(wordFile("grc"), toTsv(words));
  return words.length;
}

export async function fetchAll(opts: { lsj: boolean }, log: (s: string) => void): Promise<void> {
  mkdirSync(dataDir(), { recursive: true });
  const [npm, pypi, latin, greek] = await Promise.all([fetchNpm(), fetchPypi(), fetchLatin(), fetchGreek(opts.lsj)]);
  log(`npm: ${npm} names\npypi: ${pypi} names\nlatin: ${latin} words\ngreek: ${greek} words${opts.lsj ? " (Strong's + LSJ)" : " (Strong's; add --lsj for the full lexicon)"}\nsaved in ${dataDir()}`);
}
