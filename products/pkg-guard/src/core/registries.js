/**
 * Thin clients for the public npm and PyPI registry APIs. Each function
 * returns raw registry JSON (or null when the package does not exist) so the
 * scoring code can be tested against fixtures without the network.
 */

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";
const PYPI = "https://pypi.org/pypi";

const USER_AGENT = "pkg-guard/0.1 (+package safety check)";
const TIMEOUT_MS = 10_000;

export class RegistryError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, url: string }} details
   */
  constructor(message, details) {
    super(message);
    this.name = "RegistryError";
    this.status = details.status;
    this.url = details.url;
  }
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @returns {Promise<any | null>} parsed JSON, or null on 404
 */
async function getJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new RegistryError(`Could not reach ${url}: ${error.message}`, {
      url,
    });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new RegistryError(`${url} answered ${response.status}`, {
      status: response.status,
      url,
    });
  }
  try {
    return await response.json();
  } catch (error) {
    throw new RegistryError(`${url} returned a body that is not JSON`, {
      status: response.status,
      url,
    });
  }
}

/** npm wants the slash in a scoped name encoded: @scope%2Fname. */
function npmPath(name) {
  return name.startsWith("@") ? name.replace("/", "%2F") : name;
}

/**
 * @param {string} name
 * @param {typeof fetch} fetchImpl
 */
export function fetchNpmPackument(name, fetchImpl = fetch) {
  return getJson(fetchImpl, `${NPM_REGISTRY}/${npmPath(name)}`);
}

/**
 * Weekly downloads. Returns null when unknown; a missing number never counts
 * as "zero downloads".
 *
 * @param {string} name
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<number | null>}
 */
export async function fetchNpmWeeklyDownloads(name, fetchImpl = fetch) {
  try {
    const body = await getJson(fetchImpl, `${NPM_DOWNLOADS}/${name}`);
    return typeof body?.downloads === "number" ? body.downloads : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} name
 * @param {typeof fetch} fetchImpl
 */
export function fetchPypiProject(name, fetchImpl = fetch) {
  return getJson(fetchImpl, `${PYPI}/${encodeURIComponent(name)}/json`);
}

/**
 * Metadata for one release, used to compare authors across releases.
 *
 * @param {string} name
 * @param {string} version
 * @param {typeof fetch} fetchImpl
 */
export async function fetchPypiRelease(name, version, fetchImpl = fetch) {
  try {
    return await getJson(
      fetchImpl,
      `${PYPI}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`,
    );
  } catch {
    return null;
  }
}
