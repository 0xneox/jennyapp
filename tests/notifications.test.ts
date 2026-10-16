import { Platform } from 'react-native';

// Set up mock state
let mockPermissions = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

let scheduledNotifications: any[] = [];
let requestPermissionsCallCount = 0;
let getPermissionsCallCount = 0;
let notificationResponseListener: ((response: any) => void) | null = null;
let lastNotificationResponse: any = null;

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
  AndroidImportance: {
    DEFAULT: 5,
  },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
  },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => {
    getPermissionsCallCount++;
    return { ...mockPermissions };
  }),
  requestPermissionsAsync: jest.fn(async () => {
    requestPermissionsCallCount++;
    return { ...mockPermissions };
  }),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...scheduledNotifications]),
  scheduleNotificationAsync: jest.fn(async (req: any) => {
    scheduledNotifications.push(req);
    return req.identifier || 'test-id';
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
    scheduledNotifications = scheduledNotifications.filter((n) => n.identifier !== identifier);
  }),
  getLastNotificationResponseAsync: jest.fn(async () => lastNotificationResponse),
  addNotificationResponseReceivedListener: jest.fn((listener: (res: any) => void) => {
    notificationResponseListener = listener;
    return {
      remove: jest.fn(() => {
        notificationResponseListener = null;
      }),
    };
  }),
}));

import {
  initNotificationsOnAppLaunch,
  scheduleDailyNotification,
  cancelDailyNotification,
  setNotificationsToggle,
  checkNotificationPermission,
  requestNotificationPermission,
  registerNotificationTapListener,
  DAILY_CHANNEL_ID,
  DAILY_NOTIFICATION_ID,
  NOTIFICATION_HOUR,
  NOTIFICATION_MINUTE,
  NOTIFICATION_TITLE,
  NOTIFICATION_BODY,
} from '../src/utils/notifications';

import {
  setNotificationsEnabled,
  getNotificationsEnabled,
  setNotificationPromptShown,
  getNotificationPromptShown,
  storageReady,
} from '../src/utils/storage';

import { useGameStore } from '../src/store/gameStore';

describe('Jennydoku Daily Local Notification System', () => {
  beforeEach(async () => {
    await storageReady;
    // Reset test state
    scheduledNotifications = [];
    requestPermissionsCallCount = 0;
    getPermissionsCallCount = 0;
    notificationResponseListener = null;
    lastNotificationResponse = null;

    mockPermissions = {
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    };

    // Reset storage keys
    await setNotificationPromptShown(false);
    await setNotificationsEnabled(false);

    // Mock platform to android for notification engine testing
    (Platform as any).OS = 'android';
  });

  describe('Verification 1 & 2: Fresh install & permission granted', () => {
    it('executes permission flow on fresh install and schedules notification when granted', async () => {
      mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };

      expect(await getNotificationPromptShown()).toBe(false);

      await initNotificationsOnAppLaunch();

      expect(requestPermissionsCallCount).toBe(0); // Already granted in status
      expect(await getNotificationPromptShown()).toBe(true);
      expect(await getNotificationsEnabled()).toBe(true);
      expect(scheduledNotifications.length).toBe(1);

      const scheduled = scheduledNotifications[0];
      expect(scheduled.identifier).toBe(DAILY_NOTIFICATION_ID);
      expect(scheduled.content.title).toBe(NOTIFICATION_TITLE);
      expect(scheduled.content.body).toBe(NOTIFICATION_BODY);
      expect(scheduled.content.data).toEqual({ action: 'daily_puzzle' });
      expect(scheduled.trigger.type).toBe('daily');
      expect(scheduled.trigger.hour).toBe(9);
      expect(scheduled.trigger.minute).toBe(0);
      expect(scheduled.trigger.channelId).toBe(DAILY_CHANNEL_ID);
    });

    it('requests permission if undetermined and schedules if user permits', async () => {
      mockPermissions = {
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      };

      // Mock that user will grant in the dialog
      const Notifications = require('expo-notifications');
      Notifications.requestPermissionsAsync.mockImplementationOnce(async () => {
        requestPermissionsCallCount++;
        mockPermissions = {
          status: 'granted',
          granted: true,
          canAskAgain: true,
          expires: 'never',
        };
        return { ...mockPermissions };
      });

      await initNotificationsOnAppLaunch();

      expect(requestPermissionsCallCount).toBe(1);
      expect(await getNotificationPromptShown()).toBe(true);
      expect(await getNotificationsEnabled()).toBe(true);
      expect(scheduledNotifications.length).toBe(1);
    });
  });

  describe('Verification 3: Permission denied → no repeated permission prompts', () => {
    it('records denial on fresh install and never re-prompts on subsequent boots', async () => {
      mockPermissions = {
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      };

      await initNotificationsOnAppLaunch();

      expect(await getNotificationPromptShown()).toBe(true);
      expect(await getNotificationsEnabled()).toBe(false);
      expect(scheduledNotifications.length).toBe(0);

      // Subsequent app launch
      const prevRequests = requestPermissionsCallCount;
      await initNotificationsOnAppLaunch();

      // No new permission dialog was shown
      expect(requestPermissionsCallCount).toBe(prevRequests);
      expect(scheduledNotifications.length).toBe(0);
    });
  });

  describe('Verification 4 & 5: Setting Toggle ON / OFF', () => {
    it('cancels scheduled notification when user toggles OFF', async () => {
      // First enable and schedule
      mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };
      await setNotificationsToggle(true);
      expect(await getNotificationsEnabled()).toBe(true);
      expect(scheduledNotifications.length).toBe(1);

      // Now toggle OFF
      const success = await setNotificationsToggle(false);
      expect(success).toBe(true);
      expect(await getNotificationsEnabled()).toBe(false);
      expect(scheduledNotifications.length).toBe(0);
    });

    it('schedules notification when user toggles ON', async () => {
      mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };
      expect(scheduledNotifications.length).toBe(0);

      const success = await setNotificationsToggle(true);
      expect(success).toBe(true);
      expect(await getNotificationsEnabled()).toBe(true);
      expect(scheduledNotifications.length).toBe(1);
      expect(scheduledNotifications[0].identifier).toBe(DAILY_NOTIFICATION_ID);
    });

    it('rejects toggle ON if permission is permanently denied', async () => {
      mockPermissions = {
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      };

      const success = await setNotificationsToggle(true);
      expect(success).toBe(false);
      expect(await getNotificationsEnabled()).toBe(false);
      expect(scheduledNotifications.length).toBe(0);
    });
  });

  describe('Verification 6: App restart → no duplicate notification', () => {
    it('does not duplicate scheduled notification when app is reopened/restarted', async () => {
      mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };
      await setNotificationsEnabled(true);
      await setNotificationPromptShown(true);

      // First run schedules 1
      await initNotificationsOnAppLaunch();
      expect(scheduledNotifications.length).toBe(1);

      // Second launch / resume
      await initNotificationsOnAppLaunch();
      expect(scheduledNotifications.length).toBe(1);

      // Manual schedule call also deduplicates
      await scheduleDailyNotification();
      expect(scheduledNotifications.length).toBe(1);
    });
  });

  describe('Verification 7: Resilience to device restart', () => {
    it('reschedules notification if cleared by device reboot when preference is ON', async () => {
      mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };
      await setNotificationsEnabled(true);
      await setNotificationPromptShown(true);

      // Simulate device reboot clearing alarms in memory
      scheduledNotifications = [];

      // When app launches next, it restores the scheduled daily notification
      await initNotificationsOnAppLaunch();
      expect(scheduledNotifications.length).toBe(1);
      expect(scheduledNotifications[0].identifier).toBe(DAILY_NOTIFICATION_ID);
    });
  });

  describe('Verification 8: Tapping notification → opens daily puzzle', () => {
    it('launches daily challenge when notification is tapped while app is open', () => {
      let dailyLaunched = false;
      const unsub = registerNotificationTapListener(() => {
        dailyLaunched = true;
        useGameStore.getState().startDailyChallenge();
      });

      expect(notificationResponseListener).not.toBeNull();

      // Simulate user tapping daily notification
      notificationResponseListener!({
        notification: {
          request: {
            content: {
              data: { action: 'daily_puzzle' },
            },
          },
        },
      });

      expect(dailyLaunched).toBe(true);
      const state = useGameStore.getState();
      expect(state.activeScreen).toBe('game');
      expect(state.isDailyChallenge).toBe(true);

      unsub();
    });

    it('ignores notifications that are not for daily puzzle', () => {
      let dailyLaunched = false;
      const unsub = registerNotificationTapListener(() => {
        dailyLaunched = true;
      });

      notificationResponseListener!({
        notification: {
          request: {
            content: {
              data: { action: 'something_else' },
            },
          },
        },
      });

      expect(dailyLaunched).toBe(false);
      unsub();
    });
  });

  describe('Verification 9: Notification content and 9:00 AM local device time', () => {
    it('verifies exact title, body, and time configuration', async () => {
      expect(NOTIFICATION_TITLE).toBe('🧠 Ready to Train Your Brain?');
      expect(NOTIFICATION_BODY).toBe('Take a few minutes and solve today’s Jennydoku puzzle! 🐶🐾');
      expect(NOTIFICATION_HOUR).toBe(9);
      expect(NOTIFICATION_MINUTE).toBe(0);
      expect(DAILY_CHANNEL_ID).toBe('daily-puzzle');
    });
  });

  describe('Verification 10: Existing game functionality remains unaffected', () => {
    it('normal game levels can be started and played without interference', () => {
      const store = useGameStore.getState();
      store.startLevel(1);

      const stateAfter = useGameStore.getState();
      expect(stateAfter.activeScreen).toBe('game');
      expect(stateAfter.currentLevel).toBe(1);
      expect(stateAfter.isDailyChallenge).toBe(false);
      expect(stateAfter.board).not.toBeNull();
    });
  });
});
