// Live checks, for a shortlist only: crates.io, GitHub, and what taken names are about.

const UA = { "user-agent": "onomazo (name checker)" };

/**
 * Text from registries and GitHub is written by strangers and read by agents,
 * so it may carry injected instructions. Strip control, zero-width and
 * direction-changing characters, collapse whitespace, cut it short and quote
 * it, so it reads as data.
 */
export function untrusted(text: string, max = 140): string {
  const clean = text
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, " ")
    .replace(/[\u{e0000}-\u{e007f}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  const cut = clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
  return `"${cut.replace(/"/g, "'")}"`;
}

/** crates.io sparse index path: 1/a, 2/ab, 3/a/abc, ab/cd/abcd... */
export function cratePath(name: string): string {
  const n = name.toLowerCase();
  if (n.length <= 2) return `${n.length}/${n}`;
  if (n.length === 3) return `3/${n[0]}/${n}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n}`;
}

/** crates.io treats "-" and "_" as the same; checks both spellings of the plain name. */
export async function crateTaken(name: string): Promise<boolean> {
  const variants = [...new Set([name.toLowerCase(), name.toLowerCase().replace(/-/g, "_"), name.toLowerCase().replace(/_/g, "-")])];
  for (const v of variants) {
    const res = await fetch(`https://index.crates.io/${cratePath(v)}`, { headers: UA });
    if (res.ok) return true;
    if (res.status !== 404 && res.status !== 403) throw new Error(`crates.io ${v}: HTTP ${res.status}`);
  }
  return false;
}

export type GithubStatus = { account: boolean; repos: number; topRepo?: string; topStars?: number; topAbout?: string };

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { ...UA, accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

/** Whether a user or org owns the name, and how many repos are named exactly that (search API: ~10 calls a minute without a token). */
export async function githubStatus(name: string): Promise<GithubStatus> {
  const n = name.toLowerCase();
  const user = await fetch(`https://api.github.com/users/${n}`, { headers: ghHeaders() });
  const q = encodeURIComponent(`${n} in:name`);
  const res = await fetch(`https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=100`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub search for ${n}: HTTP ${res.status}`);
  const body = (await res.json()) as { items: { name: string; full_name: string; stargazers_count: number; description: string | null }[] };
  const exact = body.items.filter((r) => r.name.toLowerCase() === n);
  const top = exact[0];
  return { account: user.status === 200, repos: exact.length, topRepo: top?.full_name, topStars: top?.stargazers_count, topAbout: top?.description ? untrusted(top.description) : undefined };
}

/** One line on what a registered package is, so an agent can judge whether it sits in the same field. */
export async function about(registry: "npm" | "pypi", name: string): Promise<string> {
  try {
    if (registry === "npm") {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, { headers: UA });
      if (!res.ok) return "";
      const j = (await res.json()) as { description?: string; version?: string };
      return [untrusted(j.description ?? ""), j.version && untrusted(`v${j.version}`, 30)].filter(Boolean).join(" ");
    }
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, { headers: UA });
    if (!res.ok) return "";
    const j = (await res.json()) as { info: { summary?: string; version?: string } };
    return [untrusted(j.info.summary ?? ""), j.info.version && untrusted(`v${j.info.version}`, 30)].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}
