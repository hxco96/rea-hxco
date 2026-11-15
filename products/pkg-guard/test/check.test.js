import test from "node:test";
import assert from "node:assert/strict";
import { checkPackage, parseSpec, InputError } from "../src/core/check.js";
import { fakeFetch, npmDoc, daysAgo, NOW } from "./helpers.js";

const NPM = "https://registry.npmjs.org/";
const DL = "https://api.npmjs.org/downloads/point/last-week/";

test("parseSpec handles prefixes, scopes and bad input", () => {
  assert.deepEqual(parseSpec("pypi:Requests"), { ecosystem: "pypi", name: "Requests" });
  assert.deepEqual(parseSpec("@scope/pkg"), { ecosystem: "npm", name: "@scope/pkg" });
  assert.throws(() => parseSpec("../etc/passwd"), InputError);
  assert.throws(() => parseSpec(""), InputError);
  assert.throws(() => parseSpec("x", "ruby"), InputError);
});

test("a missing npm package is reported as not existing", async () => {
  const fetch = fakeFetch({ [NPM]: { status: 404 }, [DL]: { status: 404 } });
  const r = await checkPackage({ ecosystem: "npm", name: "totally-made-up-pkg-xyz" }, { fetch, now: NOW });
  assert.equal(r.exists, false);
  assert.equal(r.verdict, "does_not_exist");
  assert.equal(r.riskScore, 100);
});

test("registry failure is unknown, never 'does not exist'", async () => {
  for (const status of [500, 429, 503]) {
    const fetch = fakeFetch({ [NPM]: { status }, [DL]: { status } });
    const r = await checkPackage({ ecosystem: "npm", name: "left-pad" }, { fetch, now: NOW });
    assert.equal(r.verdict, "unknown", `status ${status}`);
    assert.equal(r.exists, null);
    assert.equal(r.riskScore, null);
  }
});

test("a brand-new lookalike with an install script scores high", async () => {
  const doc = npmDoc({
    name: "lodsah",
    versions: [{ version: "1.0.0", at: daysAgo(2) }],
    scripts: { postinstall: "node x.js" },
  });
  const fetch = fakeFetch({ [NPM]: { body: doc }, [DL]: { body: { downloads: 12 } } });
  const r = await checkPackage({ ecosystem: "npm", name: "lodsah" }, { fetch, now: NOW });
  assert.equal(r.verdict, "high");
  const signals = r.reasons.map((x) => x.signal);
  for (const s of ["lookalike_name", "very_new", "install_scripts", "single_release", "low_downloads"]) {
    assert.ok(signals.includes(s), s);
  }
  assert.equal(r.signals.lookalikes[0].name, "lodash");
});

test("an old, popular, clean package scores low", async () => {
  const doc = npmDoc({
    name: "lodash",
    versions: [
      { version: "4.17.20", at: daysAgo(2000) },
      { version: "4.17.21", at: daysAgo(900) },
    ],
  });
  const fetch = fakeFetch({ [NPM]: { body: doc }, [DL]: { body: { downloads: 50_000_000 } } });
  const r = await checkPackage({ ecosystem: "npm", name: "lodash" }, { fetch, now: NOW });
  assert.equal(r.verdict, "low");
  assert.equal(r.riskScore, 0);
});

test("a publisher change on a fresh release is flagged", async () => {
  const doc = npmDoc({
    name: "some-lib",
    versions: [
      { version: "1.0.0", at: daysAgo(800), user: "alice" },
      { version: "1.0.1", at: daysAgo(3), user: "mallory" },
    ],
  });
  const fetch = fakeFetch({ [NPM]: { body: doc }, [DL]: { body: { downloads: 5000 } } });
  const r = await checkPackage({ ecosystem: "npm", name: "some-lib" }, { fetch, now: NOW });
  const hit = r.reasons.find((x) => x.signal === "publisher_changed");
  assert.equal(hit.points, 25);
});

test("missing download counts are a limitation, not a penalty", async () => {
  const doc = npmDoc({ name: "some-lib", versions: [{ version: "1.0.0", at: daysAgo(800) }] });
  const fetch = fakeFetch({ [NPM]: { body: doc }, [DL]: { status: 500 } });
  const r = await checkPackage({ ecosystem: "npm", name: "some-lib" }, { fetch, now: NOW });
  assert.equal(r.signals.weeklyDownloads, null);
  assert.ok(!r.reasons.some((x) => x.signal === "low_downloads"));
  assert.ok(r.limitations.some((l) => l.includes("Download count")));
});

test("scoped names are URL-encoded for the registry", async () => {
  const fetch = fakeFetch({ [NPM]: { status: 404 }, [DL]: { status: 404 } });
  await checkPackage({ ecosystem: "npm", name: "@scope/pkg" }, { fetch, now: NOW });
  assert.ok(fetch.calls.some((u) => u === `${NPM}@scope%2Fpkg`));
});

test("pypi: wheel-less release counts as a build-on-install risk", async () => {
  const doc = {
    info: { version: "0.1.0", author: "bob", project_urls: {} },
    releases: { "0.1.0": [{ packagetype: "sdist", upload_time_iso_8601: daysAgo(2) }] },
    urls: [{ packagetype: "sdist" }],
  };
  const fetch = fakeFetch({ "https://pypi.org/pypi/": { body: doc } });
  const r = await checkPackage({ ecosystem: "pypi", name: "reqeusts" }, { fetch, now: NOW });
  const signals = r.reasons.map((x) => x.signal);
  assert.ok(signals.includes("install_scripts"));
  assert.ok(signals.includes("lookalike_name"));
  assert.ok(signals.includes("no_repository"));
  assert.equal(r.signals.weeklyDownloads, null);
});

test("pypi 404 means does not exist; 500 means unknown", async () => {
  let r = await checkPackage({ ecosystem: "pypi", name: "nope-nope-nope" }, {
    fetch: fakeFetch({ "https://pypi.org/pypi/": { status: 404 } }), now: NOW });
  assert.equal(r.verdict, "does_not_exist");
  r = await checkPackage({ ecosystem: "pypi", name: "nope-nope-nope" }, {
    fetch: fakeFetch({ "https://pypi.org/pypi/": { status: 500 } }), now: NOW });
  assert.equal(r.verdict, "unknown");
});

test("a non-JSON registry body is unknown, not a crash", async () => {
  const html = () => new Response("<html>blocked</html>", { status: 200 });
  for (const ecosystem of ["npm", "pypi"]) {
    const r = await checkPackage({ ecosystem, name: "left-pad" }, { fetch: html, now: NOW });
    assert.equal(r.verdict, "unknown", ecosystem);
  }
});

test("unpublished or empty projects are unknown (and so not billable)", async () => {
  const npm = { name: "gone", time: { unpublished: { time: daysAgo(1) } }, versions: {} };
  let r = await checkPackage({ ecosystem: "npm", name: "gone" }, {
    fetch: fakeFetch({ [NPM]: { body: npm }, [DL]: { status: 404 } }), now: NOW });
  assert.equal(r.verdict, "unknown");
  const pypi = { info: { version: "1" }, releases: { "1": [] }, urls: [] };
  r = await checkPackage({ ecosystem: "pypi", name: "empty-proj" }, {
    fetch: fakeFetch({ "https://pypi.org/pypi/": { body: pypi } }), now: NOW });
  assert.equal(r.verdict, "unknown");
});

test("well-known packages are not heavily penalised for a new publisher", async () => {
  const doc = npmDoc({
    name: "lodash",
    versions: [
      { version: "4.0.0", at: daysAgo(900), user: "alice" },
      { version: "4.0.1", at: daysAgo(2), user: "bob" },
    ],
  });
  const fetch = fakeFetch({ [NPM]: { body: doc }, [DL]: { body: { downloads: 9e6 } } });
  const r = await checkPackage({ ecosystem: "npm", name: "lodash" }, { fetch, now: NOW });
  assert.equal(r.reasons.find((x) => x.signal === "publisher_changed").points, 5);
});

test("pypi publisher change compares names, not emails", async () => {
  const release = (version, author, email, at) => ({
    info: { version, author, author_email: email, project_urls: { Source: "https://github.com/a/b" } },
    releases: {},
    urls: [{ packagetype: "bdist_wheel" }],
  });
  const main = {
    info: { version: "2.0", author: "Ann", author_email: "new@example.com", project_urls: { Source: "https://github.com/a/b" } },
    releases: {
      "1.0": [{ packagetype: "bdist_wheel", upload_time_iso_8601: daysAgo(900) }],
      "2.0": [{ packagetype: "bdist_wheel", upload_time_iso_8601: daysAgo(100) }],
    },
    urls: [{ packagetype: "bdist_wheel" }],
  };
  const fetch = fakeFetch({
    "https://pypi.org/pypi/some-proj/1.0/json": { body: release("1.0", "Ann", "old@example.com") },
    "https://pypi.org/pypi/some-proj/json": { body: main },
  });
  const r = await checkPackage({ ecosystem: "pypi", name: "some-proj" }, { fetch, now: NOW });
  assert.equal(r.signals.publisherChange.changed, false);
});
