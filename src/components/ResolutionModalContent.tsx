/**
 * Shared Resolution Proof Modal Content (`src/components/ResolutionModalContent.tsx`)
 *
 * Used inside role-protected `/employee/resolve-modal` and `/admin/resolve-modal`.
 * Enforces mandatory "After" resolution photo proof uploaded to
 * `reports/{reportId}/resolution_proof/` before status transitions to `resolved`.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { completeReportWithProof, resolveReportWithProof } from '../services/reports';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../constants/theme';
import { MediaUploadBox } from './MediaUploadBox';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { getSafeErrorMessage } from '../utils/errors';
import { resolveImageSource } from '../utils/imageResolver';

export const ResolutionModalContent: React.FC = () => {
  const router = useRouter();
  const { id, title, beforeImage } = useLocalSearchParams<{
    id: string;
    title: string;
    beforeImage: string;
  }>();

  const { user, userProfile, role } = useAuth();
  const { colors, hairlineBorder } = useTheme();

  const [afterImageUri, setAfterImageUri] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [notesFocused, setNotesFocused] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const captureAfterPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to capture resolution proof.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      triggerSuccessHaptic();
      setAfterImageUri(result.assets[0].uri);
    }
  };

  const pickAfterFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery access is required to pick resolution proof.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      triggerSuccessHaptic();
      setAfterImageUri(result.assets[0].uri);
    }
  };

  const handleSubmitResolution = async () => {
    triggerLightHaptic();

    if (!afterImageUri) {
      Alert.alert(
        'Mandatory Proof Missing',
        'Municipal guidelines require an "After" photo before marking an issue resolved.'
      );
      return;
    }

    if (!resolutionNotes.trim()) {
      Alert.alert('Notes Required', 'Please enter official intervention notes.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Session Expired', 'Please sign in again to submit resolution proof.');
      return;
    }

    setIsSubmitting(true);
    try {
      const staffName = userProfile?.displayName || user.displayName || 'Municipal Staff';

      await completeReportWithProof({
        reportId: String(id),
        employeeUid: user.uid,
        employeeName: staffName,
        localAfterImageUri: afterImageUri,
        notes: resolutionNotes,
      });

      triggerSuccessHaptic();
      Alert.alert(
        'Rapport Complété avec Succès',
        'La photo de fin de travaux a été enregistrée avec succès dans le stockage sécurisé.',
        [{ text: 'Terminer', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Validation Refusée', getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Feather name="x" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Resolution</Text>
          <Text style={[styles.claimMicro, { color: colors.emerald }]}>
            Claim: {role.toUpperCase()}
          </Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contextCard, { backgroundColor: colors.card }, hairlineBorder]}>
          {beforeImage ? (
            <Image
              source={resolveImageSource(beforeImage)}
              style={[styles.beforeThumb, { backgroundColor: colors.surfaceSubtle }]}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.contextInfo}>
            <Text style={[styles.contextTag, { color: colors.textMuted }]}>
              RESOLVING INCIDENT
            </Text>
            <Text style={[styles.contextTitle, { color: colors.text }]} numberOfLines={2}>
              {title || id}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            After Intervention Photo
          </Text>
          <View style={[styles.requiredPill, { backgroundColor: colors.emeraldSoft }]}>
            <Text style={[styles.requiredText, { color: colors.emerald }]}>Mandatory Proof</Text>
          </View>
        </View>

        <MediaUploadBox
          imageUri={afterImageUri}
          onCapturePress={captureAfterPhoto}
          onGalleryPress={pickAfterFromGallery}
          onClearPress={() => setAfterImageUri(null)}
          title="Capture Resolution Proof"
          guidanceText="JPEG or PNG up to 5 MB • Stored in protected resolution_proof/"
          badgeLabel="AFTER VERIFICATION"
          accentColor={colors.emerald}
        />

        <View style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Officer Field Notes</Text>
        </View>

        <View style={[styles.notesCard, { backgroundColor: colors.card }, hairlineBorder]}>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: notesFocused ? colors.card : colors.inputBg,
                borderColor: notesFocused ? colors.emerald : colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Summarize municipal work completed (e.g., crew #4 patched asphalt and cleared drain)."
            placeholderTextColor={colors.textSubtle}
            value={resolutionNotes}
            onChangeText={setResolutionNotes}
            onFocus={() => setNotesFocused(true)}
            onBlur={() => setNotesFocused(false)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.resolveBtn,
            { backgroundColor: colors.emerald },
            (!afterImageUri || isSubmitting) && styles.resolveBtnDisabled,
          ]}
          onPress={handleSubmitResolution}
          disabled={!afterImageUri || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <View style={styles.resolveBtnContent}>
              <Ionicons name="checkmark-done-circle" size={20} color={colors.white} />
              <Text style={styles.resolveBtnText}>Marquer comme Complété</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 18 : 14,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.sectionHeader,
    fontSize: 17,
  },
  claimMicro: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  container: {
    padding: Spacing.base,
    paddingBottom: 44,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...Elevation.ambient,
  },
  beforeThumb: {
    width: 60,
    height: 60,
    borderRadius: Radius.input,
  },
  contextInfo: {
    flex: 1,
  },
  contextTag: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  contextTitle: {
    ...Typography.cardTitle,
    fontSize: 14.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm + 2,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  requiredPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notesCard: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    ...Elevation.ambient,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: Radius.input,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 105,
  },
  resolveBtn: {
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.xl,
    ...Elevation.floating,
  },
  resolveBtnDisabled: {
    opacity: 0.45,
  },
  resolveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resolveBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
