/**
 * Settings & Preferences Screen (`app/(tabs)/settings.tsx`)
 *
 * Organized civic preference groups:
 * 1. Appearance (Light / Dark / System Auto synced with OS color scheme)
 * 2. Language & Region (French / English / Arabic with RTL layout awareness)
 * 3. Privacy & Security (Anonymous reporting, Approximate GPS, Legal Modals)
 * 4. Notifications (Status updates, Nearby urgent alerts, Upvote notifications)
 * 5. Account & Data (Clear local cache, JSON Data Export, Permanent Delete Account)
 * 6. About & App Meta (App version, Municipal support contact, Open Source credits)
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  Share,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, ThemeMode } from '../../src/context/ThemeContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import { useAuth } from '../../src/context/AuthContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import { Radius, Spacing, Typography, Elevation } from '../../src/constants/theme';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
  triggerWarningHaptic,
} from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

type InfoModalType = 'privacy' | 'terms' | 'licenses' | 'export' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, mode, systemScheme, hairlineBorder, setThemeMode } = useTheme();
  const {
    preferences,
    language,
    isRTL,
    setAnonymousReporting,
    setApproximateLocation,
    setNotificationPref,
    changeLanguage,
    clearLocalCache,
  } = usePreferences();
  const { user, userProfile, role, deleteAccount } = useAuth();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const currentLangMeta =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[1];

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const exportPayloadJson = useMemo(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        account: {
          uid: user?.uid || null,
          email: user?.email || null,
          displayName: userProfile?.displayName || null,
          verifiedRole: role,
          civicPoints: userProfile?.points ?? 0,
          badge: userProfile?.badge || 'Novice Watcher',
          reportsCount: userProfile?.reportsCount ?? 0,
          resolvedCount: userProfile?.resolvedCount ?? 0,
        },
        preferences: {
          themeMode: mode,
          language,
          anonymousReporting: preferences.anonymousReporting,
          approximateLocation: preferences.approximateLocation,
          notifications: preferences.notifications,
        },
      },
      null,
      2
    );
  }, [user, userProfile, role, mode, language, preferences]);

  const handleSelectTheme = async (next: ThemeMode) => {
    triggerSelectionHaptic();
    await setThemeMode(next);
  };

  const handleSelectLanguage = async (code: SupportedLanguage) => {
    triggerSelectionHaptic();
    const { rtlChanged } = await changeLanguage(code);
    setLanguageModalVisible(false);
    triggerSuccessHaptic();
    if (rtlChanged && Platform.OS !== 'web') {
      Alert.alert(
        t('settings.language.title'),
        t('settings.language.rtlNote')
      );
    }
  };

  const handleClearCache = async () => {
    triggerLightHaptic();
    const cleared = await clearLocalCache();
    triggerSuccessHaptic();
    Alert.alert(
      t('settings.account.clearCacheTitle'),
      t('settings.account.clearCacheSuccess', { count: cleared })
    );
  };

  const handleShareExport = async () => {
    triggerLightHaptic();
    try {
      await Share.share({
        title: 'Bledi+ Personal Data Export',
        message: exportPayloadJson,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert(t('common.confirm'), 'Please type DELETE to confirm permanent account removal.');
      return;
    }

    triggerWarningHaptic();
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      setDeleteModalVisible(false);
      setDeleteConfirmText('');
      triggerSuccessHaptic();
      Alert.alert(t('settings.account.deleteAccountTitle'), t('settings.account.deleteSuccess'));
      router.replace('/(auth)/login');
    } catch (err) {
      const safeMsg = getSafeErrorMessage(err, t('settings.account.recentLoginRequired'));
      Alert.alert(t('settings.account.deleteAccountTitle'), safeMsg);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const rtlRowStyle = isRTL ? styles.rowReverse : undefined;
  const rtlTextStyle = isRTL ? styles.textRight : undefined;

  const modalLegalContent = useMemo(() => {
    if (infoModal === 'privacy') {
      return {
        title: t('settings.privacy.privacyPolicy'),
        body: [
          '1. Data Minimization & Purpose\nBledi+ collects report photos, descriptions, and optional GPS coordinates solely to route urban maintenance defects to authorized municipal departments.',
          '2. Anonymous Mode & Approximate GPS\nWhen Anonymous Reporting is enabled, your name is omitted from public feeds and replaced with "Anonymous Citizen". When Approximate Location is enabled, coordinates are rounded to a ~150m street-level grid before storage.',
          '3. Hardware-Backed Security\nAuthentication tokens are stored exclusively inside encrypted native storage (iOS Keychain / Android Keystore) using Custom Claims RBAC.',
          '4. Your Rights (GDPR / Municipal Transparency)\nYou can export your stored profile JSON or permanently delete your authentication account at any time from Settings > Account & Data.',
        ].join('\n\n'),
      };
    }
    if (infoModal === 'terms') {
      return {
        title: t('settings.privacy.termsOfService'),
        body: [
          '1. Responsible Civic Reporting\nSubmitted reports must depict genuine municipal or infrastructure issues. Harassment, false emergencies, or private property surveillance are strictly prohibited.',
          '2. Public Visibility\nIssue descriptions, defect photos, and civic status timelines ("Pending", "In Progress", "Resolved") are visible to community members and municipal agents to prevent duplicate tickets.',
          '3. Verification Proof\nMunicipal staff are required to attach an "After" resolution photo before closing any incident ticket.',
        ].join('\n\n'),
      };
    }
    return {
      title: t('settings.about.licensesTitle'),
      body: [
        '• React Native (MIT License) — Cross-platform mobile runtime',
        '• Expo SDK & Expo Router (MIT License) — Navigation, Camera, Location & SecureStore',
        '• Firebase Modular JS SDK (Apache-2.0 License) — Auth, Firestore & Storage',
        '• i18next & react-i18next (MIT License) — Multi-language internationalization (FR / EN / AR)',
        '• @expo/vector-icons (MIT License) — Feather & Ionicons Civic UI iconography',
      ].join('\n\n'),
    };
  }, [infoModal, t]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Page Summary */}
      <View style={styles.headerBlock}>
        <Text style={[styles.pageTitle, { color: colors.text }, rtlTextStyle]}>
          {t('common.settings')}
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.textMuted }, rtlTextStyle]}>
          {t('settings.subtitle')}
        </Text>
      </View>

      {/* SECTION 1: APPEARANCE */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlTextStyle]}>
        {t('settings.sections.appearance')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
        <View style={[styles.rowHeader, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Feather name="sun" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.theme.title')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.theme.systemHint', { scheme: systemScheme.toUpperCase() })}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.themeSegmentTrack,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            rtlRowStyle,
          ]}
        >
          {(
            [
              { key: 'light', icon: 'sun', label: t('settings.theme.light') },
              { key: 'dark', icon: 'moon', label: t('settings.theme.dark') },
              { key: 'system', icon: 'smartphone', label: t('settings.theme.system') },
            ] as const
          ).map((option) => {
            const active = mode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.85}
                onPress={() => handleSelectTheme(option.key)}
                style={[
                  styles.themeSegmentBtn,
                  active && { backgroundColor: colors.primary },
                ]}
              >
                <Feather
                  name={option.icon}
                  size={14}
                  color={active ? colors.primaryTextOn : colors.textMuted}
                />
                <Text
                  style={[
                    styles.themeSegmentText,
                    { color: active ? colors.primaryTextOn : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SECTION 2: LANGUAGE & REGION */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlTextStyle]}>
        {t('settings.sections.language')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerLightHaptic();
            setLanguageModalVisible(true);
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.emeraldSoft }]}>
            <Ionicons name="language-outline" size={18} color={colors.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.language.title')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.language.currentDesc')}
            </Text>
          </View>
          <View style={[styles.valueChip, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={[styles.valueChipText, { color: colors.text }]}>
              {currentLangMeta.nativeLabel}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>
      </View>

      {/* SECTION 3: PRIVACY & SECURITY */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlTextStyle]}>
        {t('settings.sections.privacy')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
        <View style={[styles.settingRow, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Feather name="eye-off" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.privacy.anonymousTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.privacy.anonymousDesc')}
            </Text>
          </View>
          <Switch
            value={preferences.anonymousReporting}
            onValueChange={(val) => {
              triggerSelectionHaptic();
              setAnonymousReporting(val);
            }}
            trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
            thumbColor={colors.switchThumb}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={[styles.settingRow, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.warningSoft }]}>
            <Feather name="map-pin" size={17} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.privacy.locationTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.privacy.locationDesc')}
            </Text>
          </View>
          <Switch
            value={preferences.approximateLocation}
            onValueChange={(val) => {
              triggerSelectionHaptic();
              setApproximateLocation(val);
            }}
            trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
            thumbColor={colors.switchThumb}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerLightHaptic();
            setInfoModal('privacy');
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Feather name="shield" size={17} color={colors.textSecondary} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1, color: colors.text }, rtlTextStyle]}>
            {t('settings.privacy.privacyPolicy')}
          </Text>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerLightHaptic();
            setInfoModal('terms');
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Feather name="file-text" size={17} color={colors.textSecondary} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1, color: colors.text }, rtlTextStyle]}>
            {t('settings.privacy.termsOfService')}
          </Text>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>
      </View>

      {/* SECTION 4: NOTIFICATIONS */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlTextStyle]}>
        {t('settings.sections.notifications')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
        <View style={[styles.settingRow, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.emeraldSoft }]}>
            <Feather name="check-square" size={17} color={colors.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.notifications.statusUpdatesTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.notifications.statusUpdatesDesc')}
            </Text>
          </View>
          <Switch
            value={preferences.notifications.statusUpdates}
            onValueChange={(val) => {
              triggerSelectionHaptic();
              setNotificationPref('statusUpdates', val);
            }}
            trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
            thumbColor={colors.switchThumb}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={[styles.settingRow, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.warningSoft }]}>
            <Feather name="bell" size={17} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.notifications.nearbyTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.notifications.nearbyDesc')}
            </Text>
          </View>
          <Switch
            value={preferences.notifications.nearbyAlerts}
            onValueChange={(val) => {
              triggerSelectionHaptic();
              setNotificationPref('nearbyAlerts', val);
            }}
            trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
            thumbColor={colors.switchThumb}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={[styles.settingRow, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Feather name="thumbs-up" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.notifications.upvotesTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.notifications.upvotesDesc')}
            </Text>
          </View>
          <Switch
            value={preferences.notifications.upvoteAlerts}
            onValueChange={(val) => {
              triggerSelectionHaptic();
              setNotificationPref('upvoteAlerts', val);
            }}
            trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
            thumbColor={colors.switchThumb}
          />
        </View>
      </View>

      {/* SECTION 5: ACCOUNT & DATA */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlTextStyle]}>
        {t('settings.sections.account')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={handleClearCache}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Feather name="hard-drive" size={17} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.account.clearCacheTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.account.clearCacheDesc')}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerLightHaptic();
            setInfoModal('export');
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Feather name="download" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.account.downloadDataTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.account.downloadDataDesc')}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerWarningHaptic();
            setDeleteConfirmText('');
            setDeleteModalVisible(true);
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.dangerSoft }]}>
            <Feather name="trash-2" size={17} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.danger }, rtlTextStyle]}>
              {t('settings.account.deleteAccountTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.account.deleteAccountDesc')}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.danger}
          />
        </TouchableOpacity>
      </View>

      {/* SECTION 6: ABOUT & META */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlTextStyle]}>
        {t('settings.sections.about')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
        <View style={[styles.settingRow, rtlRowStyle]}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Feather name="info" size={17} color={colors.textSecondary} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1, color: colors.text }, rtlTextStyle]}>
            {t('settings.about.versionTitle')}
          </Text>
          <Text style={[styles.metaRight, { color: colors.textMuted }]}>v{appVersion} (SDK 58)</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerLightHaptic();
            Alert.alert(
              t('settings.about.supportTitle'),
              'Assistance Bledi+ : contact@blediplus.tn\nUrgences Municipales : 198 / 197'
            );
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.emeraldSoft }]}>
            <Feather name="headphones" size={17} color={colors.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.about.supportTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.about.supportEmail')}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.settingRow, rtlRowStyle]}
          onPress={() => {
            triggerLightHaptic();
            setInfoModal('licenses');
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Feather name="code" size={17} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }, rtlTextStyle]}>
              {t('settings.about.licensesTitle')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }, rtlTextStyle]}>
              {t('settings.about.licensesDesc')}
            </Text>
          </View>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textSubtle}
          />
        </TouchableOpacity>
      </View>

      {/* BRAND LOGO FOOTER */}
      <View style={{ alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xl }}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 10 }}
          resizeMode="contain"
        />
        <Text style={{ ...Typography.bodyBold, fontSize: 17, color: colors.text }}>
          بلادي+ • Bledi+
        </Text>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            lineHeight: 22,
            textAlign: 'center',
            writingDirection: 'rtl',
            color: colors.accent,
            marginTop: 4,
            paddingHorizontal: 16,
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
      </View>

      {/* LANGUAGE PICKER MODAL */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }, hairlineBorder]}>
            <View style={[styles.modalHeader, rtlRowStyle]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('settings.language.pickerTitle')}
              </Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: Spacing.sm }}>
              {SUPPORTED_LANGUAGES.map((item) => {
                const selected = language === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    activeOpacity={0.8}
                    onPress={() => handleSelectLanguage(item.code)}
                    style={[
                      styles.langOptionRow,
                      rtlRowStyle,
                      {
                        backgroundColor: selected ? colors.accentSoft : colors.surfaceSubtle,
                        borderColor: selected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langNative, { color: colors.text }, rtlTextStyle]}>
                        {item.nativeLabel}
                      </Text>
                      <Text style={[styles.langEnglish, { color: colors.textMuted }, rtlTextStyle]}>
                        {item.englishLabel} {item.isRTL ? '• RTL' : ''}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={21} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* LEGAL / DATA EXPORT / LICENSES VIEWER MODAL */}
      <Modal
        visible={infoModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              styles.modalLarge,
              { backgroundColor: colors.card },
              hairlineBorder,
            ]}
          >
            <View style={[styles.modalHeader, rtlRowStyle]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {infoModal === 'export'
                  ? t('settings.account.downloadDataTitle')
                  : modalLegalContent.title}
              </Text>
              <TouchableOpacity onPress={() => setInfoModal(null)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator>
              <Text
                style={[
                  styles.modalBodyText,
                  { color: colors.textSecondary },
                  infoModal === 'export' && styles.monoText,
                  rtlTextStyle,
                ]}
              >
                {infoModal === 'export' ? exportPayloadJson : modalLegalContent.body}
              </Text>
            </ScrollView>

            <View style={[styles.modalFooter, rtlRowStyle]}>
              {infoModal === 'export' && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.primaryModalBtn, { backgroundColor: colors.accent }]}
                  onPress={handleShareExport}
                >
                  <Feather name="share-2" size={16} color={colors.white} />
                  <Text style={styles.primaryModalBtnText}>Share JSON</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.secondaryModalBtn, { backgroundColor: colors.surfaceSubtle }]}
                onPress={() => setInfoModal(null)}
              >
                <Text style={[styles.secondaryModalBtnText, { color: colors.text }]}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PERMANENT ACCOUNT DELETION CONFIRMATION MODAL */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }, hairlineBorder]}>
            <View style={[styles.dangerIconBadge, { backgroundColor: colors.dangerSoft }]}>
              <Feather name="alert-triangle" size={24} color={colors.danger} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.danger, textAlign: 'center' }]}>
              {t('settings.account.deleteConfirmTitle')}
            </Text>
            <Text style={[styles.deleteDesc, { color: colors.textSecondary }]}>
              {t('settings.account.deleteConfirmBody')}
            </Text>

            <Text style={[styles.confirmInputLabel, { color: colors.textMuted }]}>
              Type DELETE to confirm:
            </Text>
            <TextInput
              style={[
                styles.confirmInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="DELETE"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />

            <View style={[styles.modalFooter, { marginTop: Spacing.md }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.secondaryModalBtn, { backgroundColor: colors.surfaceSubtle }]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeletingAccount}
              >
                <Text style={[styles.secondaryModalBtnText, { color: colors.text }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.primaryModalBtn,
                  { backgroundColor: colors.danger },
                  deleteConfirmText.trim().toUpperCase() !== 'DELETE' && { opacity: 0.5 },
                ]}
                onPress={handleConfirmDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.primaryModalBtnText}>{t('common.delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.base,
    paddingBottom: 48,
  },
  headerBlock: {
    marginBottom: Spacing.md,
  },
  pageTitle: {
    ...Typography.title,
  },
  pageSubtitle: {
    ...Typography.body,
    fontSize: 13.5,
    marginTop: 3,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: Spacing.md + 2,
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    ...Elevation.ambient,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 12,
    lineHeight: 16.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 2,
  },
  themeSegmentTrack: {
    flexDirection: 'row',
    borderRadius: Radius.input,
    borderWidth: 1,
    padding: 3,
    marginTop: Spacing.sm,
    marginBottom: 4,
    gap: 4,
  },
  themeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.input - 2,
    gap: 5,
  },
  themeSegmentText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  valueChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  valueChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRight: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    borderRadius: Radius.card + 2,
    padding: Spacing.lg,
    ...Elevation.floating,
  },
  modalLarge: {
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.sectionHeader,
    fontSize: 17,
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.input,
    borderWidth: 1,
  },
  langNative: {
    fontSize: 15,
    fontWeight: '700',
  },
  langEnglish: {
    fontSize: 12,
    marginTop: 2,
  },
  modalScroll: {
    maxHeight: 340,
    marginBottom: Spacing.md,
  },
  modalBodyText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: Radius.input,
    gap: 6,
  },
  primaryModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryModalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: Radius.input,
  },
  secondaryModalBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerIconBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  deleteDesc: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.md,
  },
  confirmInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  confirmInput: {
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
