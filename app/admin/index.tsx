/**
 * Multi-Tenant Municipal Admin Governance Console (`app/admin/index.tsx`)
 * Guarded strictly by `app/admin/_layout.tsx` (Custom Claim `role === 'admin'`).
 *
 * Regional Isolation & Zero-Trust Features:
 * - Scoped strictly to the administrator's `assignedRegion` (Délégation / Mo3tamdiya).
 * - Super-Admins (`isSuperAdmin: true` or `assignedRegion === 'ALL'`) can view and filter across all regions.
 * - Live real-time incoming report listener triggers local audio & banner notifications (`scheduleLocalIncidentAlert`).
 * - Enforces client-side & server-side regional authority checks before triage, assignment, or deletion.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import {
  deleteReport,
  subscribeToReports,
  updateReportTriage,
} from '../../src/services/reports';
import {
  registerForPushNotificationsAsync,
  scheduleLocalIncidentAlert,
  subscribeToUnreadCount,
} from '../../src/services/notificationService';
import { NotificationsModal } from '../../src/components/NotificationsModal';
import { CivicReport, ReportPriority } from '../../src/types/report';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';
import {
  SUPPORTED_REGIONS,
  SUPER_ADMIN_REGION,
  hasRegionalAuthority,
} from '../../src/utils/regionMapper';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

const PRIORITIES: ReportPriority[] = ['low', 'medium', 'high', 'critical'];

export default function AdminConsoleScreen() {
  const router = useRouter();
  const { user, userProfile, assignedRegion, isSuperAdmin, isDemoMode, switchDemoRegion, logout } = useAuth();
  const { colors, hairlineBorder } = useTheme();

  const handleLogout = async () => {
    triggerLightHaptic();
    await logout();
    router.replace('/(auth)/login');
  };

  // Regional filter state: defaults to admin's assigned region, or 'ALL' if Super-Admin
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>(
    isSuperAdmin ? SUPER_ADMIN_REGION : assignedRegion || 'Sousse Médina'
  );

  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [showNotifModal, setShowNotifModal] = useState<boolean>(false);

  // Track initial report IDs to alert ONLY on newly created incoming reports
  const initialLoadCompletedRef = useRef(false);
  const knownReportIdsRef = useRef<Set<string>>(new Set());

  // Listen to unread notifications count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadNotifCount(count);
    });
    return () => unsub();
  }, [user?.uid]);

  // Keep filter synced if assignedRegion changes in context
  useEffect(() => {
    if (!isSuperAdmin && assignedRegion) {
      setSelectedRegionFilter(assignedRegion);
    }
  }, [assignedRegion, isSuperAdmin]);

  // Register for push notifications on mount
  useEffect(() => {
    if (user?.uid) {
      registerForPushNotificationsAsync(user.uid, assignedRegion);
    }
  }, [user?.uid, assignedRegion]);

  // Subscribe to real-time reports matching regional scope
  useEffect(() => {
    setLoading(true);
    const filterOption = selectedRegionFilter === SUPER_ADMIN_REGION ? undefined : selectedRegionFilter;

    const unsub = subscribeToReports(
      { region: filterOption },
      (list) => {
        // Detect newly incoming pending reports in this jurisdiction for audio/banner alert
        if (initialLoadCompletedRef.current) {
          list.forEach((rep) => {
            if (
              !knownReportIdsRef.current.has(rep.id) &&
              rep.status === 'pending' &&
              hasRegionalAuthority(assignedRegion || selectedRegionFilter, rep.region)
            ) {
              scheduleLocalIncidentAlert(rep);
            }
          });
        }

        // Update known IDs
        knownReportIdsRef.current = new Set(list.map((r) => r.id));
        initialLoadCompletedRef.current = true;

        setReports(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert('Erreur d\'accès', getSafeErrorMessage(err));
      }
    );

    return () => unsub();
  }, [selectedRegionFilter, assignedRegion]);

  const effectiveAdminRegion = assignedRegion || (isSuperAdmin ? SUPER_ADMIN_REGION : 'Sousse Médina');

  const handleCyclePriority = async (report: CivicReport) => {
    if (!hasRegionalAuthority(effectiveAdminRegion, report.region)) {
      triggerWarningHaptic();
      Alert.alert(
        'Action Non Autorisée',
        `Cette réclamation relève de la délégation de ${report.region}. Votre autorité administrative est limitée à ${effectiveAdminRegion}.`
      );
      return;
    }

    triggerLightHaptic();
    const currentIdx = PRIORITIES.indexOf(report.priority || 'medium');
    const nextPriority = PRIORITIES[(currentIdx + 1) % PRIORITIES.length];
    try {
      await updateReportTriage({ reportId: report.id, priority: nextPriority });
      triggerSuccessHaptic();
    } catch (err) {
      Alert.alert('Modification refusée', getSafeErrorMessage(err));
    }
  };

  const handleAssignFieldCrew = async (report: CivicReport) => {
    if (!hasRegionalAuthority(effectiveAdminRegion, report.region)) {
      triggerWarningHaptic();
      Alert.alert(
        'Action Non Autorisée',
        `Cette réclamation relève de la délégation de ${report.region}.`
      );
      return;
    }

    triggerLightHaptic();
    try {
      await updateReportTriage({
        reportId: report.id,
        assignedTo: 'demo_employee_uid',
        assignedToName: `Chiheb (Agent Municipal - ${report.region})`,
      });
      triggerSuccessHaptic();
      Alert.alert('Équipe assignée', `Assignée à Chiheb (Agent Municipal - ${report.region}).`);
    } catch (err) {
      Alert.alert('Assignation refusée', getSafeErrorMessage(err));
    }
  };

  const handleDelete = (report: CivicReport) => {
    if (!hasRegionalAuthority(effectiveAdminRegion, report.region)) {
      triggerWarningHaptic();
      Alert.alert(
        'Suppression Non Autorisée',
        `Vous ne disposez pas des privilèges d'administration sur le secteur de ${report.region}.`
      );
      return;
    }

    triggerWarningHaptic();
    Alert.alert(
      'Modération & Suppression',
      `Ouvrir l'écran de modération pour consigner le motif de suppression et purger les images de Storage ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ouvrir Modération',
          style: 'destructive',
          onPress: () => router.push({ pathname: '/admin/edit-report', params: { id: report.id } }),
        },
      ]
    );
  };

  const handleSwitchDemoRegion = async (newRegion: string) => {
    triggerLightHaptic();
    setSelectedRegionFilter(newRegion);
    if (isDemoMode && switchDemoRegion) {
      await switchDemoRegion(newRegion);
    }
  };

  const currentArabicName = useMemo(() => {
    return SUPPORTED_REGIONS.find((r) => r.name === selectedRegionFilter)?.arabicName || '';
  }, [selectedRegionFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. REGIONAL WORKSPACE HEADER BANNER */}
      <View
        style={[
          styles.workspaceBanner,
          { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.workspaceTopRow}>
          <View style={[styles.govBadge, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="shield-checkmark" size={15} color={colors.accent} />
            <Text style={[styles.govBadgeText, { color: colors.accent }]}>
              {isSuperAdmin || assignedRegion === 'ALL'
                ? 'SUPER-ADMIN'
                : 'ADMIN : ARIJ'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
              onPress={() => router.push('/admin/manage-staff')}
              style={[styles.navActionBtn, { backgroundColor: colors.accentSoft }]}
            >
              <Feather name="users" size={12} color={colors.accent} />
              <Text style={[styles.navActionText, { color: colors.accent, fontWeight: '700' }]}>Personnel</Text>
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

        <Text style={[styles.workspaceTitle, { color: colors.text }]}>
          {selectedRegionFilter === SUPER_ADMIN_REGION
            ? 'Toutes les Délégations Municipales'
            : `Délégation de ${selectedRegionFilter}`}
        </Text>
        {currentArabicName ? (
          <Text style={[styles.workspaceSubtitle, { color: colors.textMuted }]}>
            معتمدية {currentArabicName}
          </Text>
        ) : (
          <Text style={[styles.workspaceSubtitle, { color: colors.textMuted }]}>
            Isolation Multi-Tenant par Mo3tamdiya
          </Text>
        )}

        {/* 2. REGIONAL SWITCHER CHIPS (Available for Super-Admin or in Demo Mode) */}
        {(isSuperAdmin || isDemoMode) && (
          <View style={styles.regionSelectorSection}>
            <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>
              {isDemoMode ? 'Démonstration Multi-Tenant (Changer de Délégation) :' : 'Filtrer par Délégation :'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSwitchDemoRegion(SUPER_ADMIN_REGION)}
                style={[
                  styles.regionChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedRegionFilter === SUPER_ADMIN_REGION && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.regionChipText,
                    { color: colors.text },
                    selectedRegionFilter === SUPER_ADMIN_REGION && { color: colors.primaryTextOn, fontWeight: '700' },
                  ]}
                >
                  Toutes (ALL)
                </Text>
              </TouchableOpacity>

              {SUPPORTED_REGIONS.map((reg) => {
                const isSelected = selectedRegionFilter === reg.name;
                return (
                  <TouchableOpacity
                    key={reg.id}
                    activeOpacity={0.8}
                    onPress={() => handleSwitchDemoRegion(reg.name)}
                    style={[
                      styles.regionChip,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      isSelected && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.regionChipText,
                        { color: colors.text },
                        isSelected && { color: colors.primaryTextOn, fontWeight: '700' },
                      ]}
                    >
                      {reg.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 3. REPORT INCIDENTS LIST */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Chargement des réclamations de {selectedRegionFilter}...
          </Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.emerald} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun incident en cours</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Toutes les réclamations pour la délégation de {selectedRegionFilter} ont été traitées.
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
                <View style={styles.topRow}>
                  <StatusBadge status={item.status} size="sm" />
                  <View style={[styles.regionBadge, { backgroundColor: colors.surfaceSubtle }]}>
                    <Ionicons name="location-sharp" size={11} color={colors.accent} />
                    <Text style={[styles.regionBadgeText, { color: colors.accent }]}>
                      {item.region || 'Sousse Médina'}
                    </Text>
                  </View>
                  <View style={[styles.priorityChip, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={[styles.priorityText, { color: colors.primary }]}>
                      {(item.priority || 'medium').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.votesText, { color: colors.textMuted }]}>
                    {item.upvotesCount || 0} votes
                  </Text>
                </View>

                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>

                <View style={styles.metaRow}>
                  <Feather name="map-pin" size={11} color={colors.textMuted} />
                  <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.location?.address}
                  </Text>
                </View>

                <Text style={[styles.assigneeText, { color: colors.textMuted }]}>
                  Affectation : {item.assignedToName || 'Non affecté'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.adminActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle }]}
                  onPress={() => router.push({ pathname: '/admin/edit-report', params: { id: item.id } })}
                >
                  <Feather name="edit-3" size={13} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Éditer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle }]}
                  onPress={() => handleCyclePriority(item)}
                >
                  <Feather name="sliders" size={13} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Priorité</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle }]}
                  onPress={() => handleAssignFieldCrew(item)}
                >
                  <Feather name="user-check" size={13} color={colors.accent} />
                  <Text style={[styles.actionText, { color: colors.accent }]}>Équipe</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.actionBtn, { backgroundColor: colors.dangerSoft }]}
                  onPress={() => handleDelete(item)}
                >
                  <Feather name="trash-2" size={13} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Modérer</Text>
                </TouchableOpacity>
              </View>
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
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.micro,
    marginTop: 8,
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
  workspaceBanner: {
    padding: Spacing.base,
    borderBottomWidth: 1,
  },
  workspaceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  govBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    gap: 5,
  },
  govBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  workspaceTitle: {
    ...Typography.sectionHeader,
    fontSize: 18,
  },
  workspaceSubtitle: {
    ...Typography.micro,
    fontSize: 12.5,
    marginTop: 2,
  },
  regionSelectorSection: {
    marginTop: Spacing.md,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipsScroll: {
    gap: 6,
    paddingBottom: 2,
  },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  list: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.md + 2,
    ...Elevation.ambient,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
    gap: 3,
  },
  regionBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  priorityChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
  },
  priorityText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  votesText: {
    ...Typography.micro,
    marginLeft: 'auto',
  },
  cardTitle: {
    ...Typography.cardTitle,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    ...Typography.micro,
    flex: 1,
  },
  assigneeText: {
    ...Typography.micro,
    marginTop: 3,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.input,
    gap: 5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
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
});
