/**
 * Municipal Staff Provisioning & Access Control Screen (`app/admin/manage-staff.tsx`)
 *
 * Capabilities:
 * 1. Provision new municipal workers (`role: 'employee'`) without logging out the active Admin.
 * 2. Assign staff to specific Délégations / Mo3tamdiyas (`assignedRegion`).
 * 3. Immediate account suspension (`isActive: false`) and reactivation.
 * 4. Region reassignment for field crew members.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  createEmployeeAccount,
  subscribeToStaffMembers,
  toggleEmployeeStatus,
  updateEmployeeRegion,
} from '../../src/services/adminProvisioning';
import { StaffMember } from '../../src/types/report';
import { SUPPORTED_REGIONS } from '../../src/utils/regionMapper';
import { Typography, Spacing, Radius } from '../../src/constants/theme';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

export default function ManageStaffScreen() {
  const router = useRouter();
  const { colors, hairlineBorder } = useTheme();
  const { userProfile, assignedRegion, isSuperAdmin } = useAuth();

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRegion, setSelectedRegion] = useState(
    assignedRegion && assignedRegion !== 'ALL' ? assignedRegion : 'Sousse Médina'
  );
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Staff List State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Region Reassignment Modal State
  const [reassignTarget, setReassignTarget] = useState<StaffMember | null>(null);
  const [reassignRegion, setReassignRegion] = useState('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    const unsub = subscribeToStaffMembers(
      (list) => {
        setStaffList(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert('Erreur', getSafeErrorMessage(err));
      }
    );
    return () => unsub();
  }, []);

  const handleCreateStaff = async () => {
    if (!name.trim()) {
      triggerWarningHaptic();
      Alert.alert('Champ requis', 'Veuillez saisir le nom complet de l\'agent.');
      return;
    }
    if (!email.trim()) {
      triggerWarningHaptic();
      Alert.alert('Champ requis', 'Veuillez saisir l\'adresse email officielle.');
      return;
    }

    let staffEmail = email.trim().toLowerCase();
    if (!staffEmail.includes('@')) {
      staffEmail = `${staffEmail}@bledi.employee.tn`;
    }

    if (!staffEmail.endsWith('@bledi.employee.tn') && !staffEmail.endsWith('@bledi.admin.tn')) {
      triggerWarningHaptic();
      Alert.alert(
        'Domaine officiel requis',
        'Les agents municipaux doivent être enregistrés avec une adresse @bledi.employee.tn.'
      );
      return;
    }

    if (password.length < 6) {
      triggerWarningHaptic();
      Alert.alert('Mot de passe trop court', 'Le mot de passe temporaire doit comporter au moins 6 caractères.');
      return;
    }

    triggerLightHaptic();
    setSubmitting(true);
    try {
      const res = await createEmployeeAccount({
        displayName: name.trim(),
        email: staffEmail,
        password: password.trim(),
        assignedRegion: selectedRegion,
      });

      triggerSuccessHaptic();
      Alert.alert(
        'Agent Créé avec Succès !',
        `Le compte municipal pour ${name.trim()} (${res.email}) a été enregistré avec la délégation : ${selectedRegion}.\n\nVotre session administrateur est restée active.`
      );

      // Reset form
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      triggerWarningHaptic();
      Alert.alert('Échec de la création', getSafeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = (staff: StaffMember) => {
    const nextStatus = !staff.isActive;
    const actionLabel = nextStatus ? 'Réactiver' : 'Suspendre';

    triggerWarningHaptic();
    Alert.alert(
      `${actionLabel} l'agent municipal`,
      `Êtes-vous sûr de vouloir ${actionLabel.toLowerCase()} l'accès de ${staff.displayName} (${staff.email}) ?${
        !nextStatus
          ? '\n\nCet agent ne pourra plus accéder aux opérations de terrain ni modifier de réclamations.'
          : ''
      }`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: actionLabel,
          style: nextStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await toggleEmployeeStatus(staff.uid, nextStatus);
              triggerSuccessHaptic();
            } catch (err) {
              Alert.alert('Erreur', getSafeErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const handleOpenReassign = (staff: StaffMember) => {
    triggerLightHaptic();
    setReassignTarget(staff);
    setReassignRegion(staff.assignedRegion || 'Sousse Médina');
  };

  const handleConfirmReassign = async () => {
    if (!reassignTarget || !reassignRegion) return;
    setReassigning(true);
    try {
      await updateEmployeeRegion(reassignTarget.uid, reassignRegion);
      triggerSuccessHaptic();
      Alert.alert(
        'Délégation Réaffectée',
        `${reassignTarget.displayName} est maintenant affecté(e) à la délégation de ${reassignRegion}.`
      );
      setReassignTarget(null);
    } catch (err) {
      Alert.alert('Erreur de réaffectation', getSafeErrorMessage(err));
    } finally {
      setReassigning(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BANNER HEADER */}
        <View style={[styles.headerBanner, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <View style={styles.headerIconRow}>
            <View style={[styles.badgeIcon, { backgroundColor: colors.accentSoft }]}>
              <Feather name="users" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>
                Gestion du Personnel Municipal
              </Text>
              <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>
                Création et contrôle des agents de terrain (Mo3tamdiya)
              </Text>
            </View>
          </View>

          <View style={[styles.securityNotice, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.emerald} />
            <Text style={[styles.securityNoticeText, { color: colors.textMuted }]}>
              Session Admin protégée : l'enregistrement des agents utilise une instance Auth isolée sans déconnexion.
            </Text>
          </View>
        </View>

        {/* 1. ADD EMPLOYEE FORM */}
        <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
          <View style={styles.cardHeaderRow}>
            <Feather name="user-plus" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Ajouter un Nouvel Agent Municipal
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Nom Complet</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="ex: Chiheb Ben Mansour"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Email Professionnel</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="ex: prenom.nom@bledi.employee.tn"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Mot de Passe Temporaire</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="Min. 6 caractères"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Délégation / Mo3tamdiya Assignée</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowRegionPicker(true)}
              style={[
                styles.regionPickerBtn,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location-sharp" size={16} color={colors.accent} />
                <Text style={[styles.regionPickerText, { color: colors.text }]}>
                  {selectedRegion}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreateStaff}
            disabled={submitting}
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              submitting && { opacity: 0.7 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryTextOn} size="small" />
            ) : (
              <>
                <Feather name="user-check" size={16} color={colors.primaryTextOn} />
                <Text style={[styles.submitBtnText, { color: colors.primaryTextOn }]}>
                  Créer le Compte Agent
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 2. STAFF ROSTER LIST */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Agents Municipaux Enregistrés ({staffList.length})
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
            Supervision du statut d'accès et des secteurs d'intervention
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Chargement du personnel...
            </Text>
          </View>
        ) : staffList.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card }, hairlineBorder]}>
            <Feather name="user-x" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Aucun agent enregistré
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Utilisez le formulaire ci-dessus pour ajouter le premier agent de terrain.
            </Text>
          </View>
        ) : (
          staffList.map((staff) => (
            <View
              key={staff.uid}
              style={[
                styles.staffCard,
                { backgroundColor: colors.card },
                hairlineBorder,
                !staff.isActive && { borderLeftColor: colors.danger, borderLeftWidth: 4 },
              ]}
            >
              <View style={styles.staffCardTop}>
                <View style={styles.staffInfoCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.staffName, { color: colors.text }]}>
                      {staff.displayName}
                    </Text>
                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: staff.isActive ? colors.emeraldSoft : colors.dangerSoft,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: staff.isActive ? colors.emerald : colors.danger },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: staff.isActive ? colors.emerald : colors.danger },
                        ]}
                      >
                        {staff.isActive ? 'Actif' : 'Suspendu'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.staffEmail, { color: colors.textMuted }]}>
                    {staff.email}
                  </Text>

                  {/* Region badge */}
                  <View style={styles.regionBadgeRow}>
                    <View style={[styles.regionBadge, { backgroundColor: colors.surfaceSubtle }]}>
                      <Ionicons name="location-sharp" size={12} color={colors.accent} />
                      <Text style={[styles.regionBadgeText, { color: colors.accent }]}>
                        {staff.assignedRegion || 'Sousse Médina'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ACTION BUTTONS */}
              <View style={[styles.staffActionsRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenReassign(staff)}
                  style={[styles.staffActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                >
                  <Feather name="map-pin" size={13} color={colors.primary} />
                  <Text style={[styles.staffActionBtnText, { color: colors.primary }]}>
                    Changer Délégation
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleToggleStatus(staff)}
                  style={[
                    styles.staffActionBtn,
                    {
                      backgroundColor: staff.isActive ? colors.dangerSoft : colors.emeraldSoft,
                    },
                  ]}
                >
                  <Feather
                    name={staff.isActive ? 'slash' : 'check-circle'}
                    size={13}
                    color={staff.isActive ? colors.danger : colors.emerald}
                  />
                  <Text
                    style={[
                      styles.staffActionBtnText,
                      { color: staff.isActive ? colors.danger : colors.emerald },
                    ]}
                  >
                    {staff.isActive ? 'Suspendre' : 'Réactiver'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 3. MODAL: REGION PICKER FOR REGISTRATION */}
      <Modal
        visible={showRegionPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRegionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Sélectionner la Délégation
              </Text>
              <TouchableOpacity
                onPress={() => setShowRegionPicker(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {SUPPORTED_REGIONS.map((reg) => (
                <TouchableOpacity
                  key={reg.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRegion(reg.name);
                    setShowRegionPicker(false);
                  }}
                  style={[
                    styles.regionOption,
                    { borderBottomColor: colors.border },
                    selectedRegion === reg.name && { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.regionOptionName,
                        { color: colors.text },
                        selectedRegion === reg.name && { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {reg.name}
                    </Text>
                    <Text style={[styles.regionOptionArabic, { color: colors.textMuted }]}>
                      معتمدية {reg.arabicName}
                    </Text>
                  </View>
                  {selectedRegion === reg.name && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. MODAL: REASSIGN STAFF REGION */}
      <Modal
        visible={reassignTarget !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReassignTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Réaffecter la Délégation
              </Text>
              <TouchableOpacity
                onPress={() => setReassignTarget(null)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.reassignTargetDesc, { color: colors.textMuted }]}>
              Agent : <Text style={{ color: colors.text, fontWeight: '700' }}>{reassignTarget?.displayName}</Text>
            </Text>

            <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
              {SUPPORTED_REGIONS.map((reg) => (
                <TouchableOpacity
                  key={reg.id}
                  activeOpacity={0.7}
                  onPress={() => setReassignRegion(reg.name)}
                  style={[
                    styles.regionOption,
                    { borderBottomColor: colors.border },
                    reassignRegion === reg.name && { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.regionOptionName,
                        { color: colors.text },
                        reassignRegion === reg.name && { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {reg.name}
                    </Text>
                    <Text style={[styles.regionOptionArabic, { color: colors.textMuted }]}>
                      معتمدية {reg.arabicName}
                    </Text>
                  </View>
                  {reassignRegion === reg.name && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.reassignActionRow}>
              <TouchableOpacity
                onPress={() => setReassignTarget(null)}
                style={[styles.reassignCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textMuted }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmReassign}
                disabled={reassigning}
                style={[styles.reassignConfirmBtn, { backgroundColor: colors.primary }]}
              >
                {reassigning ? (
                  <ActivityIndicator size="small" color={colors.primaryTextOn} />
                ) : (
                  <Text style={{ color: colors.primaryTextOn, fontWeight: '700' }}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerBanner: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    ...Typography.sectionHeader,
    fontSize: 17,
  },
  bannerSubtitle: {
    ...Typography.micro,
    marginTop: 2,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  securityNoticeText: {
    ...Typography.micro,
    flex: 1,
    lineHeight: 16,
  },
  card: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.bodyBold,
    fontSize: 15,
  },
  formGroup: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.micro,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  regionPickerBtn: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regionPickerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  submitBtnText: {
    ...Typography.bodyBold,
    fontSize: 14,
  },
  sectionHeader: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  sectionSub: {
    ...Typography.micro,
    marginTop: 2,
  },
  centerBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    ...Typography.micro,
  },
  emptyBox: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    ...Typography.bodyBold,
  },
  emptyDesc: {
    ...Typography.micro,
    textAlign: 'center',
  },
  staffCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  staffCardTop: {
    padding: Spacing.md,
  },
  staffInfoCol: {
    flex: 1,
    gap: 4,
  },
  staffName: {
    ...Typography.bodyBold,
    fontSize: 15,
  },
  staffEmail: {
    ...Typography.micro,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  regionBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  regionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  staffActionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  staffActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  staffActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  regionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
  },
  regionOptionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  regionOptionArabic: {
    fontSize: 12,
    marginTop: 2,
  },
  reassignTargetDesc: {
    ...Typography.micro,
    fontSize: 13,
  },
  reassignActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  reassignCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  reassignConfirmBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
});
