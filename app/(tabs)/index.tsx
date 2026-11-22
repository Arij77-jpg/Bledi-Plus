/**
 * Civic Priority Feed Screen (`app/(tabs)/index.tsx`)
 *
 * Uses modern layered surfaces, shimmer skeletons, compact ReportCard rows,
 * live distance calculation, and contextual empty states.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
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
  Typography,
  Spacing,
  Radius,
  Elevation,
} from '../../src/constants/theme';
import { ReportCard } from '../../src/components/ReportCard';
import { ReportCardSkeletonList } from '../../src/components/ReportCardSkeleton';
import { Coordinates } from '../../src/utils/formatting';
import { triggerSelectionHaptic, triggerLightHaptic } from '../../src/utils/haptics';

export default function FeedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, role, userProfile } = useAuth();
  const { colors, categoryTokens, statusTokens } = useTheme();
  const { isRTL } = usePreferences();

  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'priority' | 'recent'>('priority');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('all');
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToReports(
      { category: selectedCategory, status: selectedStatus },
      (updatedList) => {
        setReports(updatedList);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch (_) {}
    })();
  }, []);

  const sortedReports = [...reports].sort((a, b) => {
    if (sortBy === 'priority') {
      return (b.upvotesCount || 0) - (a.upvotesCount || 0);
    }
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });

  const handleClearFilters = () => {
    triggerLightHaptic();
    setSelectedCategory('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedStatus !== 'all';
  const rtlRow = isRTL ? styles.rowReverse : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Staff Quick-Access Workspace Banner */}
      {role === 'admin' && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/admin')}
          style={[
            styles.staffBanner,
            { backgroundColor: colors.emeraldSoft, borderBottomColor: colors.emerald },
            rtlRow,
          ]}
        >
          <Ionicons name="shield-checkmark" size={20} color={colors.emerald} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.staffBannerTitle, { color: colors.emerald }]}>
              Connecté : Arij (Administratrice Municipale)
            </Text>
            <Text style={[styles.staffBannerAction, { color: colors.text }]}>
              Ouvrir le Panneau d'Administration Bledi+ ➔
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {role === 'employee' && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/employee')}
          style={[
            styles.staffBanner,
            { backgroundColor: colors.accentSoft, borderBottomColor: colors.accent },
            rtlRow,
          ]}
        >
          <Feather name="truck" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.staffBannerTitle, { color: colors.accent }]}>
              Connecté : Chiheb (Agent de Terrain)
            </Text>
            <Text style={[styles.staffBannerAction, { color: colors.text }]}>
              Ouvrir la File d'Intervention des Travaux ➔
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Sticky Filter & Sort Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
        ]}
      >
        {/* Segmented Control: Priority vs Recent */}
        <View
          style={[
            styles.segmentedTrack,
            { backgroundColor: colors.surfaceSubtle },
            rtlRow,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.segmentBtn,
              rtlRow,
              sortBy === 'priority' && { backgroundColor: colors.primary, ...Elevation.subtle },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setSortBy('priority');
            }}
          >
            <Feather
              name="trending-up"
              size={14}
              color={sortBy === 'priority' ? colors.primaryTextOn : colors.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                { color: sortBy === 'priority' ? colors.primaryTextOn : colors.textMuted },
              ]}
            >
              {t('actions.topPriority')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.segmentBtn,
              rtlRow,
              sortBy === 'recent' && { backgroundColor: colors.primary, ...Elevation.subtle },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setSortBy('recent');
            }}
          >
            <Feather
              name="clock"
              size={14}
              color={sortBy === 'recent' ? colors.primaryTextOn : colors.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                { color: sortBy === 'recent' ? colors.primaryTextOn : colors.textMuted },
              ]}
            >
              {t('actions.mostRecent')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Category Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.filterChip,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedCategory === 'all' && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setSelectedCategory('all');
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    selectedCategory === 'all'
                      ? colors.primaryTextOn
                      : colors.textSecondary,
                },
              ]}
            >
              {t('categories.all')}
            </Text>
          </TouchableOpacity>

          {(Object.keys(categoryTokens) as ReportCategory[]).map((cat) => {
            const token = categoryTokens[cat];
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isSelected && {
                    backgroundColor: token.bg,
                    borderColor: token.color,
                  },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setSelectedCategory(isSelected ? 'all' : cat);
                }}
              >
                <Feather
                  name={token.icon as any}
                  size={12.5}
                  color={isSelected ? token.color : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? token.color : colors.textSecondary },
                    isSelected && { fontWeight: '700' },
                  ]}
                >
                  {t(`categories.${cat}Short`, { defaultValue: token.shortLabel })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Subtle Status Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilterRow}
        >
          {(['pending', 'in_progress', 'resolved'] as ReportStatus[]).map((st) => {
            const token = statusTokens[st];
            const active = selectedStatus === st;
            return (
              <TouchableOpacity
                key={st}
                activeOpacity={0.8}
                style={[
                  styles.statusPill,
                  { backgroundColor: colors.surfaceSubtle },
                  active && { backgroundColor: token.bg, borderColor: token.border },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setSelectedStatus(active ? 'all' : st);
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: token.dot }]} />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: active ? token.text : colors.textMuted },
                    active && { fontWeight: '600' },
                  ]}
                >
                  {t(`status.${st}`, { defaultValue: token.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <ReportCardSkeletonList count={4} />
      ) : sortedReports.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSoft }]}>
            <Feather
              name={hasActiveFilters ? 'filter' : 'check-circle'}
              size={28}
              color={colors.accent}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {hasActiveFilters ? 'No matching reports' : 'بلادي+ • Bledi+'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {hasActiveFilters
              ? 'No civic incidents match your active category or status filters.'
              : 'تصويرة منّك، وبلادنا تزيان بينا — ساهم في تحسين حيك واكسب نقاط المواطنة الإيجابية.'}
          </Text>

          {hasActiveFilters ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={handleClearFilters}
            >
              <Feather name="rotate-ccw" size={14} color={colors.primaryTextOn} />
              <Text style={[styles.emptyBtnText, { color: colors.primaryTextOn }]}>
                Reset All Filters
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                triggerLightHaptic();
                router.push('/(tabs)/new-report');
              }}
            >
              <Ionicons name="add" size={16} color={colors.primaryTextOn} />
              <Text style={[styles.emptyBtnText, { color: colors.primaryTextOn }]}>
                Report an Issue
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={sortedReports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReportCard
              report={item}
              currentUserId={user?.uid}
              userCoords={userCoords}
              onPress={(rep) => router.push(`/report/${rep.id}`)}
            />
          )}
          ListHeaderComponent={
            <View style={[styles.listHeader, rtlRow]}>
              <Text style={[styles.listCountText, { color: colors.textMuted }]}>
                {sortedReports.length}{' '}
                {sortedReports.length === 1 ? 'active report' : 'active reports'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleClearFilters}>
                  <Text style={[styles.clearLink, { color: colors.accent }]}>
                    Clear filters
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              onRefresh={() => {
                triggerLightHaptic();
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 500);
              }}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm + 2,
    borderBottomWidth: 1,
    ...Elevation.subtle,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  segmentedTrack: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    borderRadius: Radius.input,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.input - 2,
    gap: 6,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipsRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    gap: 5,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  statusFilterRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: 7,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: 36,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  listCountText: {
    ...Typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearLink: {
    ...Typography.micro,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    ...Typography.sectionHeader,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.pill,
    marginTop: Spacing.lg,
    gap: 6,
    ...Elevation.ambient,
  },
  emptyBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  staffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  staffBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  staffBannerAction: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
});
