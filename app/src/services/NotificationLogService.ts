import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getNotifications } from './nativeModules';

let subscription: { remove: () => void } | null = null;
let handlerConfigured = false;

async function writeNotificationLog(
  userId: string,
  employeeName: string,
  title: string,
  body: string,
  appName: string,
): Promise<void> {
  const docId = `${userId}_${Date.now()}`;
  await setDoc(doc(db, 'notificationLogs', docId), {
    userId,
    employeeName,
    title,
    body,
    appName,
    timestamp: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function startNotificationLogging(userId: string, employeeName: string): Promise<void> {
  if (subscription) return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerConfigured = true;
    }

    await Notifications.requestPermissionsAsync();
  } catch {
    return;
  }

  subscription = Notifications.addNotificationReceivedListener(notification => {
    const content = notification.request.content;
    writeNotificationLog(
      userId,
      employeeName,
      content.title ?? 'Notification',
      content.body ?? '',
      content.subtitle ?? 'System',
    ).catch(() => undefined);
  });
}

export function stopNotificationLogging(): void {
  subscription?.remove();
  subscription = null;
}
