import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';
import { toggleUpvote } from '../services/reports';
import { triggerLightHaptic } from '../utils/haptics';
import { getSafeErrorMessage } from '../utils/errors';

interface UpvoteButtonProps {
  reportId: string;
  initialCount: number;
  hasUpvoted: boolean;
  currentUserId?: string;
  compact?: boolean;
  onVoteToggled?: (newVoted: boolean, newCount: number) => void;
}

export const UpvoteButton: React.FC<UpvoteButtonProps> = ({
  reportId,
  initialCount,
  hasUpvoted,
  currentUserId,
  compact = false,
  onVoteToggled,
}) => {
  const { colors } = useTheme();
  const { isRTL } = usePreferences();
  const { t } = useTranslation();

  const [upvoted, setUpvoted] = useState(hasUpvoted);
  const [count, setCount] = useState(initialCount);
  const [isUpdating, setIsUpdating] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Keep synced with upstream Firestore listener updates
  useEffect(() => {
    if (!isUpdating) {
      setUpvoted(hasUpvoted);
      setCount(initialCount);
    }
  }, [hasUpvoted, initialCount, isUpdating]);

  const animateBounce = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        useNativeDriver: true,
        speed: 40,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 10,
      }),
    ]).start();
  };

  const handlePress = async () => {
    if (!currentUserId || isUpdating) return;

    triggerLightHaptic();
    animateBounce();

    // Optimistic UI update
    const nextVoted = !upvoted;
    const nextCount = nextVoted ? count + 1 : Math.max(0, count - 1);
    setUpvoted(nextVoted);
    setCount(nextCount);
    setIsUpdating(true);

    try {
      const serverResult = await toggleUpvote(reportId, currentUserId);
      if (onVoteToggled) {
        onVoteToggled(serverResult, nextCount);
      }
    } catch (err) {
      // Revert optimistic update cleanly and show sanitized error without raw stack traces
      setUpvoted(!nextVoted);
      setCount(count);
      Alert.alert('Vote Not Recorded', getSafeErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={!currentUserId || isUpdating}
        accessibilityRole="button"
        accessibilityLabel={upvoted ? `Remove upvote, ${count} votes` : `Upvote report, ${count} votes`}
        style={[
          styles.pill,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
          compact && styles.pillCompact,
          upvoted
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={upvoted ? 'thumbs-up' : 'thumbs-up-outline'}
            size={compact ? 13 : 14}
            color={upvoted ? colors.white : colors.accent}
          />
        </View>
        <Text
          style={[
            styles.countText,
            compact && styles.countTextCompact,
            { color: upvoted ? colors.white : colors.textPrimary },
          ]}
        >
          {count}
        </Text>
        {!compact && (
          <Text
            style={[
              styles.labelText,
              { color: upvoted ? 'rgba(255,255,255,0.92)' : colors.textMuted },
            ]}
          >
            {upvoted ? t('actions.confirmed') : t('actions.meToo')}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    gap: 5,
  },
  pillCompact: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countTextCompact: {
    fontSize: 12,
  },
  labelText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
