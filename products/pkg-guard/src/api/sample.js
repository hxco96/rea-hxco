/** Static example report. Served free so buyers can see the shape first. */
export const SAMPLE_REPORT = Object.freeze({
  reportVersion: 1,
  ecosystem: "npm",
  name: "reqeusts-helper",
  normalizedName: "reqeusts-helper",
  checkedAt: "2026-01-01T00:00:00.000Z",
  exists: true,
  verdict: "high",
  riskScore: 70,
  recommendation: "Do not install without a human review.",
  signals: {
    latestVersion: "1.0.0",
    ageDays: 3,
    versionCount: 1,
    installScripts: { present: true, scripts: { postinstall: "node setup.js" } },
    lookalikes: [{ name: "requests", distance: 2, reason: "2 character edits away" }],
  },
  reasons: [
    { signal: "very_new", points: 30, detail: "First published 3 day(s) ago." },
    { signal: "install_scripts", points: 20, detail: "Runs code on install: postinstall: node setup.js" },
    { signal: "single_release", points: 10, detail: "Only one release so far." },
  ],
  limitations: ["Example only. Scores are heuristic, not a safety guarantee."],
});
