/**
 * Custom Media Capture & Proof Component (`MediaUploadBox.tsx`)
 *
 * Replaces generic buttons with a refined dashed dropzone card:
 * - Dashed border (#CBD5E1), centered camera icon badge, and contextual guidance
 * - Dual action triggers (Take Photo / Photo Library)
 * - Image preview mode with floating translucent "Retake" and "Delete" pill chips
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';
import { triggerLightHaptic } from '../utils/haptics';
import { resolveImageSource } from '../utils/imageResolver';

export interface MediaUploadBoxProps {
  imageUri: string | null;
  onCapturePress: () => void;
  onGalleryPress: () => void;
  onClearPress: () => void;
  title?: string;
  guidanceText?: string;
  badgeLabel?: string;
  accentColor?: string;
}

export const MediaUploadBox: React.FC<MediaUploadBoxProps> = ({
  imageUri,
  onCapturePress,
  onGalleryPress,
  onClearPress,
  title = 'Attach Visual Evidence',
  guidanceText = 'Ensure the defect and street context are visible',
  badgeLabel = 'EVIDENCE PHOTO',
  accentColor,
}) => {
  const { colors, isDark } = useTheme();
  const { isRTL } = usePreferences();
  const { t } = useTranslation();

  const resolvedAccent = accentColor || colors.accent;

  const handleCamera = () => {
    triggerLightHaptic();
    onCapturePress();
  };

  const handleGallery = () => {
    triggerLightHaptic();
    onGalleryPress();
  };

  const handleClear = () => {
    triggerLightHaptic();
    onClearPress();
  };

  if (imageUri) {
    const chipBg = isDark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.94)';
    return (
      <View
        style={[
          styles.previewWrapper,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
        ]}
      >
        <Image source={resolveImageSource(imageUri)} style={styles.previewImage} resizeMode="cover" />

        {/* Subtle gradient-like bottom scrim */}
        <View style={styles.previewBadge}>
          <View style={[styles.badgeDot, { backgroundColor: colors.emerald }]} />
          <Text style={styles.previewBadgeText}>{badgeLabel}</Text>
        </View>

        {/* Floating Action Chips: Retake & Delete */}
        <View style={styles.floatingChipsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCamera}
            style={[styles.floatingChip, { backgroundColor: chipBg }]}
          >
            <Feather name="refresh-cw" size={13} color={colors.textPrimary} />
            <Text style={[styles.floatingChipText, { color: colors.textPrimary }]}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleClear}
            style={[styles.floatingChip, { backgroundColor: chipBg }]}
          >
            <Feather name="trash-2" size={13} color={colors.danger} />
            <Text style={[styles.floatingChipText, { color: colors.danger }]}>
              {t('common.delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.dropzone,
        { backgroundColor: colors.card, borderColor: colors.borderDashed },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleCamera}
        style={styles.dropzoneMain}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${resolvedAccent}1A` }]}>
          <Feather name="camera" size={24} color={resolvedAccent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.guidance, { color: colors.textMuted }]}>{guidanceText}</Text>
      </TouchableOpacity>

      {/* Secondary Action Bar */}
      <View
        style={[
          styles.actionsBar,
          { borderTopColor: colors.border },
          isRTL && styles.rowReverse,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCamera}
          style={[styles.actionPill, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="camera-outline" size={16} color={colors.primaryTextOn} />
          <Text style={[styles.actionPillTextPrimary, { color: colors.primaryTextOn }]}>
            {t('common.camera')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleGallery}
          style={[
            styles.actionPill,
            { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Ionicons name="images-outline" size={16} color={colors.textPrimary} />
          <Text style={[styles.actionPillTextSecondary, { color: colors.textPrimary }]}>
            {t('common.gallery')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dropzone: {
    borderRadius: Radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: Spacing.base,
    ...Elevation.subtle,
  },
  dropzoneMain: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm + 2,
  },
  title: {
    ...Typography.cardTitle,
    marginBottom: 4,
  },
  guidance: {
    ...Typography.micro,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.input,
    gap: 6,
  },
  actionPillTextPrimary: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionPillTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewWrapper: {
    height: 220,
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    ...Elevation.ambient,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  floatingChipsRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  floatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: Radius.pill,
    gap: 5,
    ...Elevation.floating,
  },
  floatingChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MediaUploadBox;
