import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, findLookalikes, normalizeName } from "../src/core/similarity.js";

test("transposition counts as one edit", () => {
  assert.equal(editDistance("reqeusts", "requests"), 1);
  assert.equal(editDistance("lodash", "lodash"), 0);
  assert.equal(editDistance("abc", "xyz"), 3);
});

test("pypi names normalise per PEP 503", () => {
  assert.equal(normalizeName("pypi", "Python_Dateutil"), "python-dateutil");
  assert.equal(normalizeName("npm", "LoDash"), "lodash");
});

test("a popular package is never a lookalike of itself", () => {
  assert.deepEqual(findLookalikes("lodash", ["lodash", "lodas"]), []);
});

test("finds typos and separator tricks", () => {
  const typo = findLookalikes("reqeusts", ["requests"]);
  assert.equal(typo[0].name, "requests");
  const sep = findLookalikes("reactdom", ["react-dom"]);
  assert.equal(sep[0].reason, "same letters, different separators");
});

test("short names do not produce noisy matches", () => {
  assert.deepEqual(findLookalikes("vuf", ["vue", "vuex"]), []);
});
