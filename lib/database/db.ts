import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Highlight } from "../../types/highlight";
import { UserSettings } from "../../types/settings";
import { DB_NAME, DB_VERSION, STORES } from "./schema";

interface WebScribeDBSchema extends DBSchema {
  highlights: {
  key: string;
  value: Highlight;

  indexes: {
    url: string;
    domain: string;
    pageTitle: string;
    lastVisited: number;
  };
};

  settings: {
    key: string;
    value: UserSettings;
  };
}

let dbInstance: IDBPDatabase<WebScribeDBSchema> | null = null;

export async function initDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WebScribeDBSchema>(
    DB_NAME,
    DB_VERSION,
    {
      upgrade(db, oldVersion, newVersion, transaction) {

        let highlightStore;

        if (!db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
          highlightStore = db.createObjectStore(STORES.HIGHLIGHTS, {
            keyPath: "id",
          });
        } else {
          highlightStore = transaction.objectStore(STORES.HIGHLIGHTS);
        }

        if (!highlightStore.indexNames.contains("url")) {
          highlightStore.createIndex("url", "url");
        }

        if (!highlightStore.indexNames.contains("domain")) {
          highlightStore.createIndex("domain", "domain");
        }

        if (!highlightStore.indexNames.contains("pageTitle")) {
          highlightStore.createIndex("pageTitle", "pageTitle");
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS);
        }

        if (!highlightStore.indexNames.contains("lastVisited")) {
          highlightStore.createIndex("lastVisited", "lastVisited");
        }
      }
    }
  );

  console.log("✅ WebScribeDB Initialized");

  return dbInstance;
}