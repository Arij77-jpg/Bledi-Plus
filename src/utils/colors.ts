/**
 * Compatibility bridge re-exporting from the centralized civic Theme (`src/constants/theme.ts`)
 */

import { Palette, StatusTokens, CategoryTokens } from '../constants/theme';
import type { ReportStatus } from '../types/report';

export const Colors = {
  primary: Palette.primary,
  primaryDark: Palette.primarySoft,
  primaryLight: Palette.accent,
  accent: Palette.emerald,

  statusPending: StatusTokens.pending.text,
  statusPendingBg: StatusTokens.pending.bg,
  statusInProgress: StatusTokens.in_progress.text,
  statusInProgressBg: StatusTokens.in_progress.bg,
  statusResolved: StatusTokens.resolved.text,
  statusResolvedBg: StatusTokens.resolved.bg,

  background: Palette.canvas,
  card: Palette.surface,
  text: Palette.textPrimary,
  textSecondary: Palette.textSecondary,
  textMuted: Palette.textMuted,
  border: Palette.border,
  borderLight: Palette.surfaceSubtle,
  error: Palette.danger,
  white: Palette.white,
};

export const CategoryMeta = CategoryTokens;

export function getStatusColor(status: string) {
  const token = StatusTokens[status as ReportStatus];
  return token ? token.pin : StatusTokens.pending.pin;
}

export function getStatusBg(status: string) {
  const token = StatusTokens[status as ReportStatus];
  return token ? token.bg : StatusTokens.pending.bg;
}
