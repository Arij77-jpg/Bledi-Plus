/**
 * Interactive Civic Map Screen (`app/(tabs)/map.tsx`)
 *
 * High-craft map experience inspired by Citymapper & Citizen:
 * - Floating category & status filter pills overlaid cleanly over the map
 * - Status-coded map markers with crisp white rings and ambient shadows
 * - Animated sliding bottom preview card (instead of plain Callout popups)
 *   showing thumbnail, title, status pill, upvote count, and "View Details" CTA
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import { subscribeToReports } from '../../src/services/reports';
import { CivicReport, ReportCategory, ReportStatus } from '../../src/types/report';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';
import { CategoryBadge } from '../../src/components/CategoryBadge';
import { UpvoteButton } from '../../src/components/UpvoteButton';
import { formatRelativeTime, formatDistanceLabel, Coordinates } from '../../src/utils/formatting';
import { triggerLightHaptic, triggerSelectionHaptic } from '../../src/utils/haptics';
import { resolveImageSource } from '../../src/utils/imageResolver';

const INITIAL_REGION = {
  latitude: 33.504,
  longitude: 11.112,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark, statusTokens, categoryTokens, hairlineBorder } = useTheme();
  const { isRTL } = usePreferences();
  const mapRef = useRef<MapView | null>(null);

  const [reports, setReports] = useState<CivicReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CivicReport | null>(null);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | 'all'>('all');

  // Slide-up animation for bottom preview card
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = subscribeToReports(
      { status: statusFilter, category: categoryFilter },
      (updatedReports) => {
        setReports(updatedReports);
        setSelectedReport((prev) =>
          prev ? updatedReports.find((r) => r.id === prev.id) || null : null
        );
      }
    );

    return () => unsubscribe();
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: selectedReport ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [selectedReport, sheetAnim]);

  const handleMarkerPress = (report: CivicReport) => {
    triggerSelectionHaptic();
    setSelectedReport(report);

    if (report.location?.latitude && report.location?.longitude) {
      mapRef.current?.animateToRegion(
        {
          latitude: report.location.latitude - 0.0025,
          longitude: report.location.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        450
      );
    }
  };

  const centerOnUser = async () => {
    triggerLightHaptic();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserCoords(coords);
      mapRef.current?.animateToRegion(
        {
          ...coords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        700
      );
    } catch (err) {
      console.warn('Center on user failed:', err);
    }
  };

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [260, 0],
  });

  const floatingChipBg = isDark
    ? 'rgba(19, 28, 46, 0.94)'
    : 'rgba(255, 255, 255, 0.96)';
  const rtlRow = isRTL ? styles.rowReverse : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* --- FLOATING TOP FILTER OVERLAY --- */}
      <View style={styles.filterOverlay} pointerEvents="box-none">
        {/* Floating Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.filterChip,
              { backgroundColor: floatingChipBg },
              hairlineBorder,
              categoryFilter === 'all' && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setCategoryFilter('all');
            }}
          >
            <Feather
              name="layers"
              size={13}
              color={categoryFilter === 'all' ? colors.primaryTextOn : colors.text}
            />
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    categoryFilter === 'all' ? colors.primaryTextOn : colors.text,
                },
              ]}
            >
              {t('categories.all')} ({reports.length})
            </Text>
          </TouchableOpacity>

          {(Object.keys(categoryTokens) as ReportCategory[]).map((cat) => {
            const token = categoryTokens[cat];
            const isSelected = categoryFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.85}
                style={[
                  styles.filterChip,
                  { backgroundColor: floatingChipBg },
                  hairlineBorder,
                  isSelected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setCategoryFilter(isSelected ? 'all' : cat);
                }}
              >
                <Feather
                  name={token.icon as any}
                  size={13}
                  color={isSelected ? colors.primaryTextOn : token.color}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? colors.primaryTextOn : colors.text },
                  ]}
                >
                  {t(`categories.${cat}Short`, { defaultValue: token.shortLabel })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Subdued Status Legend Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusScroll}
        >
          {(['pending', 'in_progress', 'resolved'] as ReportStatus[]).map((st) => {
            const token = statusTokens[st];
            const active = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                activeOpacity={0.85}
                style={[
                  styles.statusChip,
                  { backgroundColor: floatingChipBg },
                  hairlineBorder,
                  active && {
                    backgroundColor: token.bg,
                    borderColor: token.text,
                  },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setStatusFilter(active ? 'all' : st);
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: token.pin }]} />
                <Text
                  style={[
                    styles.statusChipText,
                    { color: active ? token.text : colors.textSecondary },
                    active && { fontWeight: '700' },
                  ]}
                >
                  {t(`status.${st}`, { defaultValue: token.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* --- MAP VIEW --- */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => {
          if (selectedReport) setSelectedReport(null);
        }}
      >
        {reports.map((report) => {
          const statusToken = statusTokens[report.status] || statusTokens.pending;
          const isSelected = selectedReport?.id === report.id;
          const hasLocation = Boolean(report.location?.latitude && report.location?.longitude);
          if (!hasLocation) return null;

          return (
            <Marker
              key={report.id}
              coordinate={{
                latitude: report.location.latitude,
                longitude: report.location.longitude,
              }}
              onPress={(e) => {
                e.stopPropagation();
                handleMarkerPress(report);
              }}
            >
              <View
                style={[
                  styles.pinOuter,
                  { borderColor: statusToken.pin },
                  isSelected && styles.pinOuterSelected,
                ]}
              >
                <View style={[styles.pinInner, { backgroundColor: statusToken.pin }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* --- FLOATING GPS RECENTER & QUICK REPORT PILLS --- */}
      <View
        style={[
          styles.fabColumn,
          selectedReport ? { bottom: 205 } : { bottom: 24 },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.locateFab, { backgroundColor: colors.card }, hairlineBorder]}
          onPress={centerOnUser}
          accessibilityLabel="Center map on my location"
        >
          <Feather name="crosshair" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* --- ANIMATED BOTTOM SUMMARY CARD (ON MARKER TAP) --- */}
      <Animated.View
        pointerEvents={selectedReport ? 'auto' : 'none'}
        style={[
          styles.bottomSheetContainer,
          {
            opacity: sheetAnim,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        {selectedReport && (
          <View style={[styles.summaryCard, { backgroundColor: colors.card }, hairlineBorder]}>
            {/* Drag Handle Indicator + Close Button */}
            <View style={styles.sheetTopBar}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                onPress={() => setSelectedReport(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.surfaceSubtle }]}
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Preview Body */}
            <View style={[styles.previewRow, rtlRow]}>
              <Image
                source={resolveImageSource(selectedReport.imageUrl)}
                style={[
                  styles.previewThumb,
                  { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
                resizeMode="cover"
              />

              <View style={styles.previewInfo}>
                <View style={[styles.previewBadges, rtlRow]}>
                  <StatusBadge status={selectedReport.status} size="sm" />
                  <CategoryBadge category={selectedReport.category} compact />
                </View>

                <Text
                  style={[
                    styles.previewTitle,
                    { color: colors.text },
                    isRTL && styles.textRight,
                  ]}
                  numberOfLines={2}
                >
                  {selectedReport.title}
                </Text>

                <View style={[styles.previewMetaRow, rtlRow]}>
                  <Text style={[styles.previewMetaText, { color: colors.textMuted }]}>
                    {formatRelativeTime(selectedReport.createdAt)}
                  </Text>
                  {formatDistanceLabel(userCoords, selectedReport.location) ? (
                    <>
                      <Text style={[styles.previewDot, { color: colors.textSubtle }]}>•</Text>
                      <Text style={[styles.previewDistance, { color: colors.accent }]}>
                        {formatDistanceLabel(userCoords, selectedReport.location)}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Action Footer: Upvote Pill + "View Details" CTA */}
            <View
              style={[
                styles.sheetActions,
                { borderTopColor: colors.border },
                rtlRow,
              ]}
            >
              <UpvoteButton
                reportId={selectedReport.id}
                initialCount={selectedReport.upvotesCount || 0}
                hasUpvoted={Boolean(
                  user && (selectedReport.upvotedBy || []).includes(user.uid)
                )}
                currentUserId={user?.uid}
              />

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.detailsCta,
                  { backgroundColor: colors.primary },
                  rtlRow,
                ]}
                onPress={() => {
                  triggerLightHaptic();
                  router.push(`/report/${selectedReport.id}`);
                }}
              >
                <Text style={[styles.detailsCtaText, { color: colors.primaryTextOn }]}>
                  View Details
                </Text>
                <Ionicons
                  name={isRTL ? 'arrow-back' : 'arrow-forward'}
                  size={15}
                  color={colors.primaryTextOn}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  filterOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 14 : 12,
    left: 0,
    right: 0,
    zIndex: 10,
    gap: 8,
  },
  chipsScroll: {
    paddingHorizontal: Spacing.base,
    gap: 8,
  },
  statusScroll: {
    paddingHorizontal: Spacing.base,
    gap: 7,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    gap: 6,
    ...Elevation.ambient,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    gap: 5,
    ...Elevation.subtle,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  statusChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  pinOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.floating,
  },
  pinOuterSelected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3.5,
  },
  pinInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  fabColumn: {
    position: 'absolute',
    right: Spacing.base,
    zIndex: 8,
  },
  locateFab: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.floating,
  },
  bottomSheetContainer: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.base,
    zIndex: 20,
  },
  summaryCard: {
    borderRadius: Radius.card + 4,
    padding: Spacing.md + 2,
    ...Elevation.floating,
  },
  sheetTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: 4,
    borderRadius: Radius.pill,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  previewThumb: {
    width: 78,
    height: 78,
    borderRadius: Radius.thumbnail,
    borderWidth: 1,
  },
  previewInfo: {
    flex: 1,
    gap: 4,
  },
  previewBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  previewTitle: {
    ...Typography.cardTitle,
    fontSize: 15,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewMetaText: {
    ...Typography.micro,
  },
  previewDot: {
    fontSize: 11,
  },
  previewDistance: {
    ...Typography.micro,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm + 2,
    borderTopWidth: 1,
  },
  detailsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8.5,
    borderRadius: Radius.pill,
    gap: 6,
  },
  detailsCtaText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
