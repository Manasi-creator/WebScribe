import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Highlight } from "../types/highlight";
import { UserSettings } from "../types/settings";
import { DB_NAME, DB_VERSION, STORES } from "./schema";

interface WebScribeDBSchema extends DBSchema {
  highlights: {
    key: string;
    value: Highlight;
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
      upgrade(db) {
        // Highlights Store
        if (!db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
          db.createObjectStore(STORES.HIGHLIGHTS, {
            keyPath: "id",
          });
        }

        // Settings Store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS);
        }
      },
    }
  );

  console.log("✅ WebScribeDB Initialized");

  return dbInstance;
}