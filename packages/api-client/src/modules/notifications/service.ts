import { apiFetch } from '../../http/fetch-client';
import {
  notificationPreferencesSchema,
  pushPublicKeySchema,
  pushSubscriptionRequestSchema,
  pushTestResponseSchema,
  pushUnsubscribeRequestSchema,
  updatePreferencesRequestSchema,
  type NotificationPreferences,
  type PushSubscriptionRequest,
  type PushTestResponse,
  type PushUnsubscribeRequest,
  type UpdatePreferencesRequest,
} from './schemas';

export async function getPreferences(): Promise<NotificationPreferences> {
  return apiFetch('/me/notifications/preferences', {
    schema: notificationPreferencesSchema,
  });
}

export async function updatePreferences(
  input: UpdatePreferencesRequest,
): Promise<NotificationPreferences> {
  const body = updatePreferencesRequestSchema.parse(input);

  return apiFetch('/me/notifications/preferences', {
    method: 'PATCH',
    body,
    schema: notificationPreferencesSchema,
  });
}

/** 409 `PUSH_UNAVAILABLE` quando o servidor não tem as chaves VAPID. */
export async function getPushPublicKey(): Promise<{ publicKey: string }> {
  return apiFetch('/me/notifications/push/public-key', {
    schema: pushPublicKeySchema,
  });
}

/** Registra este navegador e liga o canal push. Devolve as preferências. */
export async function subscribePush(
  input: PushSubscriptionRequest,
): Promise<NotificationPreferences> {
  const body = pushSubscriptionRequestSchema.parse(input);

  return apiFetch('/me/notifications/push/subscriptions', {
    method: 'POST',
    body,
    schema: notificationPreferencesSchema,
  });
}

/**
 * Apaga a inscrição deste navegador. **Não** desliga `channels.push` — quem
 * chama manda o `updatePreferences` à parte.
 */
export async function unsubscribePush(
  input: PushUnsubscribeRequest,
): Promise<NotificationPreferences> {
  const body = pushUnsubscribeRequestSchema.parse(input);

  return apiFetch('/me/notifications/push/subscriptions', {
    method: 'DELETE',
    body,
    schema: notificationPreferencesSchema,
  });
}

export async function testPush(): Promise<PushTestResponse> {
  return apiFetch('/me/notifications/push/test', {
    method: 'POST',
    schema: pushTestResponseSchema,
  });
}
