import { z } from 'zod';

/**
 * Espelha `apps/api/src/modules/notifications/dto/notifications.dto.ts` e o
 * `PreferenceService.view`. Hora é inteira de 0 a 23, no fuso do aluno.
 */
const hourSchema = z.number().int().min(0).max(23);

export const notificationTypesSchema = z.object({
  dailyReminder: z.boolean(),
  reviewBacklog: z.boolean(),
  weeklySummary: z.boolean(),
});
export type NotificationTypes = z.infer<typeof notificationTypesSchema>;

/** `GET/PATCH /me/notifications/preferences`. */
export const notificationPreferencesSchema = z.object({
  types: notificationTypesSchema,
  channels: z.object({ email: z.boolean(), push: z.boolean() }),
  /** `null`: segue o horário de estudo preferido do perfil. */
  reminderHour: hourSchema.nullable(),
  /** A hora que vale de fato (a escolhida, ou a do horário preferido). */
  effectiveReminderHour: hourSchema,
  quietHours: z.object({ start: hourSchema, end: hourSchema }),
  push: z.object({
    /** Falso sem chaves VAPID no servidor: o e-mail segue sendo o canal. */
    available: z.boolean(),
    devices: z.number().int().min(0),
  }),
});
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export const updatePreferencesRequestSchema = z.object({
  types: notificationTypesSchema.partial().optional(),
  channels: z
    .object({ email: z.boolean(), push: z.boolean() })
    .partial()
    .optional(),
  reminderHour: hourSchema.nullable().optional(),
  quietHours: z.object({ start: hourSchema, end: hourSchema }).optional(),
});
export type UpdatePreferencesRequest = z.infer<
  typeof updatePreferencesRequestSchema
>;

export const pushPublicKeySchema = z.object({ publicKey: z.string() });

/** O que `pushManager.subscribe()` devolve em JSON (`PushSubscription.toJSON()`). */
export const pushSubscriptionRequestSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(128),
  }),
  userAgent: z.string().max(300).optional(),
});
export type PushSubscriptionRequest = z.infer<
  typeof pushSubscriptionRequestSchema
>;

export const pushUnsubscribeRequestSchema = z.object({
  endpoint: z.url().max(2048),
});
export type PushUnsubscribeRequest = z.infer<
  typeof pushUnsubscribeRequestSchema
>;

export const pushTestResponseSchema = z.object({ delivered: z.boolean() });
export type PushTestResponse = z.infer<typeof pushTestResponseSchema>;
