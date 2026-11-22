/**
 * Hardware-Backed Encrypted Storage Adapter (`src/services/secureStorage.ts`)
 *
 * Replaces unencrypted AsyncStorage for Firebase Auth session persistence
 * and sensitive client state using `expo-secure-store` (iOS Keychain / Android Keystore).
 *
 * Implements automatic byte-safe chunking to stay strictly below Android/iOS's
 * 2,048-byte per-entry Keychain/Keystore limit for large JWT/Firebase Auth payloads.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AsyncStorageCompatible {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const MAX_CHUNK_UTF8_BYTES = 1800; // Margin under 2048-byte native limit
const CHUNK_META_SUFFIX = '.__chunks';
const KEY_SANITIZE_REGEX = /[^A-Za-z0-9._-]/g;

const webMemoryFallback = new Map<string, string>();

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'com.blediplus.auth',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Deterministic 32-bit FNV-1a hash so sanitized keys never collide even when
 * different characters (`:`, `/`, `@`) map to `_`.
 */
function hashKey(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function toSafeSecureKey(rawKey: string): string {
  const sanitized = rawKey.replace(KEY_SANITIZE_REGEX, '_').slice(0, 64);
  return `cr_${sanitized}_${hashKey(rawKey)}`;
}

function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1; // surrogate pair
    } else bytes += 3;
  }
  return bytes;
}

function splitUtf8SafeChunks(value: string, maxBytes: number): string[] {
  if (utf8ByteLength(value) <= maxBytes) {
    return [value];
  }

  const chunks: string[] = [];
  let start = 0;
  let currentBytes = 0;

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff && i + 1 < value.length;
    const charBytes =
      code <= 0x7f ? 1 : code <= 0x7ff ? 2 : isHighSurrogate ? 4 : 3;

    if (currentBytes + charBytes > maxBytes && i > start) {
      chunks.push(value.slice(start, i));
      start = i;
      currentBytes = 0;
    }

    currentBytes += charBytes;
    if (isHighSurrogate) i += 1;
  }

  if (start < value.length) {
    chunks.push(value.slice(start));
  }

  return chunks;
}

async function webGetItem(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch (_) {}
  return webMemoryFallback.get(key) ?? null;
}

async function webSetItem(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
  webMemoryFallback.set(key, value);
}

async function webRemoveItem(key: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch (_) {}
  webMemoryFallback.delete(key);
}

export const secureStorage: AsyncStorageCompatible = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webGetItem(key);
    }

    const safeKey = toSafeSecureKey(key);
    try {
      const metaRaw = await SecureStore.getItemAsync(
        `${safeKey}${CHUNK_META_SUFFIX}`,
        secureStoreOptions
      );

      if (metaRaw) {
        const meta = JSON.parse(metaRaw) as { count?: number };
        const count = Number(meta?.count || 0);
        if (count > 0) {
          const parts: string[] = [];
          for (let i = 0; i < count; i += 1) {
            const part = await SecureStore.getItemAsync(`${safeKey}.__c${i}`, secureStoreOptions);
            if (part === null) {
              // Corrupted partial chunk entry; fail closed
              return null;
            }
            parts.push(part);
          }
          return parts.join('');
        }
      }

      return await SecureStore.getItemAsync(safeKey, secureStoreOptions);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      return webSetItem(key, value);
    }

    const safeKey = toSafeSecureKey(key);
    // Clear previous chunks before writing new layout
    await secureStorage.removeItem(key);

    const chunks = splitUtf8SafeChunks(value, MAX_CHUNK_UTF8_BYTES);
    if (chunks.length === 1) {
      await SecureStore.setItemAsync(safeKey, chunks[0], secureStoreOptions);
      return;
    }

    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${safeKey}.__c${i}`, chunks[i], secureStoreOptions);
    }
    await SecureStore.setItemAsync(
      `${safeKey}${CHUNK_META_SUFFIX}`,
      JSON.stringify({ count: chunks.length }),
      secureStoreOptions
    );
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return webRemoveItem(key);
    }

    const safeKey = toSafeSecureKey(key);
    try {
      const metaRaw = await SecureStore.getItemAsync(
        `${safeKey}${CHUNK_META_SUFFIX}`,
        secureStoreOptions
      );
      if (metaRaw) {
        const meta = JSON.parse(metaRaw) as { count?: number };
        const count = Number(meta?.count || 0);
        for (let i = 0; i < count; i += 1) {
          await SecureStore.deleteItemAsync(`${safeKey}.__c${i}`, secureStoreOptions).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${safeKey}${CHUNK_META_SUFFIX}`, secureStoreOptions).catch(
          () => {}
        );
      }
      await SecureStore.deleteItemAsync(safeKey, secureStoreOptions).catch(() => {});
    } catch {
      // Ignore deletion miss
    }
  },
};
