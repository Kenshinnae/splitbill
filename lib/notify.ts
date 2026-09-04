const NOTIFY_KEY = (billId: string) => `splitbill_all_done_notified_${billId}`;

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function wasAllDoneNotified(billId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(NOTIFY_KEY(billId)) === "1";
}

export function markAllDoneNotified(billId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(NOTIFY_KEY(billId), "1");
}

export function clearAllDoneNotified(billId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(NOTIFY_KEY(billId));
}

/** Local / PWA notification when the owner still has the app open. */
export function showLocalNotification(
  title: string,
  options?: { body?: string; tag?: string },
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const opts: NotificationOptions = {
    body: options?.body,
    tag: options?.tag,
    icon: "/icon",
  };

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => {
        try {
          new Notification(title, opts);
        } catch {
          /* ignore */
        }
      });
    return;
  }

  try {
    new Notification(title, opts);
  } catch {
    /* ignore */
  }
}
