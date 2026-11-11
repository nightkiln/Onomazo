# Onomazo: check whether a short name is free

Onomazo (Greek "I name") checks candidate names against npm, PyPI,
crates.io and GitHub, and warns about taken look-alikes. It does not suggest
names: the agent or person using it does, from their own knowledge.
`SKILL.md` makes the folder an agent skill.

## Safety by design

- **No third-party text in the search.** Earlier versions searched outside
  dictionaries; they were removed because any text an agent reads can try to
  instruct it. Candidates come from the agent's own knowledge.
- **Name lists only from the official registries**: the npm package
  `all-the-package-names` and pypi.org/simple. Names are kept only if they use
  registry characters (`A-Z a-z 0-9 . _ -`); anything else is dropped, never
  shown. Nothing downloaded is ever run.
- **Live descriptions are quoted data.** `check --live` shows what taken
  names are about. That text is written by strangers, so hidden and
  direction-changing characters are stripped, it is shortened and quoted, and
  `SKILL.md` tells agents never to follow instructions in it.
- **No packages at run time.** Development needs only `@types/bun`; install
  it with `bun install --ignore-scripts`.

## How it works

1. `fetch` downloads both name lists once (about 65 MB, a few seconds) into
   `~/.cache/onomazo` (set `ONOMAZO_DATA` to move it). Rerun to refresh.
2. `check` looks names up offline. Names are compared lowercase with `-`,
   `_` and `.` removed, because npm refuses names that differ only by
   punctuation and PyPI treats them as equal. `--near` lists taken names one
   letter away or with up to two letters added (medu next to medusa).
3. `check --live`, for a shortlist: crates.io, whether a GitHub account owns
   the name, repos named exactly that, and the quoted description of each
   taken name and the closest look-alikes. Set `GITHUB_TOKEN` for a higher
   GitHub rate limit.

## Commands

```sh
bun src/cli.ts fetch
bun src/cli.ts check hekau setep --near
bun src/cli.ts check hekau setep --live
echo "hekau setep wedj" | bun src/cli.ts check     # names from stdin
bun test tests
```

Runs on Node 22 too: `node --experimental-strip-types src/cli.ts ...`.

## Files

| File | Does |
|---|---|
| `src/fetch.ts` | Downloads and compacts the name lists |
| `src/names.ts` | Name keys, offline check, look-alikes |
| `src/live.ts` | crates.io, GitHub, quoted package descriptions |
| `src/cli.ts` | The commands above |
| `SKILL.md` | How an agent should drive it |
