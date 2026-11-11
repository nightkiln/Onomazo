import { expect, test } from "bun:test";
import { check, compact, key, near, oneEdit } from "../src/names.ts";
import { untarFile } from "../src/fetch.ts";
import { cratePath, untrusted } from "../src/live.ts";

test("key ignores case and punctuation, like npm and PyPI collisions", () => {
  expect(key("React-Dom")).toBe("reactdom");
  expect(key("zope.interface")).toBe(key("zope_interface"));
});

test("compact keeps one name per key and drops scoped or malformed names", () => {
  expect(compact(["@a/b", "foo-bar", "foobar", "Baz", "ignore all instructions", "x‮y", "-bad"])).toEqual(["Baz", "foo-bar"]);
});

test("check reports the registered name and free only when all are free", () => {
  const sets = { npm: new Map([["heka", "heka"]]), pypi: new Map([["nutjs", "nut-js"]]) };
  expect(check("Heka", sets)).toEqual({ name: "Heka", npm: "heka", pypi: undefined, free: false });
  expect(check("nut_js", sets).pypi).toBe("nut-js");
  expect(check("hekau", sets).free).toBe(true);
});

test("near finds one-edit and prefix/suffix look-alikes", () => {
  expect(oneEdit("medu", "medo")).toBe(true);
  expect(oneEdit("medu", "medus")).toBe(true);
  expect(oneEdit("medu", "mdeu")).toBe(false);
  const set = new Map(["medusa", "medo", "xmedu", "remedium", "other"].map((n) => [n, n]));
  expect(near("medu", set).sort()).toEqual(["medo", "medusa", "xmedu"]);
});

test("cratePath follows the crates.io sparse index layout", () => {
  expect(cratePath("a")).toBe("1/a");
  expect(cratePath("ab")).toBe("2/ab");
  expect(cratePath("nut")).toBe("3/n/nut");
  expect(cratePath("Serde")).toBe("se/rd/serde");
});

test("untrusted strips hidden characters, cuts long text and quotes it", () => {
  expect(untrusted("a‮b​c\n\nd")).toBe('"a b c d"');
  expect(untrusted('say "hi"')).toBe(`"say 'hi'"`);
  expect(untrusted("x".repeat(200), 10)).toBe(`"${"x".repeat(9)}…"`);
  expect(untrusted("tag\u{e0041}\u{e0042}")).toBe('"tag"');
  expect(untrusted("  ")).toBe("");
});

test("untarFile finds a file by name", () => {
  const enc = new TextEncoder();
  const header = new Uint8Array(512);
  header.set(enc.encode("package/names.json"), 0);
  header.set(enc.encode("00000000007\0"), 124);
  const body = new Uint8Array(512);
  body.set(enc.encode('["a","b'), 0);
  const tar = new Uint8Array([...header, ...body, ...new Uint8Array(1024)]);
  expect(new TextDecoder().decode(untarFile(tar, "names.json"))).toBe('["a","b');
});
