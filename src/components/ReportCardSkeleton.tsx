/**
 * Shimmer-style Skeleton Card Placeholder
 * Replaces harsh centered ActivityIndicators during initial feed hydration.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import {
  Radius,
  Spacing,
  Elevation,
} from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface SkeletonListProps {
  count?: number;
}

const SingleSkeletonCard: React.FC<{ pulse: Animated.Value }> = ({ pulse }) => {
  const { colors, hairlineBorder } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
      <View style={styles.topRow}>
        <Animated.View
          style={[styles.thumb, { opacity: pulse, backgroundColor: colors.surfaceMuted }]}
        />
        <View style={styles.rightCol}>
          <View style={styles.pillRow}>
            <Animated.View
              style={[styles.pillShort, { opacity: pulse, backgroundColor: colors.surfaceMuted }]}
            />
            <Animated.View
              style={[styles.pillMed, { opacity: pulse, backgroundColor: colors.surfaceSubtle }]}
            />
          </View>
          <Animated.View
            style={[styles.titleLine1, { opacity: pulse, backgroundColor: colors.surfaceMuted }]}
          />
          <Animated.View
            style={[styles.titleLine2, { opacity: pulse, backgroundColor: colors.surfaceMuted }]}
          />
          <Animated.View
            style={[styles.metaLine, { opacity: pulse, backgroundColor: colors.surfaceSubtle }]}
          />
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.bottomRow}>
        <Animated.View
          style={[styles.addressLine, { opacity: pulse, backgroundColor: colors.surfaceSubtle }]}
        />
        <Animated.View
          style={[styles.votePill, { opacity: pulse, backgroundColor: colors.surfaceMuted }]}
        />
      </View>
    </View>
  );
};

export const ReportCardSkeletonList: React.FC<SkeletonListProps> = ({ count = 4 }) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.95,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, idx) => (
        <SingleSkeletonCard key={idx} pulse={pulse} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.md + 2,
    marginBottom: Spacing.md,
    ...Elevation.ambient,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: Radius.thumbnail,
  },
  rightCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pillShort: {
    width: 64,
    height: 20,
    borderRadius: Radius.pill,
  },
  pillMed: {
    width: 78,
    height: 20,
    borderRadius: Radius.pill,
  },
  titleLine1: {
    width: '92%',
    height: 15,
    borderRadius: 6,
    marginTop: 6,
  },
  titleLine2: {
    width: '65%',
    height: 15,
    borderRadius: 6,
    marginTop: 5,
  },
  metaLine: {
    width: '48%',
    height: 11,
    borderRadius: 5,
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm + 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressLine: {
    width: '55%',
    height: 12,
    borderRadius: 6,
  },
  votePill: {
    width: 82,
    height: 28,
    borderRadius: Radius.pill,
  },
});
