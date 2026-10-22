// Native IndexedDB Wrapper
const DB_NAME = 'AgriAmigo_LocalDB';
const DB_VERSION = 2;

const STORES = [
  'app_data',        // singleton row for crops, stages, market_rates
  'farmers',         // list of farmer objects
  'plots',           // list of plot objects
  'crop_seasons',    // list of season objects
  'visits',          // list of visit objects
  'calls',           // list of call objects
  'recommendations', // list of recommendation objects
  'promotions',      // list of promotional library objects
  'meta'             // for sync timestamps
];

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === 'app_data' || storeName === 'meta') {
            db.createObjectStore(storeName); // Key-Value stores
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' }); // Record stores
          }
        }
      });
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
};

export const clearAllData = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES, 'readwrite');
    STORES.forEach(store => transaction.objectStore(store).clear());
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e);
  });
};

// Generic get/set for Key-Value stores (app_data, meta)
export const getVal = async (storeName, key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const setVal = async (storeName, key, value) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const request = transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Generic operations for Record stores
export const bulkPut = async (storeName, items) => {
  if (!items || !items.length) return;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    items.forEach(item => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAll = async (storeName) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const getPromotionsFromDB = () => getAll('promotions');
export const savePromotionsToDB = (promos) => bulkPut('promotions', promos);
