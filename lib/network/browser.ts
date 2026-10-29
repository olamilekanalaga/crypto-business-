import { Graph, validateGraph, emptyGraph } from "./model";
const DB = "bd-oracle-network",
  STORE = "workspace";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readNetwork(): Promise<Graph> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get("current");
    r.onsuccess = () => {
      try {
        resolve(r.result ? validateGraph(r.result) : emptyGraph());
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeNetwork(graph: Graph): Promise<Graph> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite"),
      store = tx.objectStore(STORE);
    const get = store.get("current");
    let next: Graph;
    let problem: Error | undefined;
    get.onsuccess = () => {
      try {
        if ((get.result?.revision || 0) !== graph.revision)
          throw new Error(
            "Network changed in another tab. Reload before saving; your draft is still here.",
          );
        next = validateGraph({ ...graph, revision: graph.revision + 1 });
        store.put(next, "current");
      } catch (e) {
        problem = e as Error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        problem ||
          tx.error ||
          new Error("Network could not be saved. Export a backup."),
      );
    };
  });
}
