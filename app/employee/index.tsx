/**
 * Municipal Worker Dispatch Queue (`app/employee/index.tsx`)
 * Guarded by `app/employee/_layout.tsx` (requires `employee` or `admin` Custom Claim).
 *
 * Regional Isolation:
 * - Scoped strictly to the field worker's `assignedRegion` (Délégation / Mo3tamdiya).
 * - Displays regional badges and restricts status progression to assigned jurisdiction.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { markReportInProgress, subscribeToReports } from '../../src/services/reports';
import { subscribeToUnreadCount } from '../../src/services/notificationService';
import { NotificationsModal } from '../../src/components/NotificationsModal';
import { CivicReport } from '../../src/types/report';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';
import { CategoryBadge } from '../../src/components/CategoryBadge';
import { formatRelativeTime } from '../../src/utils/formatting';
import { hasRegionalAuthority } from '../../src/utils/regionMapper';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

export default function EmployeeDispatchQueueScreen() {
  const router = useRouter();
  const { user, role, assignedRegion, isSuperAdmin, userProfile, logout } = useAuth();
  const { colors, hairlineBorder } = useTheme();
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [showNotifModal, setShowNotifModal] = useState<boolean>(false);

  const handleLogout = async () => {
    triggerLightHaptic();
    await logout();
    router.replace('/(auth)/login');
  };

  const effectiveRegion = assignedRegion || (isSuperAdmin ? 'ALL' : 'Sousse Médina');

  // Guard against suspended municipal employee accounts
  if (!loading && userProfile?.isActive === false) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: Spacing.xl }]}>
        <View style={[styles.suspendedIconBox, { backgroundColor: colors.dangerSoft }]}>
          <Feather name="slash" size={36} color={colors.danger} />
        </View>
        <Text style={[styles.suspendedTitle, { color: colors.text }]}>
          Compte Municipal Suspendu
        </Text>
        <Text style={[styles.suspendedDesc, { color: colors.textMuted }]}>
          Votre accès aux opérations de terrain a été suspendu par l'administration municipale. Vos droits d'intervention et de clôture de réclamations sont révoqués.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleLogout}
          style={[styles.suspendedLogoutBtn, { backgroundColor: colors.danger }]}
        >
          <Feather name="log-out" size={15} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Se Déconnecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  useEffect(() => {
    // 1. Live Firestore query strictly filtered by assigned region
    const unsubReports = subscribeToReports(
      { region: effectiveRegion === 'ALL' ? undefined : effectiveRegion },
      (list) => {
        // Prioritize active open tickets first
        const openQueue = [...list].sort((a, b) => {
          const rank = (s: string) => (s === 'pending' ? 0 : s === 'in_progress' ? 1 : 2);
          return rank(a.status) - rank(b.status);
        });
        setReports(openQueue);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert('Notice d\'accès', getSafeErrorMessage(err));
      }
    );

    // 2. Background / tap notification response listener: deep-link to report detail
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'NEW_REPORT' && data?.reportId) {
        router.push(`/report/${data.reportId}`);
      }
    });

    // 3. Foreground in-app notification alert banner
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const notifTitle = notification.request.content.title || '🚨 Nouveau Signalement dans votre région !';
      const notifBody = notification.request.content.body || '';
      if (data?.type === 'NEW_REPORT') {
        triggerLightHaptic();
        Alert.alert(
          notifTitle,
          notifBody,
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: 'Prendre en charge',
              onPress: () => {
                if (data.reportId) router.push(`/report/${data.reportId}`);
              },
            },
          ]
        );
      }
    });

    return () => {
      unsubReports();
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [effectiveRegion]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadNotifCount(count);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleDispatch = async (report: CivicReport) => {
    if (!hasRegionalAuthority(effectiveRegion, report.region)) {
      triggerWarningHaptic();
      Alert.alert(
        'Secteur non assigné',
        `Cette tâche relève de la délégation de ${report.region}. Votre unité est assignée à ${effectiveRegion}.`
      );
      return;
    }

    triggerLightHaptic();
    setBusyId(report.id);
    try {
      await markReportInProgress(
        report.id,
        user?.uid,
        userProfile?.displayName || 'Agent Municipal'
      );
      triggerSuccessHaptic();
      Alert.alert(
        'Prise en charge confirmée',
        'Vous avez pris en charge ce signalement. Statut mis à jour : En cours.'
      );
    } catch (err) {
      Alert.alert('Action refusée', getSafeErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const activeCount = reports.filter((r) => r.status === 'in_progress').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.summaryBanner,
          { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
        ]}
      >
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <View style={styles.roleBadgeRow}>
            <Text style={[styles.bannerEyebrow, { color: colors.accent }]}>
              AGENT DE TERRAIN : {(userProfile?.displayName || 'CHIHEB').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>
            {effectiveRegion === 'ALL'
              ? 'File d\'Intervention Globale'
              : `Secteur : ${effectiveRegion}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowNotifModal(true)}
              style={[styles.navActionBtn, { backgroundColor: colors.surfaceSubtle }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="notifications-outline" size={13} color={colors.text} />
                <Text style={[styles.navActionText, { color: colors.text }]}>Alertes</Text>
                {unreadNotifCount > 0 && (
                  <View style={[styles.miniBadge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.miniBadgeText}>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)')}
              style={[styles.navActionBtn, { backgroundColor: colors.surfaceSubtle }]}
            >
              <Feather name="eye" size={12} color={colors.primary} />
              <Text style={[styles.navActionText, { color: colors.primary }]}>Fil Citoyen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogout}
              style={[styles.navActionBtn, { backgroundColor: colors.dangerSoft }]}
            >
              <Feather name="log-out" size={12} color={colors.danger} />
              <Text style={[styles.navActionText, { color: colors.danger }]}>Sortir</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.countersRow}>
          <View style={[styles.counterChip, { backgroundColor: colors.warningSoft }]}>
            <Text style={[styles.counterNum, { color: colors.warning }]}>{pendingCount}</Text>
            <Text style={[styles.counterLabel, { color: colors.warning }]}>À traiter</Text>
          </View>
          <View style={[styles.counterChip, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.counterNum, { color: colors.accent }]}>{activeCount}</Text>
            <Text style={[styles.counterLabel, { color: colors.accent }]}>En cours</Text>
          </View>
        </View>
      </View>

      {reports.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.emerald} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun incident en attente</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Aucune réclamation non résolue dans la délégation de {effectiveRegion}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push(`/report/${item.id}`)}
              >
                <View style={styles.pillsRow}>
                  <StatusBadge status={item.status} size="sm" />
                  <CategoryBadge category={item.category} compact />
                  <View style={[styles.regionChip, { backgroundColor: colors.surfaceSubtle }]}>
                    <Ionicons name="location-outline" size={11} color={colors.accent} />
                    <Text style={[styles.regionChipText, { color: colors.accent }]}>
                      {item.region || 'Sousse Médina'}
                    </Text>
                  </View>
                  <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.addrRow}>
                  <Feather name="map-pin" size={12} color={colors.textMuted} />
                  <Text style={[styles.addrText, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.location?.address}
                  </Text>
                </View>
              </TouchableOpacity>

              {item.status !== 'resolved' && item.status !== 'completed' && (
                <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                  {item.status === 'pending' && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.dispatchBtn, { backgroundColor: colors.accent }]}
                      onPress={() => handleDispatch(item)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Feather name="play-circle" size={14} color={colors.white} />
                          <Text style={styles.btnText}>Mettre En Cours (In Progress)</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {item.status === 'in_progress' && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.resolveBtn, { backgroundColor: colors.emerald }]}
                      onPress={() => {
                        if (!hasRegionalAuthority(effectiveRegion, item.region)) {
                          triggerWarningHaptic();
                          Alert.alert(
                            'Secteur non assigné',
                            `Cette intervention relève de la délégation de ${item.region}.`
                          );
                          return;
                        }
                        triggerLightHaptic();
                        router.push({
                          pathname: '/employee/resolve-modal',
                          params: {
                            id: item.id,
                            title: item.title,
                            beforeImage: item.imageUrl,
                          },
                        });
                      }}
                    >
                      <Ionicons name="camera" size={15} color={colors.white} />
                      <Text style={styles.btnText}>Marquer comme Complété (Upload After)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}

      <NotificationsModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        userId={user?.uid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.sectionHeader,
    marginTop: 12,
  },
  emptySubtitle: {
    ...Typography.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    borderBottomWidth: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bannerTitle: {
    ...Typography.sectionHeader,
    fontSize: 17,
    marginTop: 2,
  },
  countersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  counterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.input,
    alignItems: 'center',
    minWidth: 58,
  },
  counterNum: {
    fontSize: 16,
    fontWeight: '700',
  },
  counterLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  list: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: 36,
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.md + 2,
    ...Elevation.ambient,
    gap: Spacing.sm,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    gap: 3,
  },
  regionChipText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  timeText: {
    ...Typography.micro,
    marginLeft: 'auto',
  },
  cardTitle: {
    ...Typography.cardTitle,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  addrText: {
    ...Typography.micro,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  dispatchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.input,
    gap: 6,
  },
  resolveBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.input,
    gap: 6,
  },
  btnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: Radius.pill,
    gap: 4,
  },
  navActionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  miniBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  suspendedIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  suspendedTitle: {
    ...Typography.sectionHeader,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  suspendedDesc: {
    ...Typography.micro,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  suspendedLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
});
