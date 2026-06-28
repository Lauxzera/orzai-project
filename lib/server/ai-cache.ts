import "server-only";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const stores = new Map<string, Map<string, CacheEntry<unknown>>>();
const inFlightStores = new Map<string, Map<string, Promise<unknown>>>();

function getStore(namespace: string) {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map<string, CacheEntry<unknown>>();
    stores.set(namespace, store);
  }
  return store;
}

function getInFlightStore(namespace: string) {
  let store = inFlightStores.get(namespace);
  if (!store) {
    store = new Map<string, Promise<unknown>>();
    inFlightStores.set(namespace, store);
  }
  return store;
}

export function getCachedValue<T>(namespace: string, key: string) {
  const store = getStore(namespace);
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

export function setCachedValue<T>(namespace: string, key: string, value: T, ttlMs: number) {
  const store = getStore(namespace);
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
  return value;
}

export async function getOrSetInFlightValue<T>(
  namespace: string,
  key: string,
  factory: () => Promise<T>
) {
  const store = getInFlightStore(namespace);
  const existing = store.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = factory().finally(() => {
    store.delete(key);
  });
  store.set(key, promise);
  return promise;
}
