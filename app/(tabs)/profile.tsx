/**
 * Civic Profile, Verified Claims & Role Workspaces Screen (`app/(tabs)/profile.tsx`)
 *
 * Security Improvements:
 * - Zero client-side role switching (`toggleRole` completely removed)
 * - Displays verified Firebase Custom Claims role (`citizen` / `employee` / `admin`)
 * - Allows safe own-profile displayName update matching `firestore.rules`
 * - Exposes protected workspace navigation (`/employee`, `/admin`) strictly for authorized claims
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  AlertButton,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import { UserRole } from '../../src/types/report';
import { resolveImageSource } from '../../src/utils/imageResolver';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../../src/constants/theme';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark, hairlineBorder } = useTheme();
  const { isRTL } = usePreferences();
  const {
    user,
    userProfile,
    role,
    claimsVerified,
    isStaff,
    isAdmin,
    logout,
    refreshClaims,
    updateOwnDisplayName,
    updateOwnAvatar,
    removeOwnAvatar,
  } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleLaunchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "L'accès à l'appareil photo est nécessaire.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await handleProcessAvatarUpload(result.assets[0].uri);
    }
  };

  const handleLaunchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "L'accès à la galerie photos est nécessaire.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await handleProcessAvatarUpload(result.assets[0].uri);
    }
  };

  const handleProcessAvatarUpload = async (uri: string) => {
    setUploadingAvatar(true);
    triggerLightHaptic();
    try {
      await updateOwnAvatar(uri);
      triggerSuccessHaptic();
      Alert.alert('Photo mise à jour', 'Votre photo de profil a été enregistrée avec succès.');
    } catch (err) {
      Alert.alert('Erreur', getSafeErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingAvatar(true);
    triggerLightHaptic();
    try {
      await removeOwnAvatar();
      triggerSuccessHaptic();
      Alert.alert('Photo supprimée', 'Votre photo de profil a été réinitialisée.');
    } catch (err) {
      Alert.alert('Erreur', getSafeErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarPress = () => {
    triggerLightHaptic();
    const hasExistingPhoto = Boolean(userProfile?.photoURL || user?.photoURL);

    const buttons: AlertButton[] = [
      {
        text: 'Prendre une photo (Caméra)',
        onPress: handleLaunchCamera,
      },
      {
        text: 'Choisir depuis la galerie',
        onPress: handleLaunchGallery,
      },
    ];

    if (hasExistingPhoto) {
      buttons.push({
        text: 'Supprimer la photo',
        style: 'destructive',
        onPress: handleRemovePhoto,
      });
    }

    buttons.push({
      text: 'Annuler',
      style: 'cancel',
    });

    Alert.alert(
      'Photo de Profil (تصويرة البروفيل)',
      'Personnalisez votre compte en ajoutant ou modifiant votre photo.',
      buttons
    );
  };

  const roleBadgeMap: Record<
    UserRole,
    { label: string; bg: string; text: string; icon: 'user' | 'truck' | 'shield' }
  > = {
    civil: {
      label: 'Citoyen Bledi+',
      bg: colors.surfaceSubtle,
      text: colors.textSecondary,
      icon: 'user' as const,
    },
    citizen: {
      label: 'Citoyen Bledi+',
      bg: colors.surfaceSubtle,
      text: colors.textSecondary,
      icon: 'user' as const,
    },
    employee: {
      label: 'Agent Municipal',
      bg: colors.accentSoft,
      text: colors.accent,
      icon: 'truck' as const,
    },
    admin: {
      label: 'Administrateur',
      bg: colors.emeraldSoft,
      text: colors.emerald,
      icon: 'shield' as const,
    },
  };

  const points = userProfile?.points || 0;
  const badge = userProfile?.badge || 'Novice Watcher';
  const nextTierPoints = points < 50 ? 50 : points < 150 ? 150 : 300;
  const progressPercent = Math.min(100, Math.round((points / nextTierPoints) * 100));
  const roleBadge = roleBadgeMap[role];

  const handleSaveName = async () => {
    triggerLightHaptic();
    setSavingName(true);
    try {
      await updateOwnDisplayName(nameInput);
      triggerSuccessHaptic();
      setEditingName(false);
      Alert.alert('Profile Updated', 'Your display name has been saved.');
    } catch (err) {
      Alert.alert('Update Denied', getSafeErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const handleRefreshClaims = async () => {
    triggerLightHaptic();
    try {
      const latestRole = await refreshClaims();
      triggerSuccessHaptic();
      Alert.alert('Token Refreshed', `Verified token role claim: "${latestRole}".`);
    } catch (err) {
      Alert.alert('Token Refresh Error', getSafeErrorMessage(err));
    }
  };

  const handleLogout = async () => {
    triggerLightHaptic();
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (err) {
      Alert.alert('Sign Out Error', getSafeErrorMessage(err));
    }
  };

  const initials = (userProfile?.displayName || user?.displayName || 'C')
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() || '')
    .join('');

  const rtlRow = isRTL ? styles.rowReverse : undefined;
  const rtlText = isRTL ? styles.textRight : undefined;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Identity Card */}
      <View style={[styles.identityCard, { backgroundColor: colors.card }, hairlineBorder, rtlRow]}>
        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleAvatarPress}
            disabled={uploadingAvatar}
            accessibilityRole="button"
            accessibilityLabel="Modifier la photo de profil"
            style={[styles.avatarTouchTarget, { borderColor: colors.border }]}
          >
            {userProfile?.photoURL || user?.photoURL ? (
              <Image
                source={resolveImageSource(userProfile?.photoURL || user?.photoURL)}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primaryTextOn }]}>
                  {initials || 'C'}
                </Text>
              </View>
            )}

            {uploadingAvatar && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}

            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: colors.primary, borderColor: colors.card },
              ]}
            >
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.identityInfo}>
          {editingName ? (
            <View style={[styles.editRow, rtlRow]}>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    borderColor: colors.borderFocus,
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                  },
                ]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Full Name"
                placeholderTextColor={colors.textSubtle}
              />
              <TouchableOpacity
                style={[styles.saveChip, { backgroundColor: colors.primary }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                <Text style={[styles.saveChipText, { color: colors.primaryTextOn }]}>
                  {savingName ? '...' : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.nameRow, rtlRow]}>
              <Text style={[styles.displayName, { color: colors.text }]}>
                {userProfile?.displayName || 'Citizen'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNameInput(userProfile?.displayName || '');
                  setEditingName(true);
                }}
              >
                <Feather name="edit-2" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.emailText, { color: colors.textMuted }, rtlText]}>
            {user?.email || 'citizen@municipality.gov'}
          </Text>

          <View
            style={[
              styles.rolePill,
              { backgroundColor: roleBadge.bg },
              isRTL && { alignSelf: 'flex-end' },
            ]}
          >
            <Feather name={roleBadge.icon} size={11.5} color={roleBadge.text} />
            <Text style={[styles.rolePillText, { color: roleBadge.text }]}>
              {roleBadge.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Authorized Role Workspaces (Shown ONLY to verified Staff / Admins) */}
      {(isStaff || isAdmin) && (
        <View style={[styles.settingsCard, { backgroundColor: colors.card }, hairlineBorder]}>
          <Text style={[styles.settingsHeading, { color: colors.textMuted }, rtlText]}>
            Authorized Municipal Workspaces
          </Text>

          {isStaff && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.settingRow, rtlRow]}
              onPress={() => {
                triggerLightHaptic();
                router.push('/employee');
              }}
            >
              <View style={[styles.settingIconBox, { backgroundColor: colors.accentSoft }]}>
                <Feather name="truck" size={17} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.text }, rtlText]}>
                  Municipal Dispatch Queue
                </Text>
                <Text style={[styles.settingSubtitle, { color: colors.textMuted }, rtlText]}>
                  Update incident status & upload after-resolution proof
                </Text>
              </View>
              <Feather
                name={isRTL ? 'chevron-left' : 'chevron-right'}
                size={18}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.settingRow, isStaff && { marginTop: Spacing.md }, rtlRow]}
              onPress={() => {
                triggerLightHaptic();
                router.push('/admin');
              }}
            >
              <View style={[styles.settingIconBox, { backgroundColor: colors.emeraldSoft }]}>
                <Feather name="shield" size={17} color={colors.emerald} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.text }, rtlText]}>
                  Admin Triage & Governance
                </Text>
                <Text style={[styles.settingSubtitle, { color: colors.textMuted }, rtlText]}>
                  Set priority, reassign crews, or moderate reports
                </Text>
              </View>
              <Feather
                name={isRTL ? 'chevron-left' : 'chevron-right'}
                size={18}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Civic Karma Card */}
      <View style={[styles.karmaCard, { backgroundColor: colors.card }, hairlineBorder]}>
        <View style={[styles.karmaTop, rtlRow]}>
          <View>
            <Text style={[styles.karmaEyebrow, { color: colors.textMuted }, rtlText]}>
              CIVIC RANK
            </Text>
            <Text style={[styles.badgeTitle, { color: colors.text }, rtlText]}>{badge}</Text>
          </View>
          <View
            style={[
              styles.pointsPill,
              { backgroundColor: isDark ? colors.warningSoft : '#FEF3C7' },
            ]}
          >
            <Ionicons name="sparkles" size={14} color={colors.warning} />
            <Text style={[styles.pointsText, { color: colors.warning }]}>{points} pts</Text>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSubtle }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: colors.emerald },
            ]}
          />
        </View>

        <Text style={[styles.progressCaption, { color: colors.textMuted }, rtlText]}>
          {points < 300
            ? `${nextTierPoints - points} pts to reach the next civic milestone`
            : 'Top tier reached — thank you for keeping the city safe.'}
        </Text>
      </View>

      {/* Metrics Row */}
      <View style={[styles.metricsCard, { backgroundColor: colors.card }, hairlineBorder, rtlRow]}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {userProfile?.reportsCount || 0}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Filed</Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.emerald }]}>
            {userProfile?.resolvedCount || 0}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {t('status.resolved')}
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.accent }]}>{points}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Civic Pts</Text>
        </View>
      </View>

      {/* Quick Settings & Security Posture Card */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card }, hairlineBorder]}>
        <Text style={[styles.settingsHeading, { color: colors.textMuted }, rtlText]}>
          {t('tabs.settingsHeader')} & Security
        </Text>

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRow, { marginBottom: Spacing.md }]}
          onPress={() => {
            triggerLightHaptic();
            router.push('/(tabs)/settings');
          }}
        >
          <View style={[styles.settingIconBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Feather name="sliders" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }, rtlText]}>
              {t('tabs.settingsHeader')}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.textMuted }, rtlText]}>
              {t('settings.subtitle')}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRow, { marginTop: Spacing.md }]}
          onPress={handleRefreshClaims}
        >
          <View style={[styles.settingIconBox, { backgroundColor: colors.accentSoft }]}>
            <Feather
              name={claimsVerified ? 'check-circle' : 'lock'}
              size={17}
              color={claimsVerified ? colors.emerald : colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }, rtlText]}>
              {claimsVerified ? 'JWT Custom Claims Active' : 'Encrypted Keychain Session'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.textMuted }, rtlText]}>
              Tap to force-refresh verified Firebase ID token claims
            </Text>
          </View>
          <Feather name="refresh-cw" size={16} color={colors.textSubtle} />
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.logoutBtn, { backgroundColor: colors.dangerSoft }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={17} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      {/* BRAND FOOTER & SLOGAN */}
      <View style={{ alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            lineHeight: 22,
            color: colors.accent,
            writingDirection: 'rtl',
            textAlign: 'center',
          }}
        >
          "تصويرة منّك، وبلادنا تزيان بينا"
        </Text>
        <Text
          style={{
            ...Typography.micro,
            fontStyle: 'italic',
            color: colors.textMuted,
            marginTop: 2,
            textAlign: 'center',
          }}
        >
          Taswira mennek, w bledna tizyen bina
        </Text>
        <Text
          style={{
            ...Typography.micro,
            fontWeight: '600',
            color: colors.textSubtle,
            marginTop: 4,
          }}
        >
          بلادي+ • Bledi+
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.base,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Elevation.ambient,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarTouchTarget: {
    width: 68,
    height: 68,
    borderRadius: 34,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.ambient,
  },
  identityInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 15,
  },
  saveChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.input,
  },
  saveChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  displayName: {
    ...Typography.sectionHeader,
    fontSize: 18,
  },
  emailText: {
    ...Typography.micro,
    marginTop: 2,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: Radius.pill,
    marginTop: 7,
    gap: 5,
  },
  rolePillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  karmaCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Elevation.ambient,
  },
  karmaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  karmaEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  badgeTitle: {
    ...Typography.sectionHeader,
    marginTop: 2,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    gap: 4,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  progressCaption: {
    ...Typography.micro,
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    paddingVertical: Spacing.base,
    ...Elevation.ambient,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    ...Typography.micro,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 30,
  },
  settingsCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Elevation.ambient,
  },
  settingsHeading: {
    ...Typography.label,
    fontSize: 12.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  rowDivider: {
    height: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    ...Typography.label,
    fontSize: 14.5,
  },
  settingSubtitle: {
    ...Typography.micro,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.card,
    paddingVertical: 14,
    gap: 8,
    marginTop: Spacing.xs,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
