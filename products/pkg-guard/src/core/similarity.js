/**
 * Name similarity helpers used to spot lookalike ("typosquat") package names.
 */

/**
 * Optimal string alignment distance (Damerau-Levenshtein with adjacent
 * transpositions). "reqeusts" -> "requests" is one edit, not two.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Normalize a name the way a registry compares them, so "Python_Dateutil"
 * and "python-dateutil" are the same name. PyPI follows PEP 503.
 *
 * @param {"npm" | "pypi"} ecosystem
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(ecosystem, name) {
  const trimmed = name.trim();
  if (ecosystem === "pypi") {
    return trimmed.toLowerCase().replace(/[-_.]+/g, "-");
  }
  return trimmed.toLowerCase();
}

/** Strip separators so "reactdom" and "react-dom" compare as equal. */
function squash(name) {
  return name.replace(/[-_.@/]+/g, "");
}

/**
 * Find popular package names that the given name closely resembles without
 * being identical to.
 *
 * @param {string} normalized - name already passed through normalizeName
 * @param {readonly string[]} popular - normalized popular names
 * @returns {{ name: string, distance: number, reason: string }[]}
 */
export function findLookalikes(normalized, popular) {
  if (popular.includes(normalized)) return [];
  const matches = [];
  const squashed = squash(normalized);
  for (const candidate of popular) {
    if (squash(candidate) === squashed) {
      matches.push({
        name: candidate,
        distance: 0,
        reason: "same letters, different separators",
      });
      continue;
    }
    // Short names collide by accident too often to be a useful signal.
    if (candidate.length < 5) continue;
    if (Math.abs(candidate.length - normalized.length) > 2) continue;
    const distance = editDistance(normalized, candidate);
    const limit = candidate.length >= 8 ? 2 : 1;
    if (distance <= limit) {
      matches.push({
        name: candidate,
        distance,
        reason: `${distance} character edit${distance === 1 ? "" : "s"} away`,
      });
    }
  }
  return matches.sort((x, y) => x.distance - y.distance).slice(0, 5);
}
