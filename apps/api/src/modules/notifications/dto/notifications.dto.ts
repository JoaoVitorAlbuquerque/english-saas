import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const hour = z.number().int().min(0).max(23);

export class UpdatePreferencesDto extends createZodDto(
  z.object({
    types: z
      .object({
        dailyReminder: z.boolean().optional(),
        reviewBacklog: z.boolean().optional(),
        weeklySummary: z.boolean().optional(),
      })
      .optional(),
    channels: z
      .object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
      })
      .optional(),
    /** `null` volta a seguir o horário preferido do perfil. */
    reminderHour: hour.nullable().optional(),
    quietHours: z.object({ start: hour, end: hour }).optional(),
  }),
) {}

/** O que o `pushManager.subscribe()` do navegador devolve, em JSON. */
export class PushSubscriptionDto extends createZodDto(
  z.object({
    endpoint: z.url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(128),
    }),
    userAgent: z.string().max(300).optional(),
  }),
) {}

export class PushUnsubscribeDto extends createZodDto(
  z.object({ endpoint: z.url().max(2048) }),
) {}

export class UnsubscribeDto extends createZodDto(
  z.object({ token: z.string().min(10).max(500) }),
) {}
