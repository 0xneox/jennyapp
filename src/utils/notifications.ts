import { Platform } from 'react-native';
import {
  storageReady,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getNotificationPromptShown,
  setNotificationPromptShown,
} from './storage';

export const DAILY_CHANNEL_ID = 'daily-puzzle';
export const DAILY_NOTIFICATION_ID = 'jenny_daily_puzzle_reminder';
export const NOTIFICATION_HOUR = 9;
export const NOTIFICATION_MINUTE = 0;

export const NOTIFICATION_TITLE = '🧠 Ready to Train Your Brain?';
export const NOTIFICATION_BODY = 'Take a few minutes and solve today’s Jennydoku puzzle! 🐶🐾';

/**
 * In Expo Go on Android (SDK 53+), expo-notifications throws a fatal error at
 * module load time because push notifications were removed from the Expo Go client.
 * We dynamically load expo-notifications only when NOT running in Expo Go on Android.
 * In development builds (expo run:android / EAS Build) and iOS, expo-notifications
 * loads and functions normally.
 */
function isRunningInExpoGoAndroid(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    const { isRunningInExpoGo } = require('expo');
    return typeof isRunningInExpoGo === 'function' && isRunningInExpoGo();
  } catch {
    return false;
  }
}

export const isExpoGoAndroid = isRunningInExpoGoAndroid();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
if (!isExpoGoAndroid) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    if (__DEV__) {
      console.warn('[notifications] Failed to load expo-notifications:', error);
    }
  }
}

// Configure notification presentation behavior when the app is in the foreground
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Safe fallback for environments where Notifications are not fully supported
  }
}

/**
 * Configure Android notification channel with friendly settings.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
      name: 'Daily Puzzle',
      description: 'Friendly daily invitation to solve today’s Jennydoku puzzle',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#13B0FA',
      enableLights: true,
      enableVibrate: true,
    });
  } catch (error) {
    if (__DEV__) console.warn('Failed to configure Android notification channel:', error);
  }
}

/**
 * Check if the user currently has notifications permitted on their device.
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (!Notifications || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    if (isExpoGoAndroid) {
      await storageReady;
      return (await getNotificationsEnabled()) === true;
    }
    return false;
  }
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/**
 * Request notification permissions via the platform dialog.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    if (isExpoGoAndroid) return true;
    return false;
  }
  try {
    const settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/**
 * Cancel the scheduled daily notification (and any stale duplicates).
 */
export async function cancelDailyNotification(): Promise<void> {
  if (!Notifications || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIFICATION_ID);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier === DAILY_NOTIFICATION_ID || notif.content?.data?.action === 'daily_puzzle') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    if (__DEV__) console.warn('Failed to cancel daily notification:', error);
  }
}

/**
 * Schedule the daily local notification for 9:00 AM local device time.
 * Fully idempotent: prevents duplicate notifications across app launches, restarts, or updates.
 */
export async function scheduleDailyNotification(): Promise<boolean> {
  if (!Notifications || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    if (isExpoGoAndroid) return true;
    return false;
  }
  try {
    await setupNotificationChannel();

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter(
      (req: any) => req.identifier === DAILY_NOTIFICATION_ID || req.content?.data?.action === 'daily_puzzle'
    );

    // If exactly one is already scheduled with our identifier, avoid creating duplicate
    if (existing.length === 1 && existing[0].identifier === DAILY_NOTIFICATION_ID) {
      return true;
    }

    // Clean up any stale or duplicated entries before scheduling
    if (existing.length > 0) {
      for (const notif of existing) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_NOTIFICATION_ID,
      content: {
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
        data: { action: 'daily_puzzle' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: NOTIFICATION_HOUR,
        minute: NOTIFICATION_MINUTE,
        channelId: DAILY_CHANNEL_ID,
      },
    });

    return true;
  } catch (error) {
    if (__DEV__) console.warn('Failed to schedule daily notification:', error);
    return false;
  }
}

/**
 * Handles user toggle switch in Settings.
 * Toggling OFF cancels notification and persists preference.
 * Toggling ON verifies/requests permission, schedules notification, and persists preference.
 */
export async function setNotificationsToggle(enable: boolean): Promise<boolean> {
  if (!enable) {
    await cancelDailyNotification();
    await setNotificationsEnabled(false);
    return true;
  }

  let hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    hasPermission = await requestNotificationPermission();
  }

  if (hasPermission) {
    await setNotificationsEnabled(true);
    await scheduleDailyNotification();
    return true;
  } else {
    await setNotificationsEnabled(false);
    return false;
  }
}

/**
 * Bootstraps notifications on app startup.
 * - Fresh install: executes initial permission flow. If granted, schedules daily notification.
 * - Denied: respects choice and never repeatedly prompts on future launches.
 * - Subsequent launch: verifies scheduled notification without prompting.
 */
export async function initNotificationsOnAppLaunch(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    await storageReady;
    if (!Notifications) {
      // Running in Expo Go on Android; mark prompt shown so it doesn't block flow
      const hasPrompted = await getNotificationPromptShown();
      if (!hasPrompted) {
        await setNotificationPromptShown(true);
        await setNotificationsEnabled(true);
      }
      return;
    }

    await setupNotificationChannel();

    const hasPrompted = await getNotificationPromptShown();
    const userPref = await getNotificationsEnabled();

    if (!hasPrompted) {
      // First launch: check current status and prompt once
      await setNotificationPromptShown(true);
      const currentStatus = await Notifications.getPermissionsAsync();
      let granted = currentStatus.granted || currentStatus.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

      if (!granted && (currentStatus.status === 'undetermined' || currentStatus.canAskAgain)) {
        granted = await requestNotificationPermission();
      }

      await setNotificationsEnabled(granted);
      if (granted) {
        await scheduleDailyNotification();
      }
    } else {
      // Subsequent launches: never repeatedly prompt
      if (userPref === true) {
        const hasPerm = await checkNotificationPermission();
        if (hasPerm) {
          await scheduleDailyNotification();
        }
      } else if (userPref === false) {
        await cancelDailyNotification();
      }
    }
  } catch (error) {
    if (__DEV__) console.warn('Error during notification initialization:', error);
  }
}

/**
 * Registers listeners for notification taps (cold boot & foreground/background).
 * When user taps a daily puzzle notification, invokes onOpenDailyPuzzle.
 */
export function registerNotificationTapListener(onOpenDailyPuzzle: () => void): () => void {
  if (!Notifications || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    return () => {};
  }

  try {
    // 1. App cold started from tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then((response: any) => {
        if (response) {
          const data = response.notification?.request?.content?.data;
          if (data?.action === 'daily_puzzle') {
            onOpenDailyPuzzle();
          }
        }
      })
      .catch(() => {});

    // 2. App opened from background/foreground via notification tap
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.action === 'daily_puzzle') {
        onOpenDailyPuzzle();
      }
    });

    return () => {
      subscription.remove();
    };
  } catch {
    return () => {};
  }
}
