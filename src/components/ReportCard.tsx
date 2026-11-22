/**
 * Modern Civic Report Card (`ReportCard.tsx`)
 *
 * Production layout inspired by FixMyStreet / Citizen / Citymapper:
 * - Left: Compact 84x84 rounded thumbnail with locked aspect ratio & shimmer fallback
 * - Right: Status pill, category badge, 2-line clamped title, and inline relative metadata
 * - Bottom row: Address context + tactile haptic Upvote pill
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CivicReport } from '../types/report';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';
import { StatusBadge } from './StatusBadge';
import { CategoryBadge } from './CategoryBadge';
import { resolveImageSource } from '../utils/imageResolver';
import { UpvoteButton } from './UpvoteButton';
import { formatRelativeTime, formatDistanceLabel, Coordinates } from '../utils/formatting';
import { triggerSelectionHaptic } from '../utils/haptics';

export interface ReportCardProps {
  report: CivicReport;
  currentUserId?: string;
  userCoords?: Coordinates | null;
  onPress: (report: CivicReport) => void;
  onUpvoteChanged?: (reportId: string, voted: boolean, newCount: number) => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  report,
  currentUserId,
  userCoords,
  onPress,
  onUpvoteChanged,
}) => {
  const { colors, hairlineBorder } = useTheme();
  const { isRTL } = usePreferences();

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (imageLoaded || imageError) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [imageLoaded, imageError, shimmerAnim]);

  const hasUpvoted = Boolean(currentUserId && (report.upvotedBy || []).includes(currentUserId));
  const timeAgo = formatRelativeTime(report.createdAt);
  const distanceLabel = formatDistanceLabel(userCoords, report.location);

  const handleCardPress = () => {
    triggerSelectionHaptic();
    onPress(report);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={`${report.title}, status ${report.status}`}
      style={[
        styles.card,
        { backgroundColor: colors.card },
        hairlineBorder,
      ]}
    >
      {/* Top Content Row: 84x84 Thumbnail + Primary Hierarchy */}
      <View style={[styles.topRow, isRTL && styles.rowReverse]}>
        {/* Left: Locked 84x84 Square Thumbnail with Shimmer Placeholder */}
        <View
          style={[
            styles.thumbnailWrapper,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
          ]}
        >
          {!imageLoaded && !imageError && (
            <Animated.View
              style={[
                styles.thumbnailSkeleton,
                { opacity: shimmerAnim, backgroundColor: colors.surfaceMuted },
              ]}
            />
          )}

          {imageError || !report.imageUrl ? (
            <View style={[styles.thumbnailFallback, { backgroundColor: colors.surfaceSubtle }]}>
              <Feather name="image" size={22} color={colors.textSubtle} />
            </View>
          ) : (
            <Image
              source={resolveImageSource(report.imageUrl)}
              style={styles.thumbnail}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}

          {/* Verified Before/After indicator dot if resolved or completed */}
          {(report.status === 'resolved' || report.status === 'completed') &&
            Boolean(report.photoAfterUrl || report.resolution?.afterImageUrl) && (
              <View
                style={[
                  styles.verifiedBadge,
                  { backgroundColor: colors.emerald, borderColor: colors.card },
                ]}
              >
                <Feather name="check" size={10} color={colors.white} />
              </View>
            )}
        </View>

        {/* Right: Title, Pills, Inline Metadata */}
        <View style={styles.rightColumn}>
          <View style={[styles.pillsRow, isRTL && styles.rowReverse]}>
            <StatusBadge status={report.status} size="sm" />
            <CategoryBadge category={report.category} compact />
          </View>

          <Text
            style={[
              styles.title,
              { color: colors.text },
              isRTL && styles.textRight,
            ]}
            numberOfLines={2}
          >
            {report.title}
          </Text>

          <View style={[styles.metaRow, isRTL && styles.rowReverse]}>
            <Feather name="clock" size={11.5} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>{timeAgo}</Text>

            {distanceLabel ? (
              <>
                <Text style={[styles.metaDot, { color: colors.textSubtle }]}>•</Text>
                <Feather name="navigation" size={11} color={colors.accent} />
                <Text style={[styles.metaText, styles.distanceText, { color: colors.accent }]}>
                  {distanceLabel}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      {/* Hairline Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Bottom Action Row: Street Location + Haptic Upvote Pill */}
      <View style={[styles.bottomRow, isRTL && styles.rowReverse]}>
        <View style={[styles.addressContainer, isRTL && styles.rowReverse]}>
          <Feather name="map-pin" size={13} color={colors.textMuted} />
          <Text
            style={[
              styles.addressText,
              { color: colors.textSecondary },
              isRTL && styles.textRight,
            ]}
            numberOfLines={1}
          >
            {report.location?.address || 'Location recorded'}
          </Text>
        </View>

        <UpvoteButton
          reportId={report.id}
          initialCount={report.upvotesCount || 0}
          hasUpvoted={hasUpvoted}
          currentUserId={currentUserId}
          onVoteToggled={(voted, newCount) =>
            onUpvoteChanged?.(report.id, voted, newCount)
          }
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: Spacing.md + 2,
    marginBottom: Spacing.md,
    ...Elevation.ambient,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  thumbnailWrapper: {
    width: 84,
    height: 84,
    aspectRatio: 1,
    borderRadius: Radius.thumbnail,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  thumbnailSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  rightColumn: {
    flex: 1,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    ...Typography.cardTitle,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    ...Typography.micro,
  },
  metaDot: {
    fontSize: 11,
    marginHorizontal: 2,
  },
  distanceText: {
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm + 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addressText: {
    ...Typography.micro,
    flex: 1,
  },
});

export default ReportCard;
