/**
 * Detailed Civic Report Screen (`app/report/[id].tsx`)
 *
 * Security & RBAC Features:
 * - Citizens read reports, comments, toggle upvotes, and post citizen comments
 * - Staff (`employee` | `admin`) dispatch crew (`pending -> in_progress`) and submit
 *   mandatory "After" photo resolution proofs (`resolved`)
 * - Admins (`admin`) additionally see Triage / Deletion controls
 * - Sanitized Firebase error handling via `getSafeErrorMessage`
 */

import React, { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import {
  addReportComment,
  deleteReport,
  getReportById,
  markReportInProgress,
  subscribeToReportComments,
} from '../../src/services/reports';
import { CivicReport, ReportComment } from '../../src/types/report';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';
import { CategoryBadge } from '../../src/components/CategoryBadge';
import { UpvoteButton } from '../../src/components/UpvoteButton';
import { BeforeAfterSlider } from '../../src/components/BeforeAfterSlider';
import { formatRelativeTime } from '../../src/utils/formatting';
import { resolveImageSource } from '../../src/utils/imageResolver';
import {
  triggerLightHaptic,
  triggerSuccessHaptic,
  triggerWarningHaptic,
} from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

const LIFECYCLE_STEPS = ['pending', 'in_progress', 'resolved'] as const;

export default function ReportDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, userProfile, role, isStaff, isAdmin } = useAuth();
  const { colors, statusTokens, hairlineBorder } = useTheme();
  const { isRTL } = usePreferences();

  const [report, setReport] = useState<CivicReport | null>(null);
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [isSlidingComparison, setIsSlidingComparison] = useState<boolean>(false);
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const loadReport = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      try {
        const data = await getReportById(String(id));
        setReport(data);
      } catch (err) {
        Alert.alert('Load Error', getSafeErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadReport(false);
  }, [loadReport]);

  // Refreshes silently on return (e.g., right after staff resolves with Before/After proof)
  useFocusEffect(
    useCallback(() => {
      if (report) {
        loadReport(true);
      }
    }, [loadReport, Boolean(report)])
  );

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToReportComments(String(id), (list) => {
      setComments(list);
    });
    return () => unsub();
  }, [id]);

  const handleSetInProgress = async () => {
    if (!report) return;
    triggerLightHaptic();
    setUpdatingStatus(true);
    try {
      await markReportInProgress(report.id);
      setReport((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      triggerSuccessHaptic();
      Alert.alert('Crew Dispatched', 'Issue is now marked as In Progress.');
    } catch (err) {
      Alert.alert('Permission Rejected', getSafeErrorMessage(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePostComment = async () => {
    if (!report || !user?.uid || !commentText.trim()) return;
    triggerLightHaptic();
    setPostingComment(true);
    try {
      await addReportComment({
        reportId: report.id,
        userId: user.uid,
        userDisplayName: userProfile?.displayName || user.displayName || 'Citizen',
        userRole: role,
        text: commentText,
      });
      setCommentText('');
      triggerSuccessHaptic();
    } catch (err) {
      Alert.alert('Comment Rejected', getSafeErrorMessage(err));
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteReport = () => {
    if (!report) return;
    triggerWarningHaptic();
    Alert.alert('Delete Report', 'Permanently delete this report? This cannot be undone.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReport(report.id);
            triggerSuccessHaptic();
            router.back();
          } catch (err) {
            Alert.alert('Deletion Denied', getSafeErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.textSubtle} />
        <Text style={[styles.notFoundTitle, { color: colors.text }]}>Report unavailable</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backBtnText, { color: colors.primaryTextOn }]}>
            Return to Feed
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasUpvoted = Boolean(user && (report.upvotedBy || []).includes(user.uid));
  const isResolvedOrCompleted = report.status === 'resolved' || report.status === 'completed';
  const currentStepIdx = isResolvedOrCompleted ? 2 : LIFECYCLE_STEPS.indexOf(report.status as any);
  const beforePhotoUri = report.photoBeforeUrl || report.imageUrl;
  const afterProofUri = report.photoAfterUrl || report.resolution?.afterImageUrl;
  const hasBeforeAfterComparison =
    isResolvedOrCompleted && Boolean(beforePhotoUri && afterProofUri);
  const rtlRow = isRTL ? styles.rowReverse : undefined;
  const rtlText = isRTL ? styles.textRight : undefined;

  return (
    <ScrollView
      ref={scrollViewRef}
      scrollEnabled={!isSlidingComparison}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Hero Visual: Interactive Before/After Slider when resolved with proof, else defect photo */}
      {hasBeforeAfterComparison ? (
        <BeforeAfterSlider
          beforeImageUrl={beforePhotoUri}
          afterImageUrl={afterProofUri as string}
          height={265}
          borderRadius={0}
          onSlidingStateChange={setIsSlidingComparison}
        />
      ) : (
        <View style={[styles.heroWrapper, { backgroundColor: colors.surfaceSubtle }]}>
          <Image source={resolveImageSource(beforePhotoUri)} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroTag}>
            <Text style={styles.heroTagText}>REPORTED EVIDENCE</Text>
          </View>
        </View>
      )}

      <View style={styles.body}>
        <View style={[styles.pillsRow, rtlRow]}>
          <StatusBadge status={report.status} />
          <CategoryBadge category={report.category} />
        </View>

        <Text style={[styles.title, { color: colors.text }, rtlText]}>{report.title}</Text>

        <View style={[styles.metaRow, rtlRow]}>
          <Feather name="user" size={12.5} color={colors.textMuted} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {report.userDisplayName}
          </Text>
          <Text style={[styles.metaDot, { color: colors.textSubtle }]}>•</Text>
          <Feather name="clock" size={12.5} color={colors.textMuted} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {formatRelativeTime(report.createdAt)}
          </Text>
        </View>

        {/* Status Lifecycle Stepper Card */}
        <View style={[styles.stepperCard, { backgroundColor: colors.card }, hairlineBorder]}>
          <Text style={[styles.stepperHeading, { color: colors.text }, rtlText]}>
            Resolution Progress
          </Text>
          <View style={[styles.stepsRow, rtlRow]}>
            {LIFECYCLE_STEPS.map((step, index) => {
              const token = statusTokens[step];
              const isCompleted = index <= currentStepIdx;
              const isCurrent = index === currentStepIdx;

              return (
                <React.Fragment key={step}>
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                        isCompleted && {
                          backgroundColor: isCurrent ? token.dot : colors.emerald,
                          borderColor: isCurrent ? token.dot : colors.emerald,
                        },
                      ]}
                    >
                      <Feather
                        name={
                          index < currentStepIdx || isResolvedOrCompleted
                            ? 'check'
                            : token.icon
                        }
                        size={12}
                        color={isCompleted ? colors.white : colors.textSubtle}
                      />
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        { color: colors.textMuted },
                        isCompleted && { color: colors.text, fontWeight: '600' },
                      ]}
                    >
                      {t(`status.${step}`, { defaultValue: token.label })}
                    </Text>
                  </View>
                  {index < LIFECYCLE_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepConnector,
                        { backgroundColor: colors.border },
                        index < currentStepIdx && { backgroundColor: colors.emerald },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Location Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }, hairlineBorder, rtlRow]}>
          <View style={[styles.locationIconBox, { backgroundColor: colors.accentSoft }]}>
            <Feather name="map-pin" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }, rtlText]}>
              {t('common.location').toUpperCase()}
            </Text>
            <Text style={[styles.infoAddress, { color: colors.text }, rtlText]}>
              {report.location.address}
            </Text>
            <Text style={[styles.infoCoords, { color: colors.textMuted }, rtlText]}>
              {report.location.latitude.toFixed(5)}° N, {report.location.longitude.toFixed(5)}° E
            </Text>
          </View>
        </View>

        {/* Description Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }, hairlineBorder]}>
          <Text style={[styles.sectionHeading, { color: colors.text }, rtlText]}>
            Incident Description
          </Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }, rtlText]}>
            {report.description}
          </Text>
        </View>

        {/* Community Priority Upvote Bar */}
        <View style={[styles.upvoteCard, { backgroundColor: colors.card }, hairlineBorder, rtlRow]}>
          <View style={{ flex: 1, paddingRight: isRTL ? 0 : Spacing.md, paddingLeft: isRTL ? Spacing.md : 0 }}>
            <Text style={[styles.upvoteTitle, { color: colors.text }, rtlText]}>
              Impacted by this issue?
            </Text>
            <Text style={[styles.upvoteSubtitle, { color: colors.textMuted }, rtlText]}>
              Confirming boosts priority for municipal dispatch.
            </Text>
          </View>
          <UpvoteButton
            reportId={report.id}
            initialCount={report.upvotesCount || 0}
            hasUpvoted={hasUpvoted}
            currentUserId={user?.uid}
          />
        </View>

        {/* Verified After Resolution Card */}
        {isResolvedOrCompleted && afterProofUri ? (
          <View
            style={[
              styles.resolvedCard,
              { backgroundColor: colors.card, borderColor: colors.emerald },
            ]}
          >
            <View style={[styles.resolvedHeader, rtlRow]}>
              <View style={[styles.resolvedIconCircle, { backgroundColor: colors.emeraldSoft }]}>
                <Feather name="check-circle" size={18} color={colors.emerald} />
              </View>
              <View>
                <Text style={[styles.resolvedTitle, { color: colors.emerald }, rtlText]}>
                  Verified Resolution
                </Text>
                <Text style={[styles.resolvedSub, { color: colors.textMuted }, rtlText]}>
                  Completed by {report.resolution?.resolvedByName || 'Municipal Staff'}
                </Text>
              </View>
            </View>

            {hasBeforeAfterComparison ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerLightHaptic();
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }}
                style={[
                  styles.compareBannerBtn,
                  { backgroundColor: colors.emeraldSoft, borderColor: colors.emerald },
                  rtlRow,
                ]}
              >
                <Feather name="sliders" size={14} color={colors.emerald} />
                <Text style={[styles.compareBannerText, { color: colors.emerald }, rtlText]}>
                  {t('comparison.compareAboveHint')}
                </Text>
                <Feather name="arrow-up" size={14} color={colors.emerald} />
              </TouchableOpacity>
            ) : (
              <View style={styles.afterImageWrap}>
                <Image source={resolveImageSource(afterProofUri)} style={styles.afterImage} resizeMode="cover" />
                <View style={[styles.afterBadge, { backgroundColor: colors.emerald }]}>
                  <Text style={styles.afterBadgeText}>AFTER INTERVENTION</Text>
                </View>
              </View>
            )}

            {report.resolution?.notes ? (
              <View style={[styles.notesBox, { backgroundColor: colors.inputBg }, hairlineBorder]}>
                <Text style={[styles.notesLabel, { color: colors.textMuted }, rtlText]}>
                  MUNICIPAL FIELD NOTES
                </Text>
                <Text style={[styles.notesText, { color: colors.textSecondary }, rtlText]}>
                  {report.resolution.notes}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Verified Municipal Staff Controls (Employee OR Admin) */}
        {isStaff && !isResolvedOrCompleted && (
          <View
            style={[
              styles.adminCard,
              { backgroundColor: colors.card, borderColor: colors.accent },
            ]}
          >
            <Text style={[styles.adminHeading, { color: colors.text }, rtlText]}>
              Municipal Dispatch Controls
            </Text>
            <Text style={[styles.adminSub, { color: colors.textMuted }, rtlText]}>
              Verified Claim: {role.toUpperCase()} • Transition status or attach After proof.
            </Text>

            {report.status === 'pending' && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.dispatchBtn, { backgroundColor: colors.accent }]}
                onPress={handleSetInProgress}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Feather name="truck" size={16} color={colors.white} />
                    <Text style={styles.dispatchBtnText}>Dispatch Crew (Mark In Progress)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.resolveBtn, { backgroundColor: colors.emerald }]}
              onPress={() => {
                triggerLightHaptic();
                router.push({
                  pathname: isAdmin ? '/admin/resolve-modal' : '/employee/resolve-modal',
                  params: {
                    id: report.id,
                    title: report.title,
                    beforeImage: report.imageUrl,
                  },
                });
              }}
            >
              <Ionicons name="camera" size={18} color={colors.white} />
              <Text style={styles.resolveBtnText}>Upload "After" Proof & Resolve</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Strict Admin-Only Moderation Controls */}
        {isAdmin && (
          <View style={styles.adminGovRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.triageLinkBtn, { backgroundColor: colors.card }, hairlineBorder]}
              onPress={() => router.push('/admin')}
            >
              <Feather name="sliders" size={15} color={colors.primary} />
              <Text style={[styles.triageLinkText, { color: colors.primary }]}>
                Admin Triage Console
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.deleteBtn, { backgroundColor: colors.dangerSoft }]}
              onPress={handleDeleteReport}
            >
              <Feather name="trash-2" size={15} color={colors.danger} />
              <Text style={[styles.deleteBtnText, { color: colors.danger }]}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Public & Municipal Comments Feed */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }, hairlineBorder]}>
          <Text style={[styles.sectionHeading, { color: colors.text }, rtlText]}>
            Community & Field Updates ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={[styles.noCommentsText, { color: colors.textSubtle }, rtlText]}>
              No updates posted yet.
            </Text>
          ) : (
            <View style={{ gap: 10, marginTop: 6 }}>
              {comments.map((cmt) => (
                <View
                  key={cmt.id}
                  style={[styles.commentBubble, { backgroundColor: colors.inputBg }, hairlineBorder]}
                >
                  <View style={[styles.commentTop, rtlRow]}>
                    <Text style={[styles.commentAuthor, { color: colors.text }]}>
                      {cmt.userDisplayName}
                    </Text>
                    <Text style={[styles.commentRoleTag, { color: colors.accent }]}>
                      {cmt.userRole.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.commentBody, { color: colors.textSecondary }, rtlText]}>
                    {cmt.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {user && (
            <View style={[styles.commentComposer, rtlRow]}>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                  rtlText,
                ]}
                placeholder="Add a factual observation or follow-up..."
                placeholderTextColor={colors.textSubtle}
                value={commentText}
                onChangeText={setCommentText}
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.commentSendBtn,
                  { backgroundColor: colors.primary },
                  (!commentText.trim() || postingComment) && { opacity: 0.5 },
                ]}
                onPress={handlePostComment}
                disabled={!commentText.trim() || postingComment}
              >
                <Ionicons name="send" size={16} color={colors.primaryTextOn} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  notFoundTitle: {
    ...Typography.sectionHeader,
    marginTop: Spacing.md,
  },
  backBtn: {
    marginTop: Spacing.base,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  backBtnText: {
    fontWeight: '600',
  },
  heroWrapper: {
    height: 250,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroTag: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  heroTagText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  body: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    ...Typography.title,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    ...Typography.micro,
  },
  metaDot: {
    fontSize: 12,
  },
  stepperCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Elevation.ambient,
  },
  stepperHeading: {
    ...Typography.label,
    marginBottom: Spacing.md,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    marginBottom: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.md + 2,
    gap: Spacing.md,
    ...Elevation.ambient,
  },
  locationIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  infoAddress: {
    ...Typography.label,
    fontSize: 14,
    marginTop: 2,
  },
  infoCoords: {
    ...Typography.micro,
    fontSize: 11.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  sectionCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Elevation.ambient,
  },
  sectionHeading: {
    ...Typography.label,
    fontSize: 14,
    marginBottom: 6,
  },
  descriptionText: {
    ...Typography.body,
  },
  upvoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Elevation.ambient,
  },
  upvoteTitle: {
    ...Typography.label,
    fontSize: 14.5,
  },
  upvoteSubtitle: {
    ...Typography.micro,
    marginTop: 2,
  },
  resolvedCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    borderWidth: 1,
    ...Elevation.ambient,
  },
  resolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  resolvedIconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  resolvedSub: {
    ...Typography.micro,
    marginTop: 1,
  },
  afterImageWrap: {
    height: 190,
    borderRadius: Radius.thumbnail,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.md,
  },
  afterImage: {
    width: '100%',
    height: '100%',
  },
  afterBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  afterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  compareBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: 8,
  },
  compareBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  notesBox: {
    borderRadius: Radius.input,
    padding: Spacing.md,
  },
  notesLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  notesText: {
    ...Typography.body,
    fontSize: 14,
  },
  adminCard: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    borderWidth: 1,
    ...Elevation.ambient,
  },
  adminHeading: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  adminSub: {
    ...Typography.micro,
    marginTop: 3,
    marginBottom: Spacing.md,
  },
  dispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: Radius.input,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  dispatchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: Radius.input,
    gap: 8,
  },
  resolveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminGovRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  triageLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: Radius.input,
    gap: 6,
  },
  triageLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: Radius.input,
    gap: 6,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noCommentsText: {
    ...Typography.micro,
    marginBottom: Spacing.sm,
  },
  commentBubble: {
    borderRadius: Radius.input,
    padding: Spacing.sm + 2,
  },
  commentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  commentRoleTag: {
    fontSize: 10,
    fontWeight: '700',
  },
  commentBody: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  commentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
