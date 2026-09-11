/** One bounded decision draft/evidence record; no telemetry or credentials. */
const DATABASE = 'neptune-decision-1';
const STORE = 'campaign';
const LIMIT = 64 * 1024 * 1024;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function readDecisionDraft(): Promise<string | null> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('current');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result === undefined) resolve(null);
        else if (typeof request.result !== 'string' || new TextEncoder().encode(request.result).length > LIMIT) reject(Error('Saved decision evidence exceeds the supported size.'));
        else resolve(request.result);
      };
    });
  } finally { db.close(); }
}
export async function writeDecisionDraft(text: string): Promise<void> {
  if (new TextEncoder().encode(text).length > LIMIT) throw Error('Decision evidence exceeds the supported storage size; export the campaign.');
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(text, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
