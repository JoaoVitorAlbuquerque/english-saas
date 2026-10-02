import type {
  NotificationPreferences,
  UpdatePreferencesRequest,
} from './schemas';

/**
 * O que a tela mostra enquanto o PATCH está no ar (atualização otimista).
 * Pura: o servidor continua sendo quem decide, e a resposta dele substitui
 * este resultado. `effectiveReminderHour` não muda aqui — só o servidor sabe
 * o horário preferido do perfil.
 */
export function applyPreferencesPatch(
  current: NotificationPreferences,
  patch: UpdatePreferencesRequest,
): NotificationPreferences {
  return {
    ...current,
    types: { ...current.types, ...patch.types },
    channels: { ...current.channels, ...patch.channels },
    reminderHour:
      patch.reminderHour === undefined
        ? current.reminderHour
        : patch.reminderHour,
    quietHours: patch.quietHours ?? current.quietHours,
  };
}
