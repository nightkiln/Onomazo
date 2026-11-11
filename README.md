# Onomazo: find free short names

Onomazo (Greek "I name") starts from a meaning and finds short names that are
free on npm, PyPI, crates.io and GitHub. Other name checkers test a name you
already have; this one finds candidates, checks them offline in bulk, warns
about look-alikes and tells you what those look-alikes are, so an agent can
judge whether they sit in the same field. `SKILL.md` makes the folder an
agent skill.

## How it works

1. `fetch` downloads once (about 65 MB, a few seconds) into
   `~/.cache/onomazo` (set `ONOMAZO_DATA` to move it):
   every unscoped npm name (`all-the-package-names`), the PyPI simple index,
   Whitaker's Words (Latin, 39k entries with English meanings and frequency)
   and Strong's Greek dictionary (5k words, transliterated). `fetch --lsj`
   adds the full Liddell-Scott-Jones Greek lexicon (about 280 MB download).
   An Egyptian list is read from `data/egyptian.tsv` if you add one
   (columns: word, `egy`, part of speech, frequency, meaning); none ships here.
2. `words` searches the meanings and keeps words free on npm and PyPI.
3. `check` looks names up offline. Names are compared lowercase with `-`,
   `_` and `.` removed, because npm refuses names that differ only by
   punctuation and PyPI treats them as equal. `--near` lists taken names one
   letter away or with up to two letters added (medu next to medusa).
4. `check --live`, for a shortlist: crates.io, whether a GitHub account owns
   the name, repos named exactly that, and the description of every taken
   name and the closest look-alikes. Set `GITHUB_TOKEN` (for example
   `GITHUB_TOKEN=$(gh auth token)`) for a higher GitHub rate limit.

## Commands

```sh
bun src/cli.ts fetch                                   # add --lsj for full Greek
bun src/cli.ts words nod command choose spell           # all languages, 4-6 letters
bun src/cli.ts words choose --lang la --max 8 --all     # include taken ones
bun src/cli.ts check hekau setep --near
bun src/cli.ts check hekau setep --live
echo "hekau setep wedj" | bun src/cli.ts check          # names from stdin
bun test tests
```

Runs on Node 22 too: `node --experimental-strip-types src/cli.ts ...`.
No packages.

## Sources and licences

The Latin and Greek lists come from small third-party repositories. They
are pinned to a reviewed commit, Whitaker's and Strong's also to a SHA-256,
and are only parsed as data, never run. The npm and PyPI lists change daily,
so they cannot be hashed; they come from the official registries and are
used only as plain name strings.

| List | Source | Licence |
|---|---|---|
| npm names | npm package `all-the-package-names` | MIT |
| PyPI names | pypi.org/simple (JSON) | public index |
| Latin | Whitaker's Words, github.com/mk270/whitakers-words | free use with credit |
| Greek | Strong's (github.com/morphgnt/strongs-dictionary-xml); LSJ (github.com/PerseusDL/lexica) | public domain; CC BY-SA 4.0 |

Wiktionary extracts (kaikki.org) would give far bigger Greek and Egyptian
lists, but this environment's network blocks them; add them to `fetch.ts`
where the host is reachable.

## Files

| File | Does |
|---|---|
| `src/fetch.ts` | Downloads and compacts the lists |
| `src/names.ts` | Name keys, offline check, look-alikes |
| `src/words.ts` | Word list format and meaning search |
| `src/latin.ts`, `src/greek.ts` | Parse Whitaker's Words, Strong's and LSJ |
| `src/live.ts` | crates.io, GitHub and package descriptions |
| `src/cli.ts` | The commands above |
| `SKILL.md` | How an agent should drive it |
