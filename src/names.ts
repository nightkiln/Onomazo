// Registry name lists: normalising, loading and checking names offline.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where downloaded lists live. Override with ONOMAZO_DATA. */
export function dataDir(): string {
  return process.env.ONOMAZO_DATA ?? join(homedir(), ".cache", "onomazo");
}

/**
 * The key two names collide on. npm refuses a new name that differs from an
 * existing one only by punctuation ("react-dom" vs "reactdom"), and PyPI
 * treats runs of "-", "_" and "." as equal, so the strict common key is the
 * lowercase name with all three removed.
 */
export function key(name: string): string {
  return name.toLowerCase().replace(/[-._]/g, "");
}

export type Registry = "npm" | "pypi";
export const REGISTRIES: Registry[] = ["npm", "pypi"];

export function listPath(registry: Registry): string {
  return join(dataDir(), `${registry}.txt`);
}

/** Taken names: key -> the name as registered. */
export type Taken = Map<string, string>;

const cache = new Map<Registry, Taken>();

export function taken(registry: Registry): Taken {
  let map = cache.get(registry);
  if (map) return map;
  const path = listPath(registry);
  if (!existsSync(path)) throw new Error(`No ${registry} list at ${path}. Run: bun src/cli.ts fetch`);
  map = new Map();
  for (const n of readFileSync(path, "utf8").split("\n")) if (n && !map.has(key(n))) map.set(key(n), n);
  cache.set(registry, map);
  return map;
}

/** Raw registry names to a sorted list with one name per key. Scoped npm names are skipped. */
export function compact(names: Iterable<string>): string[] {
  const out = new Map<string, string>();
  for (const n of names) {
    if (!n || n.startsWith("@")) continue;
    const k = key(n);
    if (!out.has(k)) out.set(k, n);
  }
  return [...out.values()].sort();
}

export type Status = { name: string; npm?: string; pypi?: string; free: boolean };

/** Offline check. npm/pypi hold the colliding registered name when taken. */
export function check(name: string, sets: Record<Registry, Taken>): Status {
  const k = key(name);
  const npm = sets.npm.get(k);
  const pypi = sets.pypi.get(k);
  return { name, npm, pypi, free: !npm && !pypi };
}

/** True when a and b differ by one insert, delete or substitution. */
export function oneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * Taken names a person could confuse with this one: one edit away, or the
 * name plus up to two letters in front of or after it (medu -> medusa).
 * Returns registered names.
 */
export function near(name: string, set: Taken, limit = 8): string[] {
  const k = key(name);
  const out: string[] = [];
  for (const [t, original] of set) {
    if (t === k || t.length > k.length + 2 || t.length < k.length - 1) continue;
    if (oneEdit(k, t) || ((t.startsWith(k) || t.endsWith(k)) && t.length > k.length)) {
      out.push(original);
      if (out.length >= limit) break;
    }
  }
  return out;
}
