import { initDatabase } from "./db";
import { Highlight } from "../types/highlight";
import { STORES } from "./schema";

export async function saveHighlight(highlight: Highlight) {
  const db = await initDatabase();
  await db.put(STORES.HIGHLIGHTS, highlight);
}

export async function getHighlightById(id: string) {
  const db = await initDatabase();
  return db.get(STORES.HIGHLIGHTS, id);
}

export async function getAllHighlights() {
  const db = await initDatabase();
  return db.getAll(STORES.HIGHLIGHTS);
}

export async function getHighlightsByUrl(url: string) {
  const db = await initDatabase();

  const highlights = await db.getAll(STORES.HIGHLIGHTS);

  return highlights.filter(h => h.url === url);
}

export async function updateHighlight(highlight: Highlight) {
  const db = await initDatabase();
  await db.put(STORES.HIGHLIGHTS, highlight);
}

export async function deleteHighlight(id: string) {
  const db = await initDatabase();
  await db.delete(STORES.HIGHLIGHTS, id);
}

export async function deleteHighlightsByDomain(domain: string) {
  const db = await initDatabase();

  const highlights = await db.getAll(STORES.HIGHLIGHTS);

  for (const highlight of highlights) {
    if (highlight.domain === domain) {
      await db.delete(STORES.HIGHLIGHTS, highlight.id);
    }
  }
}