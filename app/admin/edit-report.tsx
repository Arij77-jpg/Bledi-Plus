/**
 * Admin Report Modification & Content Moderation Modal (`app/admin/edit-report.tsx`)
 *
 * Capabilities:
 * 1. Modify report title, description, category, region (Mo3tamdiya), priority, and status override.
 * 2. Content Moderation: Reject/Delete report with required moderation reason:
 *    - Automatically purges evidence/proof files from Firebase Storage
 *    - Records audit trail document in `archived_reports`
 *    - Applies optional citizen karma penalty (-10 points) for spam/abuse
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  getReportById,
  adminUpdateReport,
  deleteReportWithStorageCleanup,
} from '../../src/services/reports';
import {
  CivicReport,
  ReportCategory,
  ReportPriority,
  ReportStatus,
} from '../../src/types/report';
import { SUPPORTED_REGIONS } from '../../src/utils/regionMapper';
import { Typography, Spacing, Radius } from '../../src/constants/theme';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';
import { resolveImageSource } from '../../src/utils/imageResolver';

const CATEGORIES: { id: ReportCategory; label: string; icon: string }[] = [
  { id: 'infrastructure', label: 'Voirie & Route', icon: 'tool' },
  { id: 'sanitation', label: 'Propreté & Déchets', icon: 'trash-2' },
  { id: 'lighting', label: 'Éclairage Public', icon: 'sun' },
  { id: 'water', label: 'Eau & Assainissement', icon: 'droplet' },
  { id: 'other', label: 'Autre Service', icon: 'help-circle' },
];

const PRIORITIES: { id: ReportPriority; label: string; color: string }[] = [
  { id: 'low', label: 'Faible', color: '#10B981' },
  { id: 'medium', label: 'Moyenne', color: '#3B82F6' },
  { id: 'high', label: 'Élevée', color: '#F59E0B' },
  { id: 'critical', label: 'Critique', color: '#EF4444' },
];

const STATUSES: { id: ReportStatus; label: string }[] = [
  { id: 'pending', label: 'En attente' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'resolved', label: 'Résolu' },
];

const MODERATION_REASONS = [
  { id: 'spam', label: 'Spam / Faux signalement', defaultPenalty: true },
  { id: 'inappropriate', label: 'Photo inappropriée ou offensante', defaultPenalty: true },
  { id: 'duplicate', label: 'Doublon / Signalement invalide', defaultPenalty: false },
  { id: 'out_of_scope', label: 'Hors compétence municipale', defaultPenalty: false },
  { id: 'other', label: 'Autre motif administratif', defaultPenalty: false },
];

export default function EditReportScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, hairlineBorder } = useTheme();
  const { user, userProfile } = useAuth();

  const [report, setReport] = useState<CivicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ReportCategory>('infrastructure');
  const [region, setRegion] = useState('Sousse Médina');
  const [priority, setPriority] = useState<ReportPriority>('medium');
  const [status, setStatus] = useState<ReportStatus>('pending');

  // Modals
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(MODERATION_REASONS[0].label);
  const [customReason, setCustomReason] = useState('');
  const [applyKarmaPenalty, setApplyKarmaPenalty] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchReport = async () => {
      try {
        const data = await getReportById(id);
        if (data) {
          setReport(data);
          setTitle(data.title);
          setDescription(data.description);
          setCategory(data.category);
          setRegion(data.region || 'Sousse Médina');
          setPriority(data.priority || 'medium');
          setStatus(data.status);
        }
      } catch (err) {
        Alert.alert('Erreur', getSafeErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const handleSave = async () => {
    if (!report) return;
    if (title.trim().length < 3) {
      triggerWarningHaptic();
      Alert.alert('Titre trop court', 'Le titre doit comporter au moins 3 caractères.');
      return;
    }
    if (description.trim().length < 5) {
      triggerWarningHaptic();
      Alert.alert('Description trop courte', 'La description doit comporter au moins 5 caractères.');
      return;
    }

    triggerLightHaptic();
    setSaving(true);
    try {
      await adminUpdateReport(report.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        region,
        priority,
        status,
      });

      triggerSuccessHaptic();
      Alert.alert('Modifications Enregistrées', 'La réclamation a été mise à jour avec succès.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      triggerWarningHaptic();
      Alert.alert('Erreur de mise à jour', getSafeErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!report) return;
    const finalReason = selectedReason === 'Autre motif administratif' && customReason.trim()
      ? customReason.trim()
      : selectedReason;

    triggerWarningHaptic();
    setDeleting(true);
    try {
      await deleteReportWithStorageCleanup({
        report,
        reason: finalReason,
        adminUid: user?.uid,
        adminName: userProfile?.displayName || 'Admin',
        karmaPenalty: applyKarmaPenalty,
      });

      triggerSuccessHaptic();
      setShowDeleteModal(false);
      Alert.alert(
        'Réclamation Supprimée',
        `Le signalement a été supprimé de la base active et archivé pour le motif : "${finalReason}".\nLes images associées ont été purgées du serveur Storage.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Échec de la suppression', getSafeErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Chargement de la réclamation...
        </Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.danger} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Signalement Introuvable</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: colors.primaryTextOn, fontWeight: '700' }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HEADER SUMMARY */}
        <View style={[styles.headerBanner, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <View style={styles.headerTopRow}>
            <View style={[styles.reportIdBadge, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.reportIdText, { color: colors.textMuted }]}>
                ID: {report.id}
              </Text>
            </View>
            <Text style={[styles.citizenAuthor, { color: colors.textMuted }]}>
              Signalé par : {report.userDisplayName || 'Citoyen'}
            </Text>
          </View>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>
            Édition Administrative & Modération
          </Text>
        </View>

        {/* IMAGE PREVIEW */}
        {report.imageUrl ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={resolveImageSource(report.imageUrl)} style={styles.previewImage} resizeMode="cover" />
            <View style={[styles.imagePathTag, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Feather name="image" size={11} color="#FFF" />
              <Text style={styles.imagePathText}>
                {report.imagePath || 'Preuve citoyenne'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* 1. EDITABLE METADATA */}
        <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
            Informations du Signalement
          </Text>

          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Titre</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Titre clair et précis"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Description Détaillée</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description des faits"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Category Selector Chips */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Catégorie</Text>
            <View style={styles.chipsWrap}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.8}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      styles.choiceChip,
                      { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                      isSelected && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Feather
                      name={cat.icon as any}
                      size={13}
                      color={isSelected ? colors.primaryTextOn : colors.text}
                    />
                    <Text
                      style={[
                        styles.choiceChipText,
                        { color: colors.text },
                        isSelected && { color: colors.primaryTextOn, fontWeight: '700' },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Region / Mo3tamdiya Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Délégation Municipale (Mo3tamdiya)
            </Text>
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
                  {region}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Priority */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Niveau de Priorité</Text>
            <View style={styles.chipsWrap}>
              {PRIORITIES.map((p) => {
                const isSelected = priority === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.8}
                    onPress={() => setPriority(p.id)}
                    style={[
                      styles.priorityChip,
                      { borderColor: p.color },
                      isSelected
                        ? { backgroundColor: p.color }
                        : { backgroundColor: colors.surfaceSubtle },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityChipText,
                        { color: isSelected ? '#FFF' : colors.text },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Status Override */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Statut du Signalement</Text>
            <View style={styles.chipsWrap}>
              {STATUSES.map((s) => {
                const isSelected = status === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.8}
                    onPress={() => setStatus(s.id)}
                    style={[
                      styles.choiceChip,
                      { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                      isSelected && {
                        backgroundColor: colors.accent,
                        borderColor: colors.accent,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        { color: colors.text },
                        isSelected && { color: '#FFF', fontWeight: '700' },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              saving && { opacity: 0.7 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryTextOn} size="small" />
            ) : (
              <>
                <Feather name="save" size={16} color={colors.primaryTextOn} />
                <Text style={[styles.saveBtnText, { color: colors.primaryTextOn }]}>
                  Enregistrer les Modifications
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 2. CONTENT MODERATION & DELETION */}
        <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
          <View style={styles.dangerHeaderRow}>
            <Feather name="alert-triangle" size={18} color={colors.danger} />
            <Text style={[styles.cardSectionTitle, { color: colors.danger }]}>
              Modération & Suppression de Contenu
            </Text>
          </View>

          <Text style={[styles.dangerDesc, { color: colors.textMuted }]}>
            En cas de réclamation inappropriée, de spam ou de fausse alerte, vous pouvez supprimer définitivement ce rapport. Cette action purgera automatiquement les images de Firebase Storage et archivera le motif.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowDeleteModal(true)}
            style={[styles.deleteBtn, { backgroundColor: colors.dangerSoft }]}
          >
            <Feather name="trash-2" size={16} color={colors.danger} />
            <Text style={[styles.deleteBtnText, { color: colors.danger }]}>
              Supprimer / Rejeter la Réclamation
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* REGION PICKER MODAL */}
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
                Changer la Délégation
              </Text>
              <TouchableOpacity onPress={() => setShowRegionPicker(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {SUPPORTED_REGIONS.map((reg) => (
                <TouchableOpacity
                  key={reg.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    setRegion(reg.name);
                    setShowRegionPicker(false);
                  }}
                  style={[
                    styles.regionOption,
                    { borderBottomColor: colors.border },
                    region === reg.name && { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.regionOptionName,
                        { color: colors.text },
                        region === reg.name && { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {reg.name}
                    </Text>
                    <Text style={[styles.regionOptionArabic, { color: colors.textMuted }]}>
                      معتمدية {reg.arabicName}
                    </Text>
                  </View>
                  {region === reg.name && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODERATION REASON & DELETION MODAL */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="alert-triangle" size={20} color={colors.danger} />
                <Text style={[styles.modalTitle, { color: colors.danger }]}>
                  Motif de Suppression
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Veuillez indiquer le motif officiel de suppression. Cette mention sera consignée dans le registre d'audit municipal.
            </Text>

            <View style={styles.reasonsList}>
              {MODERATION_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.label;
                return (
                  <TouchableOpacity
                    key={reason.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedReason(reason.label);
                      setApplyKarmaPenalty(reason.defaultPenalty);
                    }}
                    style={[
                      styles.reasonItem,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSubtle },
                      isSelected && {
                        borderColor: colors.danger,
                        backgroundColor: colors.dangerSoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? colors.danger : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.reasonText,
                        { color: colors.text },
                        isSelected && { color: colors.danger, fontWeight: '700' },
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedReason === 'Autre motif administratif' && (
              <TextInput
                style={[
                  styles.customReasonInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Préciser le motif de suppression..."
                placeholderTextColor={colors.textMuted}
                value={customReason}
                onChangeText={setCustomReason}
              />
            )}

            {/* KARMA PENALTY CHECKBOX */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setApplyKarmaPenalty(!applyKarmaPenalty)}
              style={styles.karmaRow}
            >
              <Ionicons
                name={applyKarmaPenalty ? 'checkbox' : 'square-outline'}
                size={20}
                color={applyKarmaPenalty ? colors.danger : colors.textMuted}
              />
              <Text style={[styles.karmaText, { color: colors.text }]}>
                Pénaliser le score civique du citoyen (-10 points)
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setShowDeleteModal(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textMuted }}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDelete}
                disabled={deleting}
                style={[styles.confirmDeleteBtn, { backgroundColor: colors.danger }]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="trash-2" size={14} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>
                      Supprimer Définitivement
                    </Text>
                  </>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: 12,
  },
  loadingText: {
    ...Typography.micro,
  },
  emptyTitle: {
    ...Typography.sectionHeader,
  },
  backBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
    marginTop: 8,
  },
  headerBanner: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reportIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  reportIdText: {
    fontSize: 11,
    fontWeight: '700',
  },
  citizenAuthor: {
    ...Typography.micro,
  },
  bannerTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  imagePreviewContainer: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    height: 180,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePathTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  imagePathText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  cardSectionTitle: {
    ...Typography.bodyBold,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dangerDesc: {
    ...Typography.micro,
    lineHeight: 18,
    marginBottom: Spacing.md,
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
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  choiceChipText: {
    fontSize: 12,
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  priorityChipText: {
    fontSize: 12,
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
  saveBtn: {
    height: 46,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  saveBtnText: {
    ...Typography.bodyBold,
    fontSize: 14,
  },
  deleteBtn: {
    height: 46,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteBtnText: {
    ...Typography.bodyBold,
    fontSize: 14,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  modalSubtitle: {
    ...Typography.micro,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  reasonsList: {
    gap: 8,
    marginBottom: Spacing.sm,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: 13,
  },
  customReasonInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  karmaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  karmaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  confirmDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  regionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
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
});
