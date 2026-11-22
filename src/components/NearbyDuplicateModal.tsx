/**
 * Smart Duplicate Detection Modal Bottom-Sheet (`src/components/NearbyDuplicateModal.tsx`)
 *
 * Interrupts duplicate ticket creation when an active issue (`status !== 'resolved'`)
 * already exists within 30 meters via Haversine proximity matching.
 * Supports multi-match browsing, dark/light theme tokens, i18n, and RTL formatting.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { CivicReport } from '../types/report';
import {
  DUPLICATE_DETECTION_RADIUS_METERS,
  NearbyDuplicateMatch,
} from '../utils/geoDistance';
import { Radius, Spacing, Typography, Elevation } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';
import { StatusBadge } from './StatusBadge';
import { CategoryBadge } from './CategoryBadge';
import { triggerLightHaptic } from '../utils/haptics';
import { resolveImageSource } from '../utils/imageResolver';

export interface NearbyDuplicateModalProps {
  visible: boolean;
  matches: NearbyDuplicateMatch[];
  currentUserId?: string;
  isUpvoting?: boolean;
  onUpvoteExisting: (report: CivicReport) => void | Promise<void>;
  onReportAnyway: () => void;
}

export const NearbyDuplicateModal: React.FC<NearbyDuplicateModalProps> = ({
  visible,
  matches,
  currentUserId,
  isUpvoting = false,
  onUpvoteExisting,
  onReportAnyway,
}) => {
  const { t } = useTranslation();
  const { colors, hairlineBorder } = useTheme();
  const { isRTL } = usePreferences();

  const [activeIndex, setActiveIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setImageError(false);
  }, [matches, visible]);

  const activeMatch = matches[activeIndex] || matches[0];
  if (!activeMatch) {
    return null;
  }

  const { report, roundedMeters } = activeMatch;
  const thumbUri = report.photoBeforeUrl || report.imageUrl;
  const hasAlreadyUpvoted = Boolean(
    currentUserId && (report.upvotedBy || []).includes(currentUserId)
  );

  const rtlRow = isRTL ? styles.rowReverse : undefined;
  const rtlText = isRTL ? styles.textRight : undefined;

  const headlineText =
    roundedMeters < 2
      ? t('duplicateModal.titleSameSpot')
      : t('duplicateModal.titleDistance', { distance: roundedMeters });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onReportAnyway}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTapDismiss}
          activeOpacity={1}
          onPress={onReportAnyway}
        />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Bottom-Sheet Handle */}
          <View style={[styles.dragBar, { backgroundColor: colors.surfaceMuted }]} />

          {/* Header Pill + Headline */}
          <View style={[styles.alertBadgeRow, rtlRow]}>
            <View style={[styles.alertIconBadge, { backgroundColor: colors.warningSoft }]}>
              <Feather name="radio" size={16} color={colors.warning} />
            </View>
            <View style={[styles.alertPill, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.alertPillText, { color: colors.warning }]}>
                {t('duplicateModal.badge')}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }, rtlText]}>
            {headlineText}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }, rtlText]}>
            {t('duplicateModal.subtitle')}
          </Text>

          {/* Optional Switcher when Multiple Active Matches Exist */}
          {matches.length > 1 && (
            <View style={[styles.multiMatchBar, rtlRow]}>
              <Text style={[styles.multiMatchLabel, { color: colors.textSecondary }]}>
                {t('duplicateModal.moreMatches', {
                  current: activeIndex + 1,
                  total: matches.length,
                  radius: DUPLICATE_DETECTION_RADIUS_METERS,
                })}
              </Text>
              <View style={[styles.pagerBtns, rtlRow]}>
                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    triggerLightHaptic();
                    setImageError(false);
                    setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length);
                  }}
                >
                  <Feather name={isRTL ? 'chevron-right' : 'chevron-left'} size={15} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    triggerLightHaptic();
                    setImageError(false);
                    setActiveIndex((prev) => (prev + 1) % matches.length);
                  }}
                >
                  <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={15} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Matched Nearby Report Preview Card */}
          <View
            style={[
              styles.previewCard,
              { backgroundColor: colors.inputBg },
              hairlineBorder,
              rtlRow,
            ]}
          >
            <View
              style={[
                styles.thumbBox,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              {!imageError && thumbUri ? (
                <Image
                  source={resolveImageSource(thumbUri)}
                  style={styles.thumbImage}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Feather name="image" size={24} color={colors.textSubtle} />
              )}
            </View>

            <View style={styles.previewBody}>
              <View style={[styles.badgesWrap, rtlRow]}>
                <StatusBadge status={report.status} size="sm" />
                <CategoryBadge category={report.category} compact />
              </View>

              <Text
                style={[styles.reportTitle, { color: colors.text }, rtlText]}
                numberOfLines={2}
              >
                {report.title}
              </Text>

              <View style={[styles.metaRow, rtlRow]}>
                <View style={[styles.distanceTag, { backgroundColor: colors.accentSoft }]}>
                  <Feather name="navigation" size={10.5} color={colors.accent} />
                  <Text style={[styles.distanceTagText, { color: colors.accent }]}>
                    {t('duplicateModal.distanceChip', { distance: roundedMeters })}
                  </Text>
                </View>

                <View style={[styles.votesChip, rtlRow]}>
                  <Ionicons name="thumbs-up" size={11.5} color={colors.emerald} />
                  <Text style={[styles.votesText, { color: colors.textSecondary }]}>
                    {t('duplicateModal.upvotesCount', { count: report.upvotesCount || 0 })}
                  </Text>
                </View>
              </View>

              {report.location?.address ? (
                <Text
                  style={[styles.addressText, { color: colors.textMuted }, rtlText]}
                  numberOfLines={1}
                >
                  {report.location.address}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Primary Actions */}
          <View style={styles.actionsColumn}>
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={isUpvoting}
              onPress={() => onUpvoteExisting(report)}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: colors.emerald },
                isUpvoting && styles.disabledBtn,
              ]}
            >
              {isUpvoting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <View style={[styles.btnInner, rtlRow]}>
                  <Ionicons name="thumbs-up" size={17} color={colors.white} />
                  <Text style={styles.primaryActionText}>
                    {hasAlreadyUpvoted
                      ? t('duplicateModal.upvotedAction')
                      : t('duplicateModal.upvoteAction')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isUpvoting}
              onPress={onReportAnyway}
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <Feather name="plus-circle" size={16} color={colors.textSecondary} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>
                {t('duplicateModal.reportAnywayAction')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    justifyContent: 'flex-end',
  },
  backdropTapDismiss: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm + 4,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    ...Elevation.floating,
  },
  dragBar: {
    alignSelf: 'center',
    width: 42,
    height: 4.5,
    borderRadius: Radius.pill,
    marginBottom: Spacing.md,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  alertBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  alertIconBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  alertPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    ...Typography.sectionHeader,
    fontSize: 19,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
  },
  multiMatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm + 4,
  },
  multiMatchLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  pagerBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  pagerBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  thumbBox: {
    width: 84,
    height: 84,
    borderRadius: Radius.thumbnail,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  previewBody: {
    flex: 1,
    gap: 5,
  },
  badgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  reportTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
    gap: 4,
  },
  distanceTagText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  votesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  votesText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 11.5,
  },
  actionsColumn: {
    marginTop: Spacing.lg,
    gap: Spacing.sm + 2,
  },
  primaryActionBtn: {
    borderRadius: Radius.input + 2,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.subtle,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.input + 2,
    borderWidth: 1,
    paddingVertical: 13,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
