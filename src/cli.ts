// Onomazo: find short names that are free on npm and PyPI (and crates.io, GitHub).
//   fetch [--lsj]                  download the name lists and word lists (once; --lsj adds the full Greek lexicon)
//   words <english...> [--lang la,grc,egy] [--min 4] [--max 6] [--all] [--limit 40]
//                                  words whose meaning mentions the terms; free on npm and PyPI unless --all
//   check <name...> [--near] [--live]
//                                  offline check (names from stdin if none); --near lists taken look-alikes;
//                                  --live adds crates.io, GitHub and what each taken name is about
import { readFileSync } from "node:fs";
import { fetchAll } from "./fetch.ts";
import { check, near, taken, type Registry } from "./names.ts";
import { LANGS, loadWords, search, type Lang } from "./words.ts";
import { about, crateTaken, githubStatus } from "./live.ts";

const VALUED = ["min", "max", "pos", "limit", "lang"];

function flags(args: string[]) {
  const rest: string[] = [];
  const opts: Record<string, string | true> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (!a.startsWith("--")) { rest.push(a); continue; }
    const k = a.slice(2);
    const v = args[i + 1];
    if (VALUED.includes(k) && v !== undefined) { opts[k] = v; i++; }
    else opts[k] = true;
  }
  return { rest, opts };
}

const sets = () => ({ npm: taken("npm"), pypi: taken("pypi") });
const show = (name: string, registered?: string) =>
  !registered ? "free" : registered.toLowerCase() === name.toLowerCase() ? "taken" : `taken (as ${registered})`;

async function checkOne(n: string, opts: Record<string, string | true>, s: ReturnType<typeof sets>): Promise<string[]> {
  const r = check(n, s);
  const lines = [`${n}: npm ${show(n, r.npm)}, pypi ${show(n, r.pypi)}`];
  if (opts.live) {
    const [crate, gh] = await Promise.all([crateTaken(n), githubStatus(n)]);
    lines[0] += `, crates ${crate ? "taken" : "free"}`;
    let g = `  github: account ${gh.account ? "taken" : "free"}, ${gh.repos} repos named ${n}`;
    if (gh.topRepo) g += `; top ${gh.topRepo} (${gh.topStars} stars)${gh.topAbout ? `: ${gh.topAbout}` : ""}`;
    lines.push(g);
    for (const reg of ["npm", "pypi"] as Registry[]) {
      const registered = r[reg];
      if (registered) lines.push(`  ${reg} ${registered}: ${(await about(reg, registered)) || "(no description)"}`);
    }
  }
  if (opts.near || opts.live) {
    for (const reg of ["npm", "pypi"] as Registry[]) {
      const close = near(n, s[reg]);
      if (!close.length) continue;
      lines.push(`  near on ${reg}: ${close.join(", ")}`);
      if (opts.live) {
        const ds = await Promise.all(close.slice(0, 4).map((c) => about(reg, c)));
        close.slice(0, 4).forEach((c, i) => ds[i] && lines.push(`    ${c}: ${ds[i]}`));
      }
    }
  }
  return lines;
}

async function main(argv: string[]) {
  const [cmd, ...args] = argv;
  const { rest, opts } = flags(args);
  if (cmd === "fetch") return fetchAll({ lsj: !!opts.lsj }, console.log);
  if (cmd === "check") {
    const names = rest.length ? rest : readFileSync(0, "utf8").split(/\s+/).filter(Boolean);
    const s = sets();
    for (const n of names) console.log((await checkOne(n, opts, s)).join("\n"));
    return;
  }
  if (cmd === "words" || cmd === "latin") {
    const langs = (typeof opts.lang === "string" ? opts.lang.split(",") : cmd === "latin" ? ["la"] : Object.keys(LANGS)) as Lang[];
    const found = search(loadWords(langs), rest, {
      min: Number(opts.min ?? 4),
      max: Number(opts.max ?? 6),
      pos: typeof opts.pos === "string" ? opts.pos.split(",") : undefined,
    });
    const s = sets();
    const limit = Number(opts.limit ?? 40);
    const printed = new Set<string>();
    for (const w of found) {
      const r = check(w.word, s);
      if (!opts.all && !r.free) continue;
      if (printed.has(w.word)) continue;
      printed.add(w.word);
      const status = opts.all ? `  [npm ${r.npm ? "taken" : "free"}, pypi ${r.pypi ? "taken" : "free"}]` : "";
      console.log(`${w.word.padEnd(8)} ${w.lang.padEnd(3)} ${(w.pos || "-").padEnd(4)} ${w.freq}  ${w.meaning.slice(0, 110)}${status}`);
      if (printed.size >= limit) break;
    }
    return;
  }
  const own = readFileSync(new URL(import.meta.url), "utf8").split("\n");
  console.log(own.slice(0, own.findIndex((l) => !l.startsWith("//"))).join("\n").replace(/^\/\/ ?/gm, ""));
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
