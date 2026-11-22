/**
 * Polished New Report Screen (`app/(tabs)/new-report.tsx`)
 *
 * Designed after FixMyStreet / Citizen / Citymapper:
 * - Custom dashed MediaUploadBox with guidance & floating Retake/Delete chips
 * - Live GPS Location Banner with reverse-geocoded street address & coordinate pill
 * - Tactile category chips and focus-styled inputs (10px radius)
 * - Subtle Expo Haptics on selection and submission
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import {
  createReport,
  ensureReportUpvote,
  findNearbyActiveReports,
} from '../../src/services/reports';
import { CivicReport, ReportCategory } from '../../src/types/report';
import {
  Typography,
  Spacing,
  Radius,
  Elevation,
} from '../../src/constants/theme';
import { MediaUploadBox } from '../../src/components/MediaUploadBox';
import { NearbyDuplicateModal } from '../../src/components/NearbyDuplicateModal';
import {
  DUPLICATE_DETECTION_RADIUS_METERS,
  GeoCoordinates,
  NearbyDuplicateMatch,
} from '../../src/utils/geoDistance';
import {
  SUPPORTED_REGIONS,
  detectRegionFromLocation,
  DEFAULT_REGION,
} from '../../src/utils/regionMapper';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
  triggerWarningHaptic,
} from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

export default function NewReportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();
  const { colors, categoryTokens, hairlineBorder } = useTheme();
  const { preferences, isRTL, applyLocationPrivacy } = usePreferences();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ReportCategory>('infrastructure');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'title' | 'description' | null>(null);

  // Geolocation states
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressOptions, setAddressOptions] = useState<{
    exact: string;
    approx: string;
  }>({ exact: '', approx: '' });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [selectedRegion, setSelectedRegion] = useState<string>(DEFAULT_REGION);
  const [regionModalVisible, setRegionModalVisible] = useState<boolean>(false);

  // Submission & Smart Duplicate Detection state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [nearbyMatches, setNearbyMatches] = useState<NearbyDuplicateMatch[]>([]);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState<boolean>(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState<boolean>(false);
  const [duplicateBypassed, setDuplicateBypassed] = useState<boolean>(false);
  const [isUpvotingExisting, setIsUpvotingExisting] = useState<boolean>(false);
  const scanSequenceRef = useRef<number>(0);

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  /**
   * Retrieves fine GPS coordinates and reverse-geocodes into both exact and
   * neighborhood-level street strings so Privacy toggles apply dynamically.
   */
  const fetchCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const msg = 'Location permission required';
        setAddressOptions({ exact: msg, approx: msg });
        setIsLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocationCoords(coords);

      let detectedRegion = DEFAULT_REGION;
      const [place] = await Location.reverseGeocodeAsync(coords);
      if (place) {
        const exactStreet = [place.name, place.street].filter(Boolean).join(' ');
        const approxStreet = place.street || place.district || place.subregion || '';
        const city = place.city || place.subregion || place.region || '';

        const exactFormatted = `${exactStreet}${exactStreet && city ? ', ' : ''}${city}`.trim();
        const approxFormatted = `${approxStreet}${approxStreet && city ? ', ' : ''}${city}`.trim();

        setAddressOptions({
          exact: exactFormatted || 'Current GPS Location',
          approx: approxFormatted || city || 'Approximate Neighborhood',
        });
        detectedRegion = detectRegionFromLocation(coords, place);
      } else {
        setAddressOptions({
          exact: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          approx: `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`,
        });
        detectedRegion = detectRegionFromLocation(coords, null);
      }
      setSelectedRegion(detectedRegion);
    } catch (error: any) {
      console.warn('Geolocation warning:', error.message);
      const fallbackMsg = 'Tap refresh to retry GPS fix';
      setAddressOptions({ exact: fallbackMsg, approx: fallbackMsg });
    } finally {
      setIsLocating(false);
    }
  };

  /**
   * Captures a live photo using the device camera.
   */
  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please enable camera permissions in Settings to capture evidence.'
      );
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
      setImageUri(result.assets[0].uri);
    }
  };

  /**
   * Picks an existing photo from the photo library.
   */
  const pickPhotoFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Access',
        'Please grant photo library access to select an image.'
      );
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
      setImageUri(result.assets[0].uri);
    }
  };

  const handleCategorySelect = (catKey: ReportCategory) => {
    triggerSelectionHaptic();
    setCategory(catKey);
  };

  const handleRefreshLocation = () => {
    triggerLightHaptic();
    setDuplicateBypassed(false);
    fetchCurrentLocation();
  };

  /**
   * Queries active (`status != 'resolved'`) reports and checks Haversine proximity <= 30m.
   * Uses raw device GPS coordinates for accurate street-level duplicate matching.
   */
  const runNearbyDuplicateCheck = useCallback(async (coords: GeoCoordinates): Promise<boolean> => {
    const requestSeq = ++scanSequenceRef.current;
    setIsCheckingDuplicates(true);

    try {
      const matches = await findNearbyActiveReports(coords, DUPLICATE_DETECTION_RADIUS_METERS);
      if (requestSeq !== scanSequenceRef.current) {
        return false;
      }

      if (matches.length > 0) {
        setNearbyMatches(matches);
        setDuplicateModalVisible(true);
        triggerWarningHaptic();
        return true;
      }

      setNearbyMatches([]);
      return false;
    } catch (err) {
      console.warn('Nearby duplicate check skipped:', getSafeErrorMessage(err));
      return false;
    } finally {
      if (requestSeq === scanSequenceRef.current) {
        setIsCheckingDuplicates(false);
      }
    }
  }, []);

  /**
   * Auto-triggers Haversine proximity scan once the citizen has attached a photo
   * and locked GPS coordinates (unless already bypassed for this report draft).
   */
  useEffect(() => {
    if (imageUri && locationCoords && !duplicateBypassed) {
      runNearbyDuplicateCheck(locationCoords);
    }
  }, [imageUri, locationCoords, duplicateBypassed, runNearbyDuplicateCheck]);

  const resetFormDraft = () => {
    scanSequenceRef.current += 1;
    setTitle('');
    setDescription('');
    setImageUri(null);
    setNearbyMatches([]);
    setDuplicateBypassed(false);
    setDuplicateModalVisible(false);
  };

  const handleUpvoteExisting = async (existingReport: CivicReport) => {
    if (!user?.uid) {
      Alert.alert('Authentication Required', 'Please sign in to upvote an existing report.');
      return;
    }

    setIsUpvotingExisting(true);
    try {
      await ensureReportUpvote(existingReport.id, user.uid);
      triggerSuccessHaptic();
      resetFormDraft();

      Alert.alert(
        t('duplicateModal.upvotedAlertTitle'),
        t('duplicateModal.upvotedAlertBody'),
        [
          {
            text: t('tabs.feed'),
            onPress: () => router.replace('/(tabs)'),
          },
          {
            text: 'View Issue',
            onPress: () =>
              router.replace({
                pathname: '/report/[id]',
                params: { id: existingReport.id },
              }),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Upvote Failed', getSafeErrorMessage(err));
    } finally {
      setIsUpvotingExisting(false);
    }
  };

  const handleReportAnyway = () => {
    triggerLightHaptic();
    setDuplicateBypassed(true);
    setDuplicateModalVisible(false);
  };

  const displayCoords = locationCoords ? applyLocationPrivacy(locationCoords) : null;
  const displayAddress = preferences.approximateLocation
    ? addressOptions.approx
    : addressOptions.exact;

  /**
   * Validates inputs, enforces pre-submit duplicate safety check if not bypassed,
   * and submits report with privacy settings (anonymous reporting + approximate GPS).
   */
  const handleSubmit = async () => {
    triggerLightHaptic();

    if (!imageUri) {
      Alert.alert('Photo Evidence Needed', 'Please attach or capture a photo showing the defect.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Missing', 'Provide a concise headline for the municipal team.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description Missing', 'Add brief details about the severity or hazards.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Authentication Required', 'Please sign in before filing a civic report.');
      return;
    }

    // Raw coordinates for exact Haversine 30m check; privacy rounding applied only when persisting
    const rawCoords = locationCoords || { latitude: 33.5042, longitude: 11.1125 };

    if (!duplicateBypassed) {
      const hasNearby = await runNearbyDuplicateCheck(rawCoords);
      if (hasNearby) {
        return; // Interrupt submission cleanly with NearbyDuplicateModal
      }
    }

    const finalCoords = applyLocationPrivacy(rawCoords);

    setIsSubmitting(true);
    try {
      const reporterUid = user.uid;
      const defaultName = userProfile?.displayName || user?.displayName || 'Citizen Reporter';
      const reporterName = preferences.anonymousReporting
        ? t('common.anonymousCitizen')
        : defaultName;

      await createReport({
        title,
        description,
        category,
        localImageUri: imageUri,
        location: {
          latitude: finalCoords.latitude,
          longitude: finalCoords.longitude,
          address: displayAddress || 'Reported GPS Location',
        },
        region: selectedRegion,
        userId: reporterUid,
        userDisplayName: reporterName,
      });

      triggerSuccessHaptic();
      Alert.alert(
        'Report Logged',
        'Municipal authorities have been notified and your report is queued for review.',
        [
          {
            text: 'View Live Map',
            onPress: () => {
              resetFormDraft();
              router.push('/(tabs)/map');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Submission Failed', getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const rtlRow = isRTL ? styles.rowReverse : undefined;
  const rtlText = isRTL ? styles.textRight : undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Page Title & Context */}
        <View style={styles.headerBlock}>
          <Text style={[styles.pageTitle, { color: colors.text }, rtlText]}>
            {t('newReport.title')}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }, rtlText]}>
            {t('newReport.subtitle')}
          </Text>
          <View style={[styles.sloganPill, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.sloganPillText, { color: colors.accent }]}>
              "تصويرة منّك، وبلادنا تزيان بينا"
            </Text>
          </View>
        </View>

        {/* Active Privacy Mode Indicators */}
        {(preferences.anonymousReporting || preferences.approximateLocation) && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/settings')}
            style={[
              styles.privacyNoticeCard,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            {preferences.anonymousReporting && (
              <View style={[styles.privacyBadgeRow, rtlRow]}>
                <Feather name="eye-off" size={14} color={colors.accent} />
                <Text style={[styles.privacyBadgeText, { color: colors.accent }, rtlText]}>
                  {t('newReport.anonymousActive')}
                </Text>
              </View>
            )}
            {preferences.approximateLocation && (
              <View style={[styles.privacyBadgeRow, rtlRow]}>
                <Feather name="shield" size={14} color={colors.accent} />
                <Text style={[styles.privacyBadgeText, { color: colors.accent }, rtlText]}>
                  {t('newReport.approxLocationActive')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* --- 1. LOCATION BANNER --- */}
        <View style={[styles.sectionHeaderRow, rtlRow]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('newReport.incidentLocation')}
          </Text>
          <View
            style={[
              styles.gpsStatusPill,
              {
                backgroundColor: displayCoords ? colors.emeraldSoft : colors.warningSoft,
              },
            ]}
          >
            <View
              style={[
                styles.gpsDot,
                { backgroundColor: displayCoords ? colors.emerald : colors.warning },
              ]}
            />
            <Text
              style={[
                styles.gpsStatusText,
                { color: displayCoords ? colors.emerald : colors.warning },
              ]}
            >
              {isLocating
                ? t('common.loading')
                : displayCoords
                  ? preferences.approximateLocation
                    ? t('newReport.approxLocationActive')
                    : t('newReport.exactLocationActive')
                  : 'Default Area'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.locationBanner,
            { backgroundColor: colors.card },
            hairlineBorder,
            rtlRow,
          ]}
        >
          <View style={[styles.locationIconBadge, { backgroundColor: colors.accentSoft }]}>
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Feather name="map-pin" size={18} color={colors.accent} />
            )}
          </View>

          <View style={styles.locationCopy}>
            <Text
              style={[styles.locationAddress, { color: colors.text }, rtlText]}
              numberOfLines={2}
            >
              {isLocating
                ? 'Acquiring precise street coordinates...'
                : displayAddress || 'Pinpointed via GPS'}
            </Text>
            {displayCoords ? (
              <Text style={[styles.locationCoords, { color: colors.textMuted }, rtlText]}>
                {displayCoords.latitude.toFixed(preferences.approximateLocation ? 3 : 5)}° N,{' '}
                {displayCoords.longitude.toFixed(preferences.approximateLocation ? 3 : 5)}° E
              </Text>
            ) : (
              <Text style={[styles.locationCoords, { color: colors.textMuted }, rtlText]}>
                Using municipal center fallback
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleRefreshLocation}
            disabled={isLocating}
            style={[
              styles.refreshBtn,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
            accessibilityLabel="Refresh GPS coordinates"
          >
            <Feather name="crosshair" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* --- 1.5 REGIONAL MUNICIPALITY SELECTOR --- */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            triggerLightHaptic();
            setRegionModalVisible(true);
          }}
          style={[
            styles.regionCard,
            { backgroundColor: colors.card },
            hairlineBorder,
            rtlRow,
          ]}
        >
          <View style={[styles.regionIconBadge, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="business-outline" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.regionLabel, { color: colors.textMuted }, rtlText]}>
              Délégation Municipale / المعتمدية
            </Text>
            <Text style={[styles.regionTitle, { color: colors.text }, rtlText]}>
              {selectedRegion}{' '}
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '400' }}>
                ({SUPPORTED_REGIONS.find((r) => r.name === selectedRegion)?.arabicName || ''})
              </Text>
            </Text>
          </View>
          <View style={[styles.changePill, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={[styles.changePillText, { color: colors.primary }]}>Modifier</Text>
            <Feather name="chevron-down" size={13} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* --- 2. MEDIA CAPTURE / PROOF SECTION --- */}
        <View style={[styles.sectionHeaderRow, rtlRow]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('newReport.photoEvidence')}
          </Text>
          <Text style={[styles.requiredMicro, { color: colors.accent }]}>
            {t('newReport.required')}
          </Text>
        </View>

        <MediaUploadBox
          imageUri={imageUri}
          onCapturePress={takePhotoWithCamera}
          onGalleryPress={pickPhotoFromGallery}
          onClearPress={() => {
            setImageUri(null);
            setDuplicateBypassed(false);
            setNearbyMatches([]);
          }}
          title={t('actions.capturePhoto')}
          guidanceText="Ensure the defect and street context are visible"
          badgeLabel="BEFORE EVIDENCE"
        />

        {isCheckingDuplicates && (
          <View
            style={[
              styles.duplicateStatusBanner,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              rtlRow,
            ]}
          >
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.duplicateStatusText, { color: colors.accent }, rtlText]}>
              {t('duplicateModal.scanningHint')}
            </Text>
          </View>
        )}

        {duplicateBypassed && nearbyMatches.length > 0 && !isCheckingDuplicates && (
          <View
            style={[
              styles.duplicateStatusBanner,
              { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              rtlRow,
            ]}
          >
            <Feather name="check-circle" size={14} color={colors.warning} />
            <Text style={[styles.duplicateStatusText, { color: colors.warning }, rtlText]}>
              {t('duplicateModal.bypassNotice')}
            </Text>
          </View>
        )}

        {/* --- 3. CATEGORY SELECTOR --- */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }, rtlRow]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Issue Category</Text>
        </View>

        <View style={[styles.categoriesWrap, rtlRow]}>
          {(Object.keys(categoryTokens) as ReportCategory[]).map((catKey) => {
            const token = categoryTokens[catKey];
            const isSelected = category === catKey;

            return (
              <TouchableOpacity
                key={catKey}
                activeOpacity={0.8}
                onPress={() => handleCategorySelect(catKey)}
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.card },
                  hairlineBorder,
                  rtlRow,
                  isSelected && {
                    backgroundColor: token.bg,
                    borderColor: token.color,
                  },
                ]}
              >
                <Feather
                  name={token.icon as any}
                  size={15}
                  color={isSelected ? token.color : colors.textMuted}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: colors.textSecondary },
                    isSelected && { color: token.color, fontWeight: '700' },
                  ]}
                >
                  {t(`categories.${catKey}`, { defaultValue: token.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* --- 4. DETAILS CARD --- */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }, rtlRow]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Defect Details</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card }, hairlineBorder]}>
          <View style={[styles.inputHeader, rtlRow]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Headline</Text>
            <Text style={[styles.charCounter, { color: colors.textSubtle }]}>
              {title.length}/80
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: focusedField === 'title' ? colors.card : colors.inputBg,
                borderColor: focusedField === 'title' ? colors.borderFocus : colors.border,
                color: colors.text,
              },
              rtlText,
            ]}
            placeholder="e.g., Collapsed drain grate near school gate"
            placeholderTextColor={colors.textSubtle}
            value={title}
            onChangeText={setTitle}
            onFocus={() => setFocusedField('title')}
            onBlur={() => setFocusedField(null)}
            maxLength={80}
          />

          <View style={[styles.inputHeader, { marginTop: Spacing.md }, rtlRow]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Description & Safety Context
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor:
                  focusedField === 'description' ? colors.card : colors.inputBg,
                borderColor:
                  focusedField === 'description' ? colors.borderFocus : colors.border,
                color: colors.text,
              },
              rtlText,
            ]}
            placeholder="Describe exact placement, pedestrian hazard, or duration..."
            placeholderTextColor={colors.textSubtle}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* --- 5. PRIMARY SUBMIT ACTION --- */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            (isSubmitting || isCheckingDuplicates) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || isCheckingDuplicates}
        >
          {isSubmitting ? (
            <View style={styles.submitContent}>
              <ActivityIndicator color={colors.primaryTextOn} size="small" />
              <Text style={[styles.submitText, { color: colors.primaryTextOn }]}>
                Uploading Proof & Publishing...
              </Text>
            </View>
          ) : (
            <View style={[styles.submitContent, rtlRow]}>
              <Ionicons name="paper-plane" size={18} color={colors.primaryTextOn} />
              <Text style={[styles.submitText, { color: colors.primaryTextOn }]}>
                {t('actions.submitReport')}
              </Text>
              <View style={styles.pointsChip}>
                <Text style={styles.pointsChipText}>+10 pts</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Smart Haversine Duplicate Warning Sheet (<= 30m radius) */}
      <NearbyDuplicateModal
        visible={duplicateModalVisible}
        matches={nearbyMatches}
        currentUserId={user?.uid}
        isUpvoting={isUpvotingExisting}
        onUpvoteExisting={handleUpvoteExisting}
        onReportAnyway={handleReportAnyway}
      />

      {/* Regional Municipality Selection Modal */}
      <Modal
        visible={regionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRegionModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setRegionModalVisible(false)}
          />
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalSheetTitle, { color: colors.text }]}>
                  Délégation Municipale
                </Text>
                <Text style={[styles.modalSheetSubtitle, { color: colors.textMuted }]}>
                  Sélectionnez la délégation pour router l'intervention
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRegionModalVisible(false)}
                style={[styles.closeIconBtn, { backgroundColor: colors.surfaceSubtle }]}
              >
                <Feather name="x" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {SUPPORTED_REGIONS.map((reg) => {
                const isSelected = selectedRegion === reg.name;
                return (
                  <TouchableOpacity
                    key={reg.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setSelectedRegion(reg.name);
                      setRegionModalVisible(false);
                    }}
                    style={[
                      styles.regionItemRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: isSelected ? colors.surfaceSubtle : 'transparent',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text
                          style={[
                            styles.regionItemName,
                            { color: colors.text },
                            isSelected && { fontWeight: '700', color: colors.accent },
                          ]}
                        >
                          {reg.name}
                        </Text>
                        <View
                          style={[
                            styles.govBadge,
                            { backgroundColor: colors.surfaceSubtle },
                          ]}
                        >
                          <Text style={[styles.govBadgeText, { color: colors.textMuted }]}>
                            {reg.governorate}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.regionItemArabic, { color: colors.textMuted }]}>
                        {reg.arabicName}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    padding: Spacing.base,
    paddingBottom: 48,
  },
  headerBlock: {
    marginBottom: Spacing.md,
  },
  sloganPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginTop: 8,
  },
  sloganPillText: {
    fontSize: 13,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  pageTitle: {
    ...Typography.title,
  },
  pageSubtitle: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  privacyNoticeCard: {
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: 6,
  },
  privacyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyBadgeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm + 2,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  requiredMicro: {
    ...Typography.micro,
    fontWeight: '600',
  },
  gpsStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: Radius.pill,
    gap: 5,
    maxWidth: '58%',
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
  gpsStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Elevation.ambient,
  },
  locationIconBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCopy: {
    flex: 1,
  },
  locationAddress: {
    ...Typography.label,
    fontSize: 14,
  },
  locationCoords: {
    ...Typography.micro,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.chip,
    gap: 7,
    ...Elevation.subtle,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Elevation.ambient,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    ...Typography.label,
  },
  charCounter: {
    ...Typography.micro,
    fontVariant: ['tabular-nums'],
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  textArea: {
    minHeight: 104,
    lineHeight: 22,
    paddingTop: 11,
  },
  submitButton: {
    borderRadius: Radius.card,
    paddingVertical: 15,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    alignItems: 'center',
    ...Elevation.floating,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pointsChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
  },
  pointsChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6EE7B7',
  },
  duplicateStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 1,
    marginTop: Spacing.sm + 2,
    gap: 8,
  },
  duplicateStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.md,
    ...Elevation.ambient,
  },
  regionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionLabel: {
    ...Typography.micro,
    fontSize: 11,
    fontWeight: '600',
  },
  regionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    marginTop: 2,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    gap: 4,
  },
  changePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalSheetTitle: {
    ...Typography.sectionHeader,
    fontSize: 17,
  },
  modalSheetSubtitle: {
    ...Typography.micro,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderRadius: Radius.input,
  },
  regionItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  govBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  govBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  regionItemArabic: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
