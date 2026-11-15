/** Build an injected fetch that serves canned registry responses by URL. */
export function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    for (const [prefix, reply] of Object.entries(routes)) {
      if (String(url).startsWith(prefix)) {
        const { status = 200, body = {} } =
          typeof reply === "function" ? reply(url) : reply;
        return new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response("{}", { status: 404 });
  };
  impl.calls = calls;
  return impl;
}

export const NOW = new Date("2026-06-01T00:00:00Z");
export const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

export function npmDoc({ name, versions, user = "alice", scripts, extra = {} }) {
  const time = { created: versions[0].at };
  const docVersions = {};
  for (const v of versions) {
    time[v.version] = v.at;
    docVersions[v.version] = {
      name,
      version: v.version,
      _npmUser: { name: v.user ?? user },
      scripts: v.scripts ?? scripts,
      repository: "git+https://github.com/x/y.git",
    };
  }
  return {
    name,
    time,
    versions: docVersions,
    "dist-tags": { latest: versions.at(-1).version },
    maintainers: [{ name: user }],
    ...extra,
  };
}
