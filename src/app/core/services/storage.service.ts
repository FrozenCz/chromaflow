import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { StorageKey, StorageValueMap } from '../models/storage-types';

/**
 * Thin, strongly-typed wrapper around `window.localStorage`.
 *
 * Responsibilities:
 * - Serializes/deserializes values as JSON.
 * - Handles SSR environments where `localStorage` is unavailable by becoming
 *   a no-op (reads return `null`, writes are silently skipped).
 * - Swallows parse/serialization errors and returns `null` from reads so that
 *   corrupted entries never crash the app.
 *
 * The generic `get`/`set` methods accept any `StorageKey`; callers that want
 * stricter typing can use the type-safe {@link StorageService.getTyped} and
 * {@link StorageService.setTyped} helpers which consult {@link StorageValueMap}.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Reads and JSON-parses the value stored under `key`.
   * Returns `null` if the key is missing, parsing fails, or localStorage
   * is unavailable (SSR).
   */
  get<T>(key: StorageKey): T | null {
    const storage = this.getStorage();
    if (storage === null) {
      return null;
    }
    try {
      const raw = storage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * JSON-serializes and writes `value` under `key`. Silently fails on
   * SSR or when the underlying `setItem` throws (e.g. quota exceeded).
   */
  set<T>(key: StorageKey, value: T): void {
    const storage = this.getStorage();
    if (storage === null) {
      return;
    }
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or serialization error — fail silently so callers do
      // not need defensive try/catch around every write.
    }
  }

  /**
   * Removes the entry stored under `key`. No-op if storage is unavailable.
   */
  remove(key: StorageKey): void {
    const storage = this.getStorage();
    if (storage === null) {
      return;
    }
    try {
      storage.removeItem(key);
    } catch {
      // Swallow — remove failures are non-recoverable here.
    }
  }

  /**
   * Clears ALL entries from localStorage. Use with care.
   */
  clear(): void {
    const storage = this.getStorage();
    if (storage === null) {
      return;
    }
    try {
      storage.clear();
    } catch {
      // Swallow — clear failures are non-recoverable here.
    }
  }

  /**
   * Typed convenience reader. Equivalent to `get<StorageValueMap[K]>(key)`
   * but without requiring the caller to restate the generic.
   */
  getTyped<K extends keyof StorageValueMap>(key: K): StorageValueMap[K] | null {
    return this.get<StorageValueMap[K]>(key);
  }

  /**
   * Typed convenience writer that enforces the payload shape at compile time.
   */
  setTyped<K extends keyof StorageValueMap>(key: K, value: StorageValueMap[K]): void {
    this.set<StorageValueMap[K]>(key, value);
  }

  /**
   * Returns the active `Storage` implementation, or `null` if we are
   * running in an environment where it is unavailable (SSR, disabled
   * storage, etc.).
   */
  private getStorage(): Storage | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage;
    } catch {
      return null;
    }
  }
}
