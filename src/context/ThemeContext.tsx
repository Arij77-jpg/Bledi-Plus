/**
 * Reactive Theme Context & Dynamic Token Provider (`src/context/ThemeContext.tsx`)
 *
 * Supports Light, Dark, and System Default (`useColorScheme`) modes with persistent
 * storage across launches and instant UI updates without app restart.
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, useColorScheme, ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReportCategory, ReportStatus } from '../types/report';
import type { StatusToken, CategoryToken } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedColorScheme = 'light' | 'dark';

const THEME_STORAGE_KEY = '@citizen_report/theme_mode';

export interface ThemeColors {
  // Core requested tokens (`colors.background`, `colors.card`, `colors.text`, etc.)
  background: string;
  card: string;
  text: string;

  // Extended civic design system tokens
  primary: string;
  primaryTextOn: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  emerald: string;
  emeraldSoft: string;

  canvas: string;
  surface: string;
  surfaceSubtle: string;
  surfaceMuted: string;
  inputBg: string;
  tabBarBg: string;
  headerBg: string;

  border: string;
  borderDashed: string;
  borderFocus: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  white: string;

  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;

  switchTrackFalse: string;
  switchTrackTrue: string;
  switchThumb: string;
}

const LIGHT_COLORS: ThemeColors = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',

  primary: '#0F172A',
  primaryTextOn: '#FFFFFF',
  primarySoft: '#1E293B',
  accent: '#2563EB',
  accentSoft: 'rgba(37, 99, 235, 0.10)',
  emerald: '#059669',
  emeraldSoft: 'rgba(5, 150, 105, 0.10)',

  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceMuted: '#E2E8F0',
  inputBg: '#F8FAFC',
  tabBarBg: '#FFFFFF',
  headerBg: '#FFFFFF',

  border: '#E2E8F0',
  borderDashed: '#CBD5E1',
  borderFocus: '#2563EB',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  white: '#FFFFFF',

  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
  warning: '#B45309',
  warningSoft: '#FEF3C7',

  switchTrackFalse: '#CBD5E1',
  switchTrackTrue: '#2563EB',
  switchThumb: '#FFFFFF',
};

const DARK_COLORS: ThemeColors = {
  background: '#0B1120',
  card: '#131C2E',
  text: '#F8FAFC',

  primary: '#3B82F6',
  primaryTextOn: '#FFFFFF',
  primarySoft: '#1E293B',
  accent: '#60A5FA',
  accentSoft: 'rgba(96, 165, 250, 0.16)',
  emerald: '#10B981',
  emeraldSoft: 'rgba(16, 185, 129, 0.16)',

  canvas: '#0B1120',
  surface: '#131C2E',
  surfaceSubtle: '#1E293B',
  surfaceMuted: '#283548',
  inputBg: '#0F172A',
  tabBarBg: '#111827',
  headerBg: '#111827',

  border: '#233046',
  borderDashed: '#334155',
  borderFocus: '#60A5FA',

  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  white: '#FFFFFF',

  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.16)',

  switchTrackFalse: '#334155',
  switchTrackTrue: '#3B82F6',
  switchThumb: '#F8FAFC',
};

const LIGHT_STATUS_TOKENS: Record<ReportStatus, StatusToken> = {
  pending: {
    label: 'Pending',
    bg: '#FEF3C7',
    text: '#B45309',
    border: 'rgba(180, 83, 9, 0.18)',
    dot: '#D97706',
    pin: '#EF4444',
    icon: 'clock',
  },
  in_progress: {
    label: 'In Progress',
    bg: '#DBEAFE',
    text: '#1D4ED8',
    border: 'rgba(29, 78, 216, 0.18)',
    dot: '#2563EB',
    pin: '#F59E0B',
    icon: 'tool',
  },
  resolved: {
    label: 'Resolved',
    bg: '#D1FAE5',
    text: '#047857',
    border: 'rgba(4, 120, 87, 0.18)',
    dot: '#059669',
    pin: '#059669',
    icon: 'check-circle',
  },
  completed: {
    label: 'Complété',
    bg: '#D1FAE5',
    text: '#047857',
    border: 'rgba(4, 120, 87, 0.18)',
    dot: '#059669',
    pin: '#059669',
    icon: 'check-circle',
  },
};

const DARK_STATUS_TOKENS: Record<ReportStatus, StatusToken> = {
  pending: {
    label: 'Pending',
    bg: 'rgba(245, 158, 11, 0.16)',
    text: '#FBBF24',
    border: 'rgba(251, 191, 36, 0.28)',
    dot: '#F59E0B',
    pin: '#EF4444',
    icon: 'clock',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'rgba(59, 130, 246, 0.18)',
    text: '#60A5FA',
    border: 'rgba(96, 165, 250, 0.30)',
    dot: '#3B82F6',
    pin: '#F59E0B',
    icon: 'tool',
  },
  resolved: {
    label: 'Resolved',
    bg: 'rgba(16, 185, 129, 0.16)',
    text: '#34D399',
    border: 'rgba(52, 211, 153, 0.28)',
    dot: '#10B981',
    pin: '#10B981',
    icon: 'check-circle',
  },
  completed: {
    label: 'Complété',
    bg: 'rgba(16, 185, 129, 0.16)',
    text: '#34D399',
    border: 'rgba(52, 211, 153, 0.28)',
    dot: '#10B981',
    pin: '#10B981',
    icon: 'check-circle',
  },
};

const LIGHT_CATEGORY_TOKENS: Record<ReportCategory, CategoryToken> = {
  infrastructure: {
    label: 'Infrastructure & Roads',
    shortLabel: 'Roads',
    icon: 'alert-octagon',
    color: '#6D28D9',
    bg: 'rgba(109, 40, 217, 0.09)',
  },
  sanitation: {
    label: 'Sanitation & Waste',
    shortLabel: 'Sanitation',
    icon: 'trash-2',
    color: '#047857',
    bg: 'rgba(4, 120, 87, 0.09)',
  },
  lighting: {
    label: 'Public Lighting',
    shortLabel: 'Lighting',
    icon: 'zap',
    color: '#B45309',
    bg: 'rgba(180, 83, 9, 0.09)',
  },
  water: {
    label: 'Water & Sewage',
    shortLabel: 'Water',
    icon: 'droplet',
    color: '#0369A1',
    bg: 'rgba(3, 105, 161, 0.09)',
  },
  other: {
    label: 'Other Civic Issue',
    shortLabel: 'Other',
    icon: 'flag',
    color: '#475569',
    bg: 'rgba(71, 85, 105, 0.09)',
  },
};

const DARK_CATEGORY_TOKENS: Record<ReportCategory, CategoryToken> = {
  infrastructure: {
    label: 'Infrastructure & Roads',
    shortLabel: 'Roads',
    icon: 'alert-octagon',
    color: '#A78BFA',
    bg: 'rgba(167, 139, 250, 0.16)',
  },
  sanitation: {
    label: 'Sanitation & Waste',
    shortLabel: 'Sanitation',
    icon: 'trash-2',
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.16)',
  },
  lighting: {
    label: 'Public Lighting',
    shortLabel: 'Lighting',
    icon: 'zap',
    color: '#FBBF24',
    bg: 'rgba(251, 191, 36, 0.16)',
  },
  water: {
    label: 'Water & Sewage',
    shortLabel: 'Water',
    icon: 'droplet',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.16)',
  },
  other: {
    label: 'Other Civic Issue',
    shortLabel: 'Other',
    icon: 'flag',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.16)',
  },
};

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedColorScheme;
  systemScheme: ResolvedColorScheme;
  isDark: boolean;
  statusBarStyle: 'light' | 'dark';
  colors: ThemeColors;
  statusTokens: Record<ReportStatus, StatusToken>;
  categoryTokens: Record<ReportCategory, CategoryToken>;
  hairlineBorder: ViewStyle;
  isHydrated: boolean;
  setThemeMode: (nextMode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolvedTheme: 'light',
  systemScheme: 'light',
  isDark: false,
  statusBarStyle: 'dark',
  colors: LIGHT_COLORS,
  statusTokens: LIGHT_STATUS_TOKENS,
  categoryTokens: LIGHT_CATEGORY_TOKENS,
  hairlineBorder: { borderWidth: 1, borderColor: LIGHT_COLORS.border },
  isHydrated: false,
  setThemeMode: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const osScheme = useColorScheme();
  const systemScheme: ResolvedColorScheme = osScheme === 'dark' ? 'dark' : 'light';

  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (mounted && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setModeState(saved);
        }
      } catch {
        // Fallback silently to system
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // Non-fatal persistence failure
    }
  }, []);

  const resolvedTheme: ResolvedColorScheme = mode === 'system' ? systemScheme : mode;
  const isDark = resolvedTheme === 'dark';

  const value = useMemo<ThemeContextValue>(() => {
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
    return {
      mode,
      resolvedTheme,
      systemScheme,
      isDark,
      statusBarStyle: isDark ? 'light' : 'dark',
      colors,
      statusTokens: isDark ? DARK_STATUS_TOKENS : LIGHT_STATUS_TOKENS,
      categoryTokens: isDark ? DARK_CATEGORY_TOKENS : LIGHT_CATEGORY_TOKENS,
      hairlineBorder: {
        borderWidth: StyleSheet.hairlineWidth > 0 ? Math.max(StyleSheet.hairlineWidth, 1) : 1,
        borderColor: colors.border,
      },
      isHydrated,
      setThemeMode,
    };
  }, [mode, resolvedTheme, systemScheme, isDark, isHydrated, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
