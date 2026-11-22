import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Safe cross-platform haptic triggers (graceful no-op on web).
 */
export async function triggerLightHaptic() {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export async function triggerSelectionHaptic() {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch (_) {}
}

export async function triggerSuccessHaptic() {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}

export async function triggerWarningHaptic() {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (_) {}
}
