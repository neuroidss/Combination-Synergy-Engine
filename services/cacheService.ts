// services/cacheService.ts
import { openDB, type IDBPDatabase, type DBSchema } from 'https://esm.sh/idb@8';

const DB_NAME = 'synergy-forge-atlas';
const DB_VERSION = 1;
const DOSSIER_STORE = 'dossiers';
const SOURCE_STORE = 'sources';
const VECTOR_STORE = 'vectors';

interface AtlasDBSchema extends DBSchema {
  [DOSSIER_STORE]: {
    key: string; // e.g., 'dossier-MET+RAPA'
    value: any; // The full dossier object
  };
  [SOURCE_STORE]: {
    key: string; // The canonical URL of the source
    value: any; // The full source object, including textContent
  };
   [VECTOR_STORE]: {
    key: string; // e.g., 'vector-db'
    value: any; // The entire vector DB array
  };
}

let dbPromise: Promise<IDBPDatabase<AtlasDBSchema>> | null = null;

const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<AtlasDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DOSSIER_STORE)) {
          db.createObjectStore(DOSSIER_STORE);
        }
        if (!db.objectStoreNames.contains(SOURCE_STORE)) {
          db.createObjectStore(SOURCE_STORE);
        }
        if (!db.objectStoreNames.contains(VECTOR_STORE)) {
          db.createObjectStore(VECTOR_STORE);
        }
      },
    });
  }
  return dbPromise;
};

// --- General Purpose Key-Value Store ---

export const getCache = async (storeName: 'dossiers' | 'sources' | 'vectors', key: string): Promise<any | null> => {
  try {
    const db = await initDB();
    const entry = await db.get(storeName, key);
    return entry ? entry : null;
  } catch (error) {
    console.error(`Failed to get from '${storeName}' cache:`, error);
    return null;
  }
};

export const setCache = async (storeName: 'dossiers' | 'sources' | 'vectors', key: string, value: any): Promise<void> => {
  try {
    const db = await initDB();
    await db.put(storeName, value, key);
  } catch (error) {
    console.error(`Failed to set in '${storeName}' cache:`, error);
  }
};

export const getAllFromCache = async (storeName: 'dossiers' | 'sources' | 'vectors'): Promise<any[]> => {
    try {
        const db = await initDB();
        return await db.getAll(storeName);
    } catch (error) {
        console.error(`Failed to get all from '${storeName}' cache:`, error);
        return [];
    }
}

export const clearAllCaches = async () => {
    try {
        const db = await initDB();
        await db.clear(DOSSIER_STORE);
        await db.clear(SOURCE_STORE);
        await db.clear(VECTOR_STORE);
        console.log("All IndexedDB caches cleared.");
    } catch (error) {
        console.error("Failed to clear IndexedDB caches:", error);
    }
}