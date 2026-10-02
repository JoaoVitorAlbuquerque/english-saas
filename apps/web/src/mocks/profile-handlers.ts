import { HttpResponse, http } from 'msw';

/**
 * Perfil e configurações (módulos 3, 11 e 15) no MSW, com estado em memória:
 * salvar muda o que a próxima leitura devolve, e cada escrita fica registrada
 * em `profileCalls` para o teste conferir o que foi mandado.
 *
 * `GET /me/profile` NÃO está em `profileHandlers`: `handlers.ts` já tem o
 * padrão (aluno recém-chegado). Quem quer o perfil com estado usa
 * `statefulProfileHandler` com `server.use`.
 */
const API_URL = 'http://localhost:3333';

type Hours = { start: number; end: number };

function initialPreferences() {
  return {
    types: { dailyReminder: true, reviewBacklog: true, weeklySummary: true },
    channels: { email: true, push: false },
    reminderHour: null as number | null,
    effectiveReminderHour: 19,
    quietHours: { start: 22, end: 8 } as Hours,
    push: { available: true, devices: 0 },
  };
}

function initialProfile() {
  return {
    userId: 'user-1',
    goals: ['TRAVEL'] as string[],
    goalNote: null as string | null,
    availabilityMinutes: {
      mon: 20,
      tue: 20,
      wed: 20,
      thu: 20,
      fri: 20,
      sat: 0,
      sun: 0,
    } as Record<string, number>,
    preferredStudyTime: 'ANY',
    targetDate: null as string | null,
    selfReportedLevel: 'NONE',
    timezone: 'America/Sao_Paulo',
    nativeLanguage: 'pt-BR',
    onboardingCompletedAt: '2026-09-01T12:00:00.000Z',
  };
}

function initialConsents() {
  const granted = (type: string) => ({
    type,
    version: '2026-01-01',
    granted: true,
    grantedAt: '2026-09-01T12:00:00.000Z',
    revokedAt: null as string | null,
    upToDate: true,
  });

  return [
    granted('TERMS'),
    granted('PRIVACY_POLICY'),
    granted('DATA_PERSONALIZATION'),
    {
      type: 'MARKETING',
      version: '2026-01-01',
      granted: false,
      grantedAt: null as string | null,
      revokedAt: '2026-09-01T12:00:00.000Z' as string | null,
      upToDate: true,
    },
  ];
}

type ExportView = {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  createdAt: string;
  expiresAt: string | null;
  sizeBytes: number | null;
  downloadUrl: string | null;
};

/** Como o próximo pedido de exportação termina. */
export type ExportOutcome =
  'ready' | 'pending' | 'pending-then-ready' | 'failed';

export const profileState = {
  profile: initialProfile(),
  interests: [{ topic: 'history', weight: 50 }] as {
    topic: string;
    weight: number;
  }[],
  preferences: initialPreferences(),
  consents: initialConsents(),
  /** O export mais recente; `null` = nunca pediu. */
  latestExport: null as ExportView | null,
  exportOutcome: 'ready' as ExportOutcome,
  /** Leituras de um export `pending-then-ready` antes de ficar pronto. */
  exportReadsLeft: 0,
  planTargetLevel: 'B1',
};

export const profileCalls = {
  accountPatches: [] as unknown[],
  profilePatches: [] as unknown[],
  interestPuts: [] as unknown[],
  rebuilds: [] as unknown[],
  preferencePatches: [] as unknown[],
  pushSubscribes: [] as unknown[],
  pushUnsubscribes: [] as unknown[],
  pushTests: 0,
  consentPuts: [] as unknown[],
  exportRequests: 0,
  deletions: 0,
  logoutAlls: 0,
};

export function resetProfileMockState(): void {
  profileState.profile = initialProfile();
  profileState.interests = [{ topic: 'history', weight: 50 }];
  profileState.preferences = initialPreferences();
  profileState.consents = initialConsents();
  profileState.latestExport = null;
  profileState.exportOutcome = 'ready';
  profileState.exportReadsLeft = 0;
  profileState.planTargetLevel = 'B1';

  profileCalls.accountPatches = [];
  profileCalls.profilePatches = [];
  profileCalls.interestPuts = [];
  profileCalls.rebuilds = [];
  profileCalls.preferencePatches = [];
  profileCalls.pushSubscribes = [];
  profileCalls.pushUnsubscribes = [];
  profileCalls.pushTests = 0;
  profileCalls.consentPuts = [];
  profileCalls.exportRequests = 0;
  profileCalls.deletions = 0;
  profileCalls.logoutAlls = 0;
}

function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) {
    return false;
  }

  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

function error(code: string, message: string, status: number) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

/** Espelha `DataExportService.toView`: `READY` traz o link assinado. */
function readyExport(id: string, createdAt: string): ExportView {
  return {
    id,
    status: 'READY',
    createdAt,
    expiresAt: '2099-01-01T00:00:00.000Z',
    sizeBytes: 2048,
    downloadUrl: 'https://files.local/meus-dados-english-saas.json?sig=abc',
  };
}

/** `GET /me/profile` lendo o estado — para `server.use` nos testes do perfil. */
export const statefulProfileHandler = http.get(`${API_URL}/me/profile`, () =>
  HttpResponse.json(profileState.profile),
);

export const profileHandlers = [
  http.patch(`${API_URL}/me`, async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    profileCalls.accountPatches.push(body);

    return HttpResponse.json({
      id: 'user-1',
      name: body.name ?? 'Aluno Teste',
    });
  }),

  http.patch(`${API_URL}/me/profile`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    profileCalls.profilePatches.push(body);
    profileState.profile = {
      ...profileState.profile,
      ...body,
    } as ReturnType<typeof initialProfile>;

    return HttpResponse.json(profileState.profile);
  }),

  http.get(`${API_URL}/me/interests`, () =>
    HttpResponse.json(profileState.interests),
  ),

  http.put(`${API_URL}/me/interests`, async ({ request }) => {
    const body = (await request.json()) as {
      interests: { topic: string; weight: number }[];
    };
    profileCalls.interestPuts.push(body);
    profileState.interests = body.interests;

    return HttpResponse.json(profileState.interests);
  }),

  http.post(`${API_URL}/me/plan/rebuild`, async ({ request }) => {
    const body = (await request.json()) as { targetLevel?: string };
    profileCalls.rebuilds.push(body);

    if (body.targetLevel !== undefined) {
      profileState.planTargetLevel = body.targetLevel;
    }

    return HttpResponse.json({
      targetLevel: profileState.planTargetLevel,
      targetDate: null,
      path: [],
      reinforceSkillIds: [],
      forecast: null,
      version: 2,
    });
  }),

  http.get(`${API_URL}/me/plan`, () =>
    HttpResponse.json({
      targetLevel: profileState.planTargetLevel,
      targetDate: null,
      path: [],
      reinforceSkillIds: [],
      forecast: null,
      version: 1,
    }),
  ),

  http.post(`${API_URL}/auth/logout-all`, () => {
    profileCalls.logoutAlls += 1;

    return HttpResponse.json({ revoked: 2 });
  }),

  // --- Notificações -----------------------------------------------------

  http.get(`${API_URL}/me/notifications/preferences`, () =>
    HttpResponse.json(profileState.preferences),
  ),

  http.patch(`${API_URL}/me/notifications/preferences`, async ({ request }) => {
    const body = (await request.json()) as {
      types?: Partial<typeof profileState.preferences.types>;
      channels?: Partial<typeof profileState.preferences.channels>;
      reminderHour?: number | null;
      quietHours?: Hours;
    };
    profileCalls.preferencePatches.push(body);

    const current = profileState.preferences;
    const reminderHour =
      body.reminderHour === undefined
        ? current.reminderHour
        : body.reminderHour;
    const quietHours = body.quietHours ?? current.quietHours;

    if (
      reminderHour !== null &&
      isQuietHour(reminderHour, quietHours.start, quietHours.end)
    ) {
      return error(
        'REMINDER_HOUR_IN_QUIET_TIME',
        'O horário do lembrete cai dentro do horário silencioso. Escolha outro horário ou ajuste o silencioso.',
        422,
      );
    }

    profileState.preferences = {
      ...current,
      types: { ...current.types, ...body.types },
      channels: { ...current.channels, ...body.channels },
      reminderHour,
      effectiveReminderHour: reminderHour ?? 19,
      quietHours,
    };

    return HttpResponse.json(profileState.preferences);
  }),

  http.get(`${API_URL}/me/notifications/push/public-key`, () =>
    profileState.preferences.push.available
      ? HttpResponse.json({ publicKey: 'Pz8-' })
      : error(
          'PUSH_UNAVAILABLE',
          'As notificações no navegador ainda não estão disponíveis. Por enquanto, os avisos vão por e-mail.',
          409,
        ),
  ),

  http.post(
    `${API_URL}/me/notifications/push/subscriptions`,
    async ({ request }) => {
      profileCalls.pushSubscribes.push(await request.json());
      profileState.preferences = {
        ...profileState.preferences,
        channels: { ...profileState.preferences.channels, push: true },
        push: {
          ...profileState.preferences.push,
          devices: profileState.preferences.push.devices + 1,
        },
      };

      return HttpResponse.json(profileState.preferences);
    },
  ),

  http.delete(
    `${API_URL}/me/notifications/push/subscriptions`,
    async ({ request }) => {
      profileCalls.pushUnsubscribes.push(await request.json());
      profileState.preferences = {
        ...profileState.preferences,
        push: {
          ...profileState.preferences.push,
          devices: Math.max(0, profileState.preferences.push.devices - 1),
        },
      };

      return HttpResponse.json(profileState.preferences);
    },
  ),

  http.post(`${API_URL}/me/notifications/push/test`, () => {
    profileCalls.pushTests += 1;

    return HttpResponse.json({ delivered: true });
  }),

  // --- Privacidade ------------------------------------------------------

  http.get(`${API_URL}/me/consents`, () =>
    HttpResponse.json(profileState.consents),
  ),

  http.put(`${API_URL}/me/consents`, async ({ request }) => {
    const body = (await request.json()) as { type: string; granted: boolean };
    profileCalls.consentPuts.push(body);
    const now = new Date().toISOString();
    profileState.consents = profileState.consents.map((consent) =>
      consent.type === body.type
        ? {
            ...consent,
            granted: body.granted,
            grantedAt: body.granted ? now : null,
            revokedAt: body.granted ? null : now,
            upToDate: true,
          }
        : consent,
    );

    return HttpResponse.json(profileState.consents);
  }),

  // `GET /me/export` sem nenhum pedido: o Nest responde 200 com corpo vazio.
  http.get(`${API_URL}/me/export`, () => {
    const latest = profileState.latestExport;

    if (latest === null) {
      return new HttpResponse(null, { status: 200 });
    }

    if (
      latest.status === 'PENDING' &&
      profileState.exportOutcome === 'pending-then-ready'
    ) {
      if (profileState.exportReadsLeft <= 0) {
        profileState.latestExport = readyExport(latest.id, latest.createdAt);
      } else {
        profileState.exportReadsLeft -= 1;
      }
    }

    return HttpResponse.json(profileState.latestExport);
  }),

  http.post(`${API_URL}/me/export`, () => {
    profileCalls.exportRequests += 1;
    const id = `export-${profileCalls.exportRequests}`;
    const createdAt = new Date().toISOString();
    const outcome = profileState.exportOutcome;

    profileState.exportReadsLeft = 1;
    profileState.latestExport =
      outcome === 'ready'
        ? readyExport(id, createdAt)
        : outcome === 'failed'
          ? {
              id,
              status: 'FAILED',
              createdAt,
              expiresAt: null,
              sizeBytes: null,
              downloadUrl: null,
            }
          : {
              id,
              status: 'PENDING',
              createdAt,
              expiresAt: null,
              sizeBytes: null,
              downloadUrl: null,
            };

    return HttpResponse.json({ id }, { status: 202 });
  }),

  http.delete(`${API_URL}/me`, () => {
    profileCalls.deletions += 1;
    const now = new Date();
    const anonymizeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return HttpResponse.json({
      deletedAt: now.toISOString(),
      anonymizeAt: anonymizeAt.toISOString(),
      daysRemaining: 30,
    });
  }),
];
