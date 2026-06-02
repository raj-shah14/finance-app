import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { db } from "@/lib/db";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const CONTACT = process.env.VAPID_CONTACT_EMAIL ?? "mailto:admin@example.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path to open when the notification is tapped. */
  url?: string;
  /** Tag to coalesce / replace older notifications. */
  tag?: string;
  /** Optional icon override. */
  icon?: string;
};

/**
 * Send a push notification to every subscription registered for a
 * user. Subscriptions that fail with 404/410 are automatically pruned
 * (the browser revoked them).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number; errors: number }> {
  if (!ensureConfigured()) {
    return { sent: 0, pruned: 0, errors: 0 };
  }

  const subs = await db.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  let pruned = 0;
  let errors = 0;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
    icon: payload.icon ?? "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  });

  await Promise.all(
    subs.map(async (sub) => {
      const target: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(target, message);
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 0;
        if (status === 404 || status === 410) {
          // Subscription is gone — clean up.
          await db.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
          pruned += 1;
        } else {
          console.error("Push send error", { endpoint: sub.endpoint, status, err });
          errors += 1;
        }
      }
    })
  );

  return { sent, pruned, errors };
}
