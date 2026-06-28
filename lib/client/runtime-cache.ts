"use client";

type CacheEntry<T> = {
  data?: T;
  updatedAt: number;
  inflight?: Promise<T>;
};

const runtimeCacheStore = new Map<string, CacheEntry<unknown>>();

export function peekRuntimeCache<T>(key: string, staleMs: number) {
  const entry = runtimeCacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry?.data) return null;
  return Date.now() - entry.updatedAt <= staleMs ? entry.data : null;
}

export async function getRuntimeCached<T>(
  key: string,
  loader: () => Promise<T>,
  options?: {
    staleMs?: number;
    force?: boolean;
  },
) {
  const staleMs = options?.staleMs ?? 0;
  const force = options?.force ?? false;
  const existing = runtimeCacheStore.get(key) as CacheEntry<T> | undefined;

  if (!force && existing?.data && Date.now() - existing.updatedAt <= staleMs) {
    return existing.data;
  }

  if (!force && existing?.inflight) {
    return existing.inflight;
  }

  const inflight = loader()
    .then((data) => {
      runtimeCacheStore.set(key, {
        data,
        updatedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      const current = runtimeCacheStore.get(key) as CacheEntry<T> | undefined;
      if (current?.inflight) {
        runtimeCacheStore.set(key, {
          data: current.data,
          updatedAt: current.updatedAt,
        });
      }
    });

  runtimeCacheStore.set(key, {
    data: existing?.data,
    updatedAt: existing?.updatedAt ?? 0,
    inflight,
  });

  return inflight;
}

export function primeRuntimeCache<T>(key: string, data: T) {
  runtimeCacheStore.set(key, {
    data,
    updatedAt: Date.now(),
  });
}

export function invalidateRuntimeCache(key: string) {
  runtimeCacheStore.delete(key);
}
