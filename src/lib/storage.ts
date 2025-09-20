import { Item } from "./types";

const ITEMS_KEY = "pqs_items";
const USAGE_KEY = "pqs_usage";
const RECENT_KEY = "pqs_recent";

type Usage = Record<string, number>;
type Recent = Record<string, number>;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export class Storage {
  getAll(): Item[] {
    return readJSON<Item[]>(ITEMS_KEY, []);
  }
  upsert(item: Item) {
    const all = this.getAll();
    const idx = all.findIndex((x) => x.id === item.id);
    if (idx >= 0) all[idx] = item;
    else all.push(item);
    writeJSON(ITEMS_KEY, all);
  }
  bulkUpsert(list: Item[]) {
    const map = new Map<string, Item>();
    for (const i of [...this.getAll(), ...list]) map.set(i.id, i);
    writeJSON(ITEMS_KEY, Array.from(map.values()));
  }
  clearAll() {
    writeJSON(ITEMS_KEY, []);
    writeJSON(USAGE_KEY, {});
    writeJSON(RECENT_KEY, {});
  }

  // learned ranking
  getUsage(): Usage {
    return readJSON<Usage>(USAGE_KEY, {});
  }
  getRecent(): Recent {
    return readJSON<Recent>(RECENT_KEY, {});
  }
  markUsed(id: string) {
    const u = this.getUsage();
    u[id] = (u[id] ?? 0) + 1;
    writeJSON(USAGE_KEY, u);

    const r = this.getRecent();
    r[id] = Date.now();
    writeJSON(RECENT_KEY, r);
  }
  resetLearning() {
    writeJSON(USAGE_KEY, {});
    writeJSON(RECENT_KEY, {});
  }
}
