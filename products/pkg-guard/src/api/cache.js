/** Tiny in-memory TTL cache so repeat checks do not hammer the registries. */
export class TtlCache {
  #entries = new Map();
  #ttlMs;
  #max;

  constructor({ ttlMs, max }) {
    this.#ttlMs = ttlMs;
    this.#max = max;
  }

  get(key) {
    const hit = this.#entries.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    if (this.#entries.size >= this.#max) {
      this.#entries.delete(this.#entries.keys().next().value);
    }
    this.#entries.set(key, { value, expires: Date.now() + this.#ttlMs });
  }
}
