/**
 * Interactive Before / After Comparison Slider (`src/components/BeforeAfterSlider.tsx`)
 *
 * Renders the "Before" defect image underneath and clips the "After" repaired image
 * pixel-aligned above it along a draggable vertical split handle (`PanResponder` + `Animated`).
 * Triggers subtle `expo-haptics` detents when reaching edges or center 50%.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Radius, Spacing, Elevation } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic, triggerSelectionHaptic } from '../utils/haptics';
import { resolveImageSource } from '../utils/imageResolver';

export interface BeforeAfterSliderProps {
  beforeImageUrl: string | any;
  afterImageUrl: string | any;
  beforeLabel?: string;
  afterLabel?: string;
  height?: number;
  initialRatio?: number;
  borderRadius?: number;
  showHint?: boolean;
  onSlidingStateChange?: (isSliding: boolean) => void;
}

const HANDLE_HIT_WIDTH = 44;
const HANDLE_HALF_WIDTH = HANDLE_HIT_WIDTH / 2;

type HapticDetent = 'left' | 'center' | 'right' | null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImageUrl,
  afterImageUrl,
  beforeLabel,
  afterLabel,
  height = 260,
  initialRatio = 0.5,
  borderRadius = Radius.card,
  showHint = true,
  onSlidingStateChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const widthRef = useRef(0);
  const ratioRef = useRef(clamp(initialRatio, 0, 1));
  const currentXRef = useRef(0);
  const dragStartXRef = useRef(0);
  const lastDetentRef = useRef<HapticDetent>('center');

  const splitXAnim = useRef(new Animated.Value(0)).current;
  const afterWidthAnim = useRef(new Animated.Value(0)).current;

  const slidingCallbackRef = useRef(onSlidingStateChange);
  slidingCallbackRef.current = onSlidingStateChange;

  const resolvedBeforeLabel = beforeLabel || t('comparison.before', { defaultValue: 'Before' });
  const resolvedAfterLabel = afterLabel || t('comparison.after', { defaultValue: 'After' });

  const applySplitPosition = useCallback(
    (nextX: number, emitHaptics: boolean) => {
      const w = widthRef.current;
      if (w <= 0) return;

      const clampedX = clamp(nextX, 0, w);
      const ratio = clampedX / w;

      currentXRef.current = clampedX;
      ratioRef.current = ratio;
      splitXAnim.setValue(clampedX);
      afterWidthAnim.setValue(Math.max(0, w - clampedX));

      if (!emitHaptics) return;

      if (ratio <= 0.025) {
        if (lastDetentRef.current !== 'left') {
          lastDetentRef.current = 'left';
          triggerLightHaptic();
        }
      } else if (ratio >= 0.975) {
        if (lastDetentRef.current !== 'right') {
          lastDetentRef.current = 'right';
          triggerLightHaptic();
        }
      } else if (Math.abs(ratio - 0.5) <= 0.02) {
        if (lastDetentRef.current !== 'center') {
          lastDetentRef.current = 'center';
          triggerSelectionHaptic();
        }
      } else if (
        (ratio > 0.06 && ratio < 0.44) ||
        (ratio > 0.56 && ratio < 0.94)
      ) {
        lastDetentRef.current = null;
      }
    },
    [splitXAnim, afterWidthAnim]
  );

  const animateSplitTo = useCallback(
    (targetX: number) => {
      const w = widthRef.current;
      if (w <= 0) return;
      const clampedX = clamp(targetX, 0, w);
      const nextRatio = clampedX / w;
      currentXRef.current = clampedX;
      ratioRef.current = nextRatio;

      if (nextRatio <= 0.025) lastDetentRef.current = 'left';
      else if (nextRatio >= 0.975) lastDetentRef.current = 'right';
      else if (Math.abs(nextRatio - 0.5) <= 0.02) lastDetentRef.current = 'center';
      else lastDetentRef.current = null;

      Animated.parallel([
        Animated.timing(splitXAnim, {
          toValue: clampedX,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.timing(afterWidthAnim, {
          toValue: Math.max(0, w - clampedX),
          duration: 180,
          useNativeDriver: false,
        }),
      ]).start();

      triggerSelectionHaptic();
    },
    [splitXAnim, afterWidthAnim]
  );

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== widthRef.current) {
      widthRef.current = nextWidth;
      setContainerWidth(nextWidth);
      const targetX = nextWidth * ratioRef.current;
      applySplitPosition(targetX, false);
    }
  };

  useEffect(() => {
    if (widthRef.current > 0) {
      const resetRatio = clamp(initialRatio, 0, 1);
      ratioRef.current = resetRatio;
      applySplitPosition(widthRef.current * resetRatio, false);
    }
  }, [beforeImageUrl, afterImageUrl, initialRatio, applySplitPosition]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 3,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStartXRef.current = currentXRef.current;
          setIsDragging(true);
          slidingCallbackRef.current?.(true);
        },
        onPanResponderMove: (_, gestureState) => {
          const nextX = dragStartXRef.current + gestureState.dx;
          applySplitPosition(nextX, true);
        },
        onPanResponderRelease: (evt, gestureState) => {
          setIsDragging(false);
          slidingCallbackRef.current?.(false);

          // Pure tap (< 4px drag): smoothly slide handle to the tapped horizontal position
          if (Math.abs(gestureState.dx) < 4 && Math.abs(gestureState.dy) < 4) {
            const tapX = evt.nativeEvent.locationX;
            if (typeof tapX === 'number' && Number.isFinite(tapX)) {
              animateSplitTo(tapX);
            }
          }
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          slidingCallbackRef.current?.(false);
        },
      }),
    [applySplitPosition, animateSplitTo]
  );

  const beforeLabelOpacity =
    containerWidth > 0
      ? splitXAnim.interpolate({
          inputRange: [0, Math.min(56, containerWidth * 0.25)],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        })
      : 1;

  const afterLabelOpacity =
    containerWidth > 0
      ? splitXAnim.interpolate({
          inputRange: [
            Math.max(0, containerWidth - Math.min(56, containerWidth * 0.25)),
            containerWidth,
          ],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        })
      : 1;

  const dividerTranslateX = Animated.subtract(splitXAnim, HANDLE_HALF_WIDTH);

  return (
    <View
      onLayout={handleContainerLayout}
      style={[
        styles.container,
        {
          height,
          borderRadius,
          backgroundColor: colors.surfaceSubtle,
        },
      ]}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={`${resolvedBeforeLabel} and ${resolvedAfterLabel} comparison slider`}
    >
      {/* Layer 1 (Underneath): Full-Width "Before" Defect Photo */}
      <View style={styles.fullLayer} pointerEvents="none">
        <Image
          source={resolveImageSource(beforeImageUrl)}
          style={styles.fullImage}
          resizeMode="cover"
        />
      </View>

      {/* Layer 2 (Above, Clipped on Right Side): Pixel-Aligned "After" Resolution Photo */}
      {containerWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.afterClipContainer,
            {
              width: afterWidthAnim,
            },
          ]}
        >
          <Image
            source={resolveImageSource(afterImageUrl)}
            style={[
              styles.afterAlignedImage,
              {
                width: containerWidth,
                height,
              },
            ]}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      {/* Floating Semantic Tags ("Before / Avant" on Left, "After / Après" on Right) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.floatingPill,
          styles.beforePillPos,
          { opacity: beforeLabelOpacity },
        ]}
      >
        <View style={[styles.tagDot, { backgroundColor: '#F59E0B' }]} />
        <Text style={styles.pillText}>{resolvedBeforeLabel.toUpperCase()}</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.floatingPill,
          styles.afterPillPos,
          { backgroundColor: 'rgba(5, 150, 105, 0.90)', opacity: afterLabelOpacity },
        ]}
      >
        <View style={[styles.tagDot, { backgroundColor: '#A7F3D0' }]} />
        <Text style={styles.pillText}>{resolvedAfterLabel.toUpperCase()}</Text>
      </Animated.View>

      {/* Bottom Interactive Scrub Hint */}
      {showHint && !isDragging && (
        <View pointerEvents="none" style={styles.bottomHintWrap}>
          <View style={styles.bottomHintPill}>
            <Feather name="sliders" size={11} color="#E2E8F0" />
            <Text style={styles.bottomHintText}>{t('comparison.dragHint')}</Text>
          </View>
        </View>
      )}

      {/* Draggable Vertical Divider & Thumb Handle */}
      {containerWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dividerRail,
            {
              transform: [{ translateX: dividerTranslateX }],
            },
          ]}
        >
          <View style={styles.verticalLine} />
          <View
            style={[
              styles.handleKnob,
              {
                borderColor: isDragging ? colors.emerald : '#FFFFFF',
                transform: [{ scale: isDragging ? 1.08 : 1 }],
              },
            ]}
          >
            <Feather name="chevron-left" size={14} color="#0F172A" />
            <Feather name="chevron-right" size={14} color="#0F172A" />
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  fullLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  afterClipContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
  },
  afterAlignedImage: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  floatingPill: {
    position: 'absolute',
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.80)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  beforePillPos: {
    left: 14,
  },
  afterPillPos: {
    right: 14,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  bottomHintWrap: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  bottomHintText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  dividerRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: HANDLE_HIT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  handleKnob: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: -2,
    ...Elevation.floating,
  },
});
