import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  countStringFields,
  hashRef,
  redact,
  scanPii,
  scanText,
} from "../../packages/core/src/index.ts";

test("scanText detects an email", () => {
  const m = scanText("reach me at pat.sample@example.test please");
  assert.ok(m.some((x) => x.kind === "email"));
});

test("scanText detects a phone number", () => {
  const m = scanText("call +1-555-0142 after noon");
  assert.ok(m.some((x) => x.kind === "phone"));
});

test("scanText detects a secret token", () => {
  const m = scanText("token sk-TESTONLYabcdefghijklmnopqrstuvwx");
  assert.ok(m.some((x) => x.kind === "secret"));
});

test("scanText does not flag a sha256-style hex hash as phone or card", () => {
  const hash =
    "9f1c0a47b2e83d6150fa92c7d4e8b0a1f3c5d7e9b1a3c5d7e9f1b3d5a7c9e0f24";
  const m = scanText(hash);
  assert.equal(m.length, 0, JSON.stringify(m));
});

test("scanText does not flag an ISO timestamp", () => {
  const m = scanText("2026-06-20T15:04:05.000Z");
  assert.equal(m.length, 0, JSON.stringify(m));
});

test("redact removes email, phone and secret", () => {
  const red = redact(
    "pat.sample@example.test +1-555-0142 sk-TESTONLYabcdefghijklmnopqrstuvwx",
  );
  assert.ok(!red.includes("pat.sample@example.test"));
  assert.ok(!red.includes("555-0142"));
  assert.ok(!red.includes("sk-TESTONLY"));
});

test("scanPii walks nested structures and keys", () => {
  const res = scanPii({ a: { b: ["clean", "x@y.test"] } });
  assert.equal(res.found, true);
  assert.ok(res.matches.some((m) => m.kind === "email"));
});

test("hashRef is stable, irreversible-looking, and leaks no input substring", () => {
  const a = hashRef("Pat Sample|pat.sample@example.test|+1-555-0142", "salt-1");
  const b = hashRef("Pat Sample|pat.sample@example.test|+1-555-0142", "salt-1");
  const c = hashRef("Pat Sample|pat.sample@example.test|+1-555-0142", "salt-2");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 16);
  assert.ok(!a.includes("Pat"));
  assert.ok(!a.includes("555"));
});

test("countStringFields counts every string", () => {
  assert.equal(countStringFields({ a: "x", b: [1, "y", { c: "z" }] }), 3);
});
