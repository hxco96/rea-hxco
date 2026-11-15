/**
 * The package safety check: one function, one report. Every channel (CLI,
 * x402 API, Apify Actor, MCP server) calls checkPackage and returns its result
 * unchanged, so all three paid/free listings sell exactly the same data.
 */

import { POPULAR_NPM, POPULAR_PYPI } from "./popular.js";
import {
  RegistryError,
  fetchNpmPackument,
  fetchNpmWeeklyDownloads,
  fetchPypiProject,
  fetchPypiRelease,
} from "./registries.js";
import { findLookalikes, normalizeName } from "./similarity.js";

export const ECOSYSTEMS = Object.freeze(["npm", "pypi"]);
export const REPORT_VERSION = 1;

const DAY_MS = 86_400_000;
const NPM_INSTALL_HOOKS = ["preinstall", "install", "postinstall"];

const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;
const PYPI_NAME = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i;

const POPULAR = {
  npm: POPULAR_NPM.map((n) => normalizeName("npm", n)),
  pypi: POPULAR_PYPI.map((n) => normalizeName("pypi", n)),
};

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

/**
 * Accepts "npm:lodash", "pypi:requests", or a bare name plus an ecosystem.
 *
 * @param {string} spec
 * @param {string} [defaultEcosystem]
 * @returns {{ ecosystem: "npm" | "pypi", name: string }}
 */
export function parseSpec(spec, defaultEcosystem = "npm") {
  if (typeof spec !== "string" || spec.trim() === "") {
    throw new InputError("Package name is required.");
  }
  const match = /^(npm|pypi|pip|pip3|python):(.+)$/i.exec(spec.trim());
  const rawEcosystem = match ? match[1].toLowerCase() : defaultEcosystem;
  const ecosystem = rawEcosystem.startsWith("p") && rawEcosystem !== "pypi"
    ? "pypi"
    : rawEcosystem;
  const name = (match ? match[2] : spec).trim();
  validate(ecosystem, name);
  return { ecosystem, name };
}

/**
 * @param {string} ecosystem
 * @param {string} name
 */
function validate(ecosystem, name) {
  if (!ECOSYSTEMS.includes(ecosystem)) {
    throw new InputError(
      `Unsupported ecosystem "${ecosystem}". Use one of: ${ECOSYSTEMS.join(", ")}.`,
    );
  }
  if (typeof name !== "string" || name.length === 0 || name.length > 214) {
    throw new InputError("Package name must be 1 to 214 characters.");
  }
  const pattern = ecosystem === "npm" ? NPM_NAME : PYPI_NAME;
  if (!pattern.test(name)) {
    throw new InputError(`"${name}" is not a valid ${ecosystem} package name.`);
  }
}

/**
 * @typedef {object} CheckOptions
 * @property {typeof fetch} [fetch] - injected for tests
 * @property {Date} [now] - injected for tests
 */

/**
 * Check one package and return a risk report.
 *
 * @param {{ ecosystem: string, name: string }} target
 * @param {CheckOptions} [options]
 */
export async function checkPackage(target, options = {}) {
  const ecosystem = String(target?.ecosystem ?? "npm").toLowerCase();
  const name = String(target?.name ?? "").trim();
  validate(ecosystem, name);
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? new Date();
  const normalized = normalizeName(ecosystem, name);

  const base = {
    reportVersion: REPORT_VERSION,
    ecosystem,
    name,
    normalizedName: normalized,
    checkedAt: now.toISOString(),
  };

  let facts;
  try {
    facts =
      ecosystem === "npm"
        ? await npmFacts(name, fetchImpl, now)
        : await pypiFacts(name, fetchImpl, now);
  } catch (error) {
    if (!(error instanceof RegistryError)) throw error;
    return {
      ...base,
      exists: null,
      verdict: "unknown",
      riskScore: null,
      recommendation:
        "The registry could not be reached, so nothing is known. Retry before installing.",
      signals: null,
      reasons: [],
      limitations: [error.message],
    };
  }

  const lookalikes = findLookalikes(normalized, POPULAR[ecosystem]);

  if (!facts.exists && facts.unpublished) {
    return {
      ...base,
      exists: null,
      verdict: "unknown",
      riskScore: null,
      recommendation:
        "The name is registered but has no installable release. Do not install it.",
      signals: { lookalikes },
      reasons: [],
      limitations: [
        ...facts.limitations,
        "Registry lists the name with no published versions or files (unpublished or empty project).",
      ],
    };
  }

  if (!facts.exists) {
    const reasons = [
      {
        signal: "missing",
        points: 100,
        detail: `No package named "${name}" exists on ${ecosystem}. It may be a hallucinated name; an attacker could register it later.`,
      },
    ];
    return {
      ...base,
      exists: false,
      verdict: "does_not_exist",
      riskScore: 100,
      recommendation: lookalikes.length
        ? `Do not install. Did you mean "${lookalikes[0].name}"?`
        : "Do not install. Check the package name.",
      signals: { lookalikes },
      reasons,
      limitations: facts.limitations,
    };
  }

  const { signals, limitations } = facts;
  signals.lookalikes = lookalikes;
  signals.isWellKnown = POPULAR[ecosystem].includes(normalized);
  const reasons = score(signals);
  const riskScore = Math.min(
    100,
    reasons.reduce((sum, r) => sum + r.points, 0),
  );
  const verdict = riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low";

  return {
    ...base,
    exists: true,
    verdict,
    riskScore,
    recommendation: recommend(verdict, lookalikes),
    signals,
    reasons,
    limitations,
  };
}

function recommend(verdict, lookalikes) {
  const hint = lookalikes.length
    ? ` Its name resembles "${lookalikes[0].name}"; confirm that is not what you meant.`
    : "";
  if (verdict === "high") {
    return `Do not install without a human review.${hint}`;
  }
  if (verdict === "medium") {
    return `Review the reasons below before installing.${hint}`;
  }
  return `No strong warning signs.${hint}`;
}

/**
 * Turn signals into scored reasons. The weights are judgement, not measured
 * false-positive rates; the README says so and so does every report.
 */
function score(s) {
  const reasons = [];
  const add = (signal, points, detail) =>
    reasons.push({ signal, points, detail });

  if (s.lookalikes.length) {
    const top = s.lookalikes[0];
    add(
      "lookalike_name",
      top.distance <= 1 ? 40 : 25,
      `Name is close to the popular package "${top.name}" (${top.reason}).`,
    );
  }
  if (s.ageDays !== null) {
    if (s.ageDays < 7) {
      add("very_new", 30, `First published ${s.ageDays} day(s) ago.`);
    } else if (s.ageDays < 30) {
      add("new", 20, `First published ${s.ageDays} days ago.`);
    }
  }
  if (s.versionCount <= 1 && s.ageDays !== null && s.ageDays < 90) {
    add("single_release", 10, "Only one release so far.");
  }
  if (s.versionsLast7Days >= 5) {
    add(
      "release_burst",
      10,
      `${s.versionsLast7Days} releases in the last 7 days.`,
    );
  }
  if (s.publisherChange?.changed) {
    const recent =
      s.latestPublishedDaysAgo !== null && s.latestPublishedDaysAgo < 14;
    // Big projects rotate release managers all the time; weigh it lightly.
    add(
      "publisher_changed",
      s.isWellKnown ? 5 : recent ? 25 : 15,
      `Latest release was published by "${s.publisherChange.to}" instead of "${s.publisherChange.from}"${recent ? ", within the last 14 days" : ""}.`,
    );
  }
  if (s.installScripts?.present) {
    add(
      "install_scripts",
      s.installScripts.kind === "sdist_build" ? 10 : 20,
      s.installScripts.detail,
    );
  }
  if (s.deprecated) {
    add("deprecated", 10, `Marked deprecated or yanked: ${s.deprecated}`);
  }
  if (s.hasRepository === false) {
    add("no_repository", 5, "No source repository is linked.");
  }
  if (s.weeklyDownloads !== null && s.weeklyDownloads < 100) {
    add(
      "low_downloads",
      10,
      `Only ${s.weeklyDownloads} downloads in the last week.`,
    );
  }
  return reasons;
}

function daysBetween(earlier, later) {
  return Math.max(0, Math.floor((later - earlier) / DAY_MS));
}

/** @returns {Promise<{exists: boolean, unpublished?: boolean, signals?: any, limitations: string[]}>} */
async function npmFacts(name, fetchImpl, now) {
  const [doc, weeklyDownloads] = await Promise.all([
    fetchNpmPackument(name, fetchImpl),
    fetchNpmWeeklyDownloads(name, fetchImpl),
  ]);
  const limitations = [];
  if (!doc) return { exists: false, limitations };
  const time = doc.time ?? {};
  const versions = Object.keys(doc.versions ?? {});
  if (time.unpublished || versions.length === 0) {
    return { exists: false, unpublished: Boolean(time.unpublished), limitations };
  }

  const ordered = versions
    .filter((v) => time[v])
    .sort((a, b) => Date.parse(time[a]) - Date.parse(time[b]));
  const latest = doc["dist-tags"]?.latest ?? ordered.at(-1);
  const latestManifest = doc.versions[latest] ?? {};
  const created = Date.parse(time.created ?? time[ordered[0]]);
  const latestPublished = time[latest] ? Date.parse(time[latest]) : null;

  const latestIndex = ordered.indexOf(latest);
  const previous = latestIndex > 0 ? ordered[latestIndex - 1] : null;
  const publisherOf = (v) => doc.versions[v]?._npmUser?.name ?? null;
  let publisherChange = null;
  if (previous) {
    const from = publisherOf(previous);
    const to = publisherOf(latest);
    publisherChange =
      from && to ? { changed: from !== to, from, to, previousVersion: previous } : null;
  }
  if (!publisherChange) {
    limitations.push("Publisher history unavailable for the latest release.");
  }

  const scripts = latestManifest.scripts ?? {};
  const hooks = Object.fromEntries(
    NPM_INSTALL_HOOKS.filter((h) => scripts[h]).map((h) => [h, scripts[h]]),
  );
  const nativeBuild = latestManifest.gypfile === true;
  const present = Object.keys(hooks).length > 0 || nativeBuild;
  const installScripts = {
    present,
    kind: present ? "lifecycle_scripts" : null,
    scripts: hooks,
    detail: present
      ? `Runs code on install: ${[
          ...Object.entries(hooks).map(([h, cmd]) => `${h}: ${cmd}`),
          ...(nativeBuild ? ["native build via node-gyp"] : []),
        ].join("; ")}`
      : null,
  };

  if (weeklyDownloads === null) {
    limitations.push("Download count unavailable; not counted against the package.");
  }
  const cutoff = now.getTime() - 7 * DAY_MS;

  return {
    exists: true,
    limitations,
    signals: {
      latestVersion: latest,
      firstPublished: new Date(created).toISOString(),
      ageDays: Number.isNaN(created) ? null : daysBetween(created, now),
      latestPublished: latestPublished ? new Date(latestPublished).toISOString() : null,
      latestPublishedDaysAgo: latestPublished ? daysBetween(latestPublished, now) : null,
      versionCount: versions.length,
      versionsLast7Days: ordered.filter((v) => Date.parse(time[v]) >= cutoff).length,
      weeklyDownloads,
      maintainers: (doc.maintainers ?? []).map((m) => m.name).filter(Boolean),
      publisherChange,
      installScripts,
      deprecated:
        typeof latestManifest.deprecated === "string" ? latestManifest.deprecated : null,
      hasRepository: Boolean(latestManifest.repository ?? doc.repository),
    },
  };
}

const REPO_HOSTS = /(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|sr\.ht)/i;

async function pypiFacts(name, fetchImpl, now) {
  const doc = await fetchPypiProject(name, fetchImpl);
  const limitations = [
    "PyPI publishes no download counts in its JSON API; downloads are not scored.",
  ];
  if (!doc) return { exists: false, limitations };
  const info = doc.info ?? {};
  const releases = doc.releases ?? {};

  /** earliest upload time per release that has files */
  const uploaded = Object.entries(releases)
    .map(([version, files]) => {
      const times = (files ?? [])
        .map((f) => Date.parse(f.upload_time_iso_8601 ?? f.upload_time))
        .filter((t) => !Number.isNaN(t));
      return times.length ? { version, at: Math.min(...times) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
  if (uploaded.length === 0) {
    return { exists: false, unpublished: true, limitations };
  }

  const latest = info.version ?? uploaded.at(-1).version;
  const latestEntry = uploaded.find((u) => u.version === latest) ?? uploaded.at(-1);
  const latestIndex = uploaded.indexOf(latestEntry);
  const previous = latestIndex > 0 ? uploaded[latestIndex - 1].version : null;

  // Compare names only: an email edit is not a change of publisher.
  const who = (i) => (i?.author || i?.maintainer || "").trim() || null;
  let publisherChange = null;
  if (previous) {
    const prior = await fetchPypiRelease(name, previous, fetchImpl);
    const from = who(prior?.info);
    const to = who(info);
    if (from && to) {
      publisherChange = { changed: from !== to, from, to, previousVersion: previous };
    }
  }
  if (!publisherChange) {
    limitations.push(
      "Author history unavailable; PyPI does not publish who uploaded each release.",
    );
  }

  const files = doc.urls ?? releases[latest] ?? [];
  const hasWheel = files.some((f) => f.packagetype === "bdist_wheel");
  const hasSdist = files.some((f) => f.packagetype === "sdist");
  const sdistOnly = hasSdist && !hasWheel;
  const installScripts = {
    present: sdistOnly,
    kind: sdistOnly ? "sdist_build" : null,
    scripts: {},
    detail: sdistOnly
      ? "Latest release ships only a source archive, so pip runs its build script on install."
      : null,
  };

  const urls = Object.values(info.project_urls ?? {}).concat(info.home_page ?? []);
  const inactive = (info.classifiers ?? []).some((c) => c.includes("7 - Inactive"));
  const yanked = info.yanked ? `release yanked${info.yanked_reason ? `: ${info.yanked_reason}` : ""}` : null;
  const cutoff = now.getTime() - 7 * DAY_MS;

  return {
    exists: true,
    limitations,
    signals: {
      latestVersion: latest,
      firstPublished: new Date(uploaded[0].at).toISOString(),
      ageDays: daysBetween(uploaded[0].at, now),
      latestPublished: new Date(latestEntry.at).toISOString(),
      latestPublishedDaysAgo: daysBetween(latestEntry.at, now),
      versionCount: uploaded.length,
      versionsLast7Days: uploaded.filter((u) => u.at >= cutoff).length,
      weeklyDownloads: null,
      maintainers: [info.author, info.maintainer].filter(Boolean),
      publisherChange,
      installScripts,
      deprecated: yanked ?? (inactive ? "classified as inactive" : null),
      hasRepository: urls.some((u) => typeof u === "string" && REPO_HOSTS.test(u)),
    },
  };
}
