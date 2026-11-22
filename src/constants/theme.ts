/**
 * Civic Design System & Theme Tokens
 *
 * Inspired by high-craft civic & transit interfaces (FixMyStreet, Citymapper, Citizen).
 * Establishes strict visual hierarchy, subdued semantic status pills,
 * warm layered neutrals, and soft ambient elevation.
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import type { ReportCategory, ReportStatus } from '../types/report';

export const Palette = {
  // Brand & Primary Civic Identity
  primary: '#0F172A',       // Deep Civic Navy / Slate 900
  primarySoft: '#1E293B',   // Slate 800
  accent: '#2563EB',        // Focused Cobalt
  accentSoft: 'rgba(37, 99, 235, 0.10)',
  emerald: '#059669',       // Muted Civic Emerald
  emeraldSoft: 'rgba(5, 150, 105, 0.10)',

  // Layered Neutrals
  canvas: '#F8FAFC',        // App canvas background
  surface: '#FFFFFF',       // Elevated card background
  surfaceSubtle: '#F1F5F9', // Recessed input / chip neutral
  surfaceMuted: '#E2E8F0',  // Skeleton base

  // Hairline Borders
  border: '#E2E8F0',        // Subtle 1px / hairline divider
  borderDashed: '#CBD5E1',  // Media upload dashed stroke
  borderFocus: '#2563EB',

  // Ink / Text Hierarchy
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  white: '#FFFFFF',

  // Semantic Alert / Destructive
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
} as const;

export interface StatusToken {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  pin: string;
  icon: 'clock' | 'tool' | 'check-circle';
}

export const StatusTokens: Record<ReportStatus, StatusToken> = {
  pending: {
    label: 'Pending',
    bg: '#FEF3C7',
    text: '#B45309',
    border: 'rgba(180, 83, 9, 0.18)',
    dot: '#D97706',
    pin: '#EF4444', // Red marker for pending urgency on map
    icon: 'clock',
  },
  in_progress: {
    label: 'In Progress',
    bg: '#DBEAFE',
    text: '#1D4ED8',
    border: 'rgba(29, 78, 216, 0.18)',
    dot: '#2563EB',
    pin: '#F59E0B', // Amber/Orange marker for active dispatch
    icon: 'tool',
  },
  resolved: {
    label: 'Resolved',
    bg: '#D1FAE5',
    text: '#047857',
    border: 'rgba(4, 120, 87, 0.18)',
    dot: '#059669',
    pin: '#059669', // Muted Emerald marker for verified completion
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

export interface CategoryToken {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bg: string;
}

export const CategoryTokens: Record<ReportCategory, CategoryToken> = {
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

export const Typography: Record<string, TextStyle> = {
  title: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 30,
    color: Palette.textPrimary,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
    color: Palette.textPrimary,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 21,
    color: Palette.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: Palette.textSecondary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 18,
    color: Palette.textPrimary,
  },
  micro: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: Palette.textMuted,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  card: 14,
  input: 10,
  chip: 10,
  thumbnail: 10,
  pill: 999,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  sheet: 20,
} as const;

export const Elevation: Record<'ambient' | 'floating' | 'subtle', ViewStyle> = {
  ambient: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
};

export const HairlineBorder: ViewStyle = {
  borderWidth: StyleSheet.hairlineWidth > 0 ? Math.max(StyleSheet.hairlineWidth, 1) : 1,
  borderColor: Palette.border,
};

export const Theme = {
  colors: Palette,
  status: StatusTokens,
  categories: CategoryTokens,
  typography: Typography,
  spacing: Spacing,
  radius: Radius,
  elevation: Elevation,
  hairline: HairlineBorder,
} as const;

export default Theme;
