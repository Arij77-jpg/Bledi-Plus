/**
 * Notifications Modal Component (`src/components/NotificationsModal.tsx`)
 *
 * Displays real-time municipal notifications for Admins & Regional Employees.
 * Provides unread badges, one-tap navigation to report details, and "Mark all as read".
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService';
import { MunicipalNotification } from '../types/report';
import { Radius, Spacing, Typography, Elevation } from '../constants/theme';
import { formatRelativeTime } from '../utils/formatting';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const router = useRouter();
  const { colors, hairlineBorder } = useTheme();
  const { user } = useAuth();
  const effectiveUserId = userId || user?.uid;

  const [notifications, setNotifications] = useState<MunicipalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUserId || !visible) return;

    setLoading(true);
    const unsub = subscribeToUserNotifications(
      effectiveUserId,
      (list) => {
        setNotifications(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [effectiveUserId, visible]);

  const handleSelectNotification = async (item: MunicipalNotification) => {
    triggerLightHaptic();
    if (effectiveUserId && !item.read) {
      await markNotificationAsRead(effectiveUserId, item.id);
    }
    onClose();
    if (item.reportId) {
      router.push(`/report/${item.reportId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!effectiveUserId) return;
    triggerSuccessHaptic();
    await markAllNotificationsAsRead(effectiveUserId);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.headerLeft}>
              <View style={[styles.bellBox, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="notifications" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Toutes vos alertes sont à jour'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleMarkAllRead}
                  style={[styles.readAllBtn, { backgroundColor: colors.surfaceSubtle }]}
                >
                  <Text style={[styles.readAllText, { color: colors.primary }]}>Tout lire</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle }]}
              >
                <Feather name="x" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* List or Empty State */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune notification</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Vous serez alerté dès qu'un citoyen signalera un incident dans votre délégation.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isUnread = !item.read;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleSelectNotification(item)}
                    style={[
                      styles.notifCard,
                      {
                        backgroundColor: isUnread ? colors.surfaceSubtle : colors.card,
                        borderColor: isUnread ? colors.primarySoft : colors.border,
                      },
                      hairlineBorder,
                    ]}
                  >
                    <View style={styles.notifRow}>
                      <View
                        style={[
                          styles.iconCircle,
                          {
                            backgroundColor: isUnread
                              ? colors.primarySoft
                              : colors.surfaceSubtle,
                          },
                        ]}
                      >
                        <Feather
                          name={isUnread ? 'alert-circle' : 'bell'}
                          size={16}
                          color={isUnread ? colors.primary : colors.textMuted}
                        />
                      </View>

                      <View style={styles.notifBody}>
                        <View style={styles.notifTopLine}>
                          <Text
                            style={[
                              styles.notifTitle,
                              { color: colors.text, fontWeight: isUnread ? '700' : '600' },
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                        </View>

                        <Text
                          style={[styles.notifSnippet, { color: colors.textMuted }]}
                          numberOfLines={2}
                        >
                          {item.body}
                        </Text>

                        <View style={styles.notifFooter}>
                          {item.region ? (
                            <View
                              style={[
                                styles.regionBadge,
                                { backgroundColor: colors.surfaceSubtle },
                              ]}
                            >
                              <Ionicons name="location-outline" size={10} color={colors.accent} />
                              <Text style={[styles.regionBadgeText, { color: colors.accent }]}>
                                {item.region}
                              </Text>
                            </View>
                          ) : null}

                          <Text style={[styles.timeText, { color: colors.textSubtle }]}>
                            {formatRelativeTime(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '75%',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bellBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  readAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  notifCard: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    ...Elevation.ambient,
  },
  notifRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifBody: {
    flex: 1,
  },
  notifTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifSnippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  regionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
  },
});
