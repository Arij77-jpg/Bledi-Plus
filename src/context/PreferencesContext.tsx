/**
 * Preferences & Privacy Context (`src/context/PreferencesContext.tsx`)
 *
 * Persists user privacy settings, notification preferences, and language/RTL awareness,
 * and exposes `clearLocalCache()` and coordinate fuzzing helpers consumed by report flows.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import {
  initializeI18n,
  isLanguageRTL,
  setAppLanguage,
  SupportedLanguage,
} from '../i18n';

const PREFS_STORAGE_KEY = '@citizen_report/user_preferences';
export const DRAFT_CACHE_PREFIX = '@citizen_report/draft_';

export interface NotificationPrefs {
  statusUpdates: boolean;
  nearbyAlerts: boolean;
  upvoteAlerts: boolean;
}

export interface UserPreferencesState {
  anonymousReporting: boolean;
  approximateLocation: boolean;
  notifications: NotificationPrefs;
}

const DEFAULT_PREFERENCES: UserPreferencesState = {
  anonymousReporting: false,
  approximateLocation: false,
  notifications: {
    statusUpdates: true,
    nearbyAlerts: true,
    upvoteAlerts: true,
  },
};

interface PreferencesContextValue {
  preferences: UserPreferencesState;
  language: SupportedLanguage;
  isRTL: boolean;
  isLoaded: boolean;
  setAnonymousReporting: (enabled: boolean) => Promise<void>;
  setApproximateLocation: (enabled: boolean) => Promise<void>;
  setNotificationPref: (key: keyof NotificationPrefs, enabled: boolean) => Promise<void>;
  changeLanguage: (lang: SupportedLanguage) => Promise<{ rtlChanged: boolean }>;
  clearLocalCache: () => Promise<number>;
  applyLocationPrivacy: (coords: { latitude: number; longitude: number }) => {
    latitude: number;
    longitude: number;
  };
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  language: 'en',
  isRTL: false,
  isLoaded: false,
  setAnonymousReporting: async () => {},
  setApproximateLocation: async () => {},
  setNotificationPref: async () => {},
  changeLanguage: async () => ({ rtlChanged: false }),
  clearLocalCache: async () => 0,
  applyLocationPrivacy: (coords) => coords,
});

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [preferences, setPreferences] = useState<UserPreferencesState>(DEFAULT_PREFERENCES);
  const [language, setLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'en'
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [storedPrefs, resolvedLang] = await Promise.all([
          AsyncStorage.getItem(PREFS_STORAGE_KEY),
          initializeI18n(),
        ]);

        if (mounted) {
          setLanguage(resolvedLang);
          if (storedPrefs) {
            const parsed = JSON.parse(storedPrefs) as Partial<UserPreferencesState>;
            setPreferences({
              anonymousReporting: Boolean(parsed.anonymousReporting),
              approximateLocation: Boolean(parsed.approximateLocation),
              notifications: {
                statusUpdates: parsed.notifications?.statusUpdates ?? true,
                nearbyAlerts: parsed.notifications?.nearbyAlerts ?? true,
                upvoteAlerts: parsed.notifications?.upvoteAlerts ?? true,
              },
            });
          }
        }
      } catch {
        // Use defaults safely
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const persistPreferences = useCallback(async (next: UserPreferencesState) => {
    setPreferences(next);
    try {
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal persistence error
    }
  }, []);

  const setAnonymousReporting = useCallback(
    async (enabled: boolean) => {
      await persistPreferences({ ...preferences, anonymousReporting: enabled });
    },
    [preferences, persistPreferences]
  );

  const setApproximateLocation = useCallback(
    async (enabled: boolean) => {
      await persistPreferences({ ...preferences, approximateLocation: enabled });
    },
    [preferences, persistPreferences]
  );

  const setNotificationPref = useCallback(
    async (key: keyof NotificationPrefs, enabled: boolean) => {
      await persistPreferences({
        ...preferences,
        notifications: {
          ...preferences.notifications,
          [key]: enabled,
        },
      });
    },
    [preferences, persistPreferences]
  );

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguage(lang);
    return setAppLanguage(lang);
  }, []);

  const clearLocalCache = useCallback(async (): Promise<number> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        (k) =>
          k.startsWith(DRAFT_CACHE_PREFIX) ||
          k.startsWith('@citizen_report/cache_') ||
          k.includes('image_cache')
      );
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
      return cacheKeys.length;
    } catch {
      return 0;
    }
  }, []);

  /**
   * Rounds GPS coordinates to 3 decimal places (~110m–150m street-level radius)
   * when Approximate Location Privacy is enabled.
   */
  const applyLocationPrivacy = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      if (!preferences.approximateLocation) {
        return coords;
      }
      return {
        latitude: Math.round(coords.latitude * 1000) / 1000,
        longitude: Math.round(coords.longitude * 1000) / 1000,
      };
    },
    [preferences.approximateLocation]
  );

  const isRTL = isLanguageRTL(language);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        language,
        isRTL,
        isLoaded,
        setAnonymousReporting,
        setApproximateLocation,
        setNotificationPref,
        changeLanguage,
        clearLocalCache,
        applyLocationPrivacy,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => useContext(PreferencesContext);
