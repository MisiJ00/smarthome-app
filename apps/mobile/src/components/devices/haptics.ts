import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Short physical feedback when switching. On Android the haptics engine (performAndroidHapticsAsync) instead of the
// Vibrator, as the expo-haptics docs (SDK 58) recommend; on iOS the impact generator. Errors are ignored: a phone
// without haptics just stays still.

const ignore = () => {};

/** A switch (or lock) was flipped on or off. */
export function toggleFeedback(on: boolean) {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off).catch(ignore);
  } else {
    Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  }
}

/** A choice changed: mode segment, setpoint step, slider let go. */
export function tickFeedback() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(ignore);
  } else {
    Haptics.selectionAsync().catch(ignore);
  }
}

/** Something important worked (door opened after the fingerprint). */
export function successFeedback() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(ignore);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  }
}

/** Something was refused (locked action, failed approval). */
export function rejectFeedback() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject).catch(ignore);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
  }
}
