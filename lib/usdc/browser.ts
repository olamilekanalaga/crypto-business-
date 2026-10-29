import { emptyRegistry, Registry, validateRegistry } from "./model";
const DB = "bd-oracle-usdc";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("registry");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readRegistry(): Promise<Registry> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("registry");
    const r = tx.objectStore("registry").get("current");
    r.onsuccess = () => {
      try {
        resolve(r.result ? validateRegistry(r.result) : emptyRegistry());
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeRegistry(value: Registry): Promise<Registry> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("registry", "readwrite"),
      store = tx.objectStore("registry");
    let next: Registry, error: unknown;
    const r = store.get("current");
    r.onsuccess = () => {
      try {
        if ((r.result?.revision || 0) !== value.revision)
          throw new Error(
            "Another tab updated the registry. Reload before saving.",
          );
        next = validateRegistry({ ...value, revision: value.revision + 1 });
        store.put(next, "current");
      } catch (e) {
        error = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(error || tx.error);
    };
  });
}
