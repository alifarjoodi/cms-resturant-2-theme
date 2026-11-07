// One deployment serves one site. Keys never include visitor credentials.
// TTL is a fallback for the CMS's at-most-once revalidation delivery.
export class ContentCache {
  constructor(ttl = 60_000, maxEntries = 500) {
    this.ttl = ttl;
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.pending = new Map();
    this.generation = 0;
  }
  async get(key, load) {
    const hit = this.entries.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const generation = this.generation;
    const task = (async () => {
      try {
        const value = await load();
        if (generation === this.generation) {
          if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value);
          this.entries.set(key, { value, expires: Date.now() + this.ttl });
        }
        return value;
      } catch (error) {
        if (hit && generation === this.generation) return hit.value;
        throw error;
      } finally { if (this.pending.get(key) === task) this.pending.delete(key); }
    })();
    this.pending.set(key, task);
    return task;
  }
  invalidate() {
    this.generation += 1;
    this.entries.clear();
    this.pending.clear();
    // Existing visitors may finish; their responses cannot refill the new cache.
  }
}
