/**
 * SessionStorageService
 * High-capacity client-side persistence using IndexedDB (spotify_datalab_db)
 * Supports multiple named sessions, auto-restore of the last active session,
 * and seamless loading of ~100MB+ Spotify streaming histories without memory loss.
 */

const DB_NAME = 'SpotifyDataLabDB';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const META_KEY_ACTIVE = 'last_active_session_id';

export class SessionStorageService {
  static openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Save or overwrite a dataset session
   * @param {string} sessionId
   * @param {string} sessionName
   * @param {Array} rawRecords
   */
  static async saveSession(sessionId, sessionName, rawRecords) {
    if (!rawRecords || rawRecords.length === 0) return;

    // Convert dates to ISO strings for high-speed serialization
    const serializedRecords = rawRecords.map(r => ({
      ...r,
      ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts
    }));

    const sessionPayload = {
      id: sessionId || `session_${Date.now()}`,
      name: sessionName || `Historial (${new Date().toLocaleDateString('es-ES')})`,
      count: rawRecords.length,
      updatedAt: new Date().toISOString(),
      records: serializedRecords
    };

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      store.put(sessionPayload);

      tx.oncomplete = () => {
        localStorage.setItem(META_KEY_ACTIVE, sessionPayload.id);
        resolve(sessionPayload);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get the last active session ID
   */
  static getActiveSessionId() {
    return localStorage.getItem(META_KEY_ACTIVE);
  }

  /**
   * Set active session ID
   */
  static setActiveSessionId(id) {
    localStorage.setItem(META_KEY_ACTIVE, id);
  }

  /**
   * Load session by ID
   * @param {string} sessionId
   */
  static async loadSession(sessionId) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.get(sessionId);

      req.onsuccess = () => {
        const data = req.result;
        if (!data) {
          resolve(null);
          return;
        }

        // Rehydrate Dates
        const hydrated = data.records.map(r => ({
          ...r,
          ts: new Date(r.ts)
        }));

        resolve({
          ...data,
          records: hydrated
        });
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * List all saved sessions metadata (lightweight, without records payload)
   */
  static async listSessions() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []).map(s => ({
          id: s.id,
          name: s.name,
          count: s.count,
          updatedAt: s.updatedAt
        })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionId) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      store.delete(sessionId);

      tx.oncomplete = () => {
        if (localStorage.getItem(META_KEY_ACTIVE) === sessionId) {
          localStorage.removeItem(META_KEY_ACTIVE);
        }
        resolve(true);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Clear all sessions from IndexedDB
   */
  static async clearAllSessions() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      store.clear();

      tx.oncomplete = () => {
        localStorage.removeItem(META_KEY_ACTIVE);
        resolve(true);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}
