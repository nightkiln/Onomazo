// Downloads the npm and PyPI name lists once (about 65 MB, seconds), straight
// from the official registries. They are used only as plain name strings.
import { mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dataDir, listPath, compact } from "./names.ts";

const NPM_META = "https://registry.npmjs.org/all-the-package-names/latest";
const PYPI_INDEX = "https://pypi.org/simple/";

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

export async function fetchAll(log: (s: string) => void): Promise<void> {
  mkdirSync(dataDir(), { recursive: true });
  const [npm, pypi] = await Promise.all([fetchNpm(), fetchPypi()]);
  log(`npm: ${npm} names
pypi: ${pypi} names
saved in ${dataDir()}`);
}
