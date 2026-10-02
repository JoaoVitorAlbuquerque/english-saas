import type { StudentProfile } from '@english-saas/api-client';
import { describe, expect, it, vi } from 'vitest';

import {
  addDays,
  formatBytes,
  formatInstant,
  formatIsoDate,
  todayInTimezone,
} from './dates';
import { exportStateOf } from './export-status';
import { isQuietHour } from './hours';
import { initialsOf } from './initials';
import {
  diffStudySettings,
  formFromServer,
  weeklyMinutes,
  type StudyForm,
} from './study-settings';
import { timezoneOptions } from './timezones';
import {
  disablePush,
  enablePush,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from './web-push';

describe('initialsOf', () => {
  it('primeira letra do primeiro e do último nome', () => {
    expect(initialsOf('Maria da Silva')).toBe('MS');
    expect(initialsOf('  joão  pedro ')).toBe('JP');
  });

  it('um nome só, ou nenhum', () => {
    expect(initialsOf('Maria')).toBe('M');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('isQuietHour', () => {
  it('janela que atravessa a meia-noite (22 → 8)', () => {
    expect(isQuietHour(23, 22, 8)).toBe(true);
    expect(isQuietHour(3, 22, 8)).toBe(true);
    expect(isQuietHour(8, 22, 8)).toBe(false);
    expect(isQuietHour(19, 22, 8)).toBe(false);
  });

  it('janela no mesmo dia, e start = end sem silencioso', () => {
    expect(isQuietHour(13, 12, 14)).toBe(true);
    expect(isQuietHour(14, 12, 14)).toBe(false);
    expect(isQuietHour(5, 6, 6)).toBe(false);
  });
});

describe('datas', () => {
  it('hoje é o dia do fuso do aluno, não o do navegador', () => {
    const instant = new Date('2026-10-02T01:30:00.000Z');

    expect(todayInTimezone(instant, 'America/Sao_Paulo')).toBe('2026-10-01');
    expect(todayInTimezone(instant, 'Asia/Tokyo')).toBe('2026-10-02');
  });

  it('soma dias sem deslocar pelo fuso, inclusive na virada de mês e ano', () => {
    expect(addDays('2026-10-02', 1)).toBe('2026-10-03');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formata data por string e instante no fuso', () => {
    expect(formatIsoDate('2027-03-01')).toBe('01/03/2027');
    expect(formatInstant('2026-10-02T13:05:00.000Z', 'America/Sao_Paulo')).toBe(
      '02/10/2026 10:05',
    );
  });

  it('formata tamanho de arquivo', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2,0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,0 MB');
  });
});

describe('timezoneOptions', () => {
  it('Brasil primeiro, e o fuso atual sempre está na lista', () => {
    const options = timezoneOptions('Mars/Olympus_Mons');

    expect(options[0]?.value).toBe('Mars/Olympus_Mons');
    expect(options.map((option) => option.value)).toContain(
      'America/Sao_Paulo',
    );
    expect(
      timezoneOptions('America/Sao_Paulo').find(
        (option) => option.value === 'America/Sao_Paulo',
      )?.label,
    ).toBe('America/Sao Paulo');
  });
});

const week = { mon: 20, tue: 20, wed: 20, thu: 20, fri: 20, sat: 0, sun: 0 };

const baseForm: StudyForm = {
  goals: ['TRAVEL'],
  goalNote: '',
  availabilityMinutes: week,
  preferredStudyTime: 'ANY',
  targetDate: '',
  targetLevel: 'B1',
  interests: [{ topic: 'history', weight: 50 }],
};

describe('diffStudySettings', () => {
  it('sem mudança, nada vai e nada avisa', () => {
    const changes = diffStudySettings(baseForm, { ...baseForm });

    expect(changes).toEqual({
      profile: {},
      interests: null,
      targetLevel: null,
      replansPlan: false,
      hasChanges: false,
    });
  });

  it('disponibilidade manda a semana inteira e avisa do recálculo', () => {
    const changes = diffStudySettings(baseForm, {
      ...baseForm,
      availabilityMinutes: { ...week, sat: 30 },
    });

    expect(changes.profile).toEqual({
      availabilityMinutes: { ...week, sat: 30 },
    });
    expect(changes.replansPlan).toBe(true);
    expect(changes.hasChanges).toBe(true);
  });

  it('data-alvo e objetivos recalculam; limpar a data manda null', () => {
    const withDate = { ...baseForm, targetDate: '2027-03-01' };

    expect(diffStudySettings(baseForm, withDate).profile).toEqual({
      targetDate: '2027-03-01',
    });
    expect(diffStudySettings(withDate, baseForm).profile).toEqual({
      targetDate: null,
    });
    expect(
      diffStudySettings(baseForm, { ...baseForm, goals: ['TRAVEL', 'WORK'] })
        .replansPlan,
    ).toBe(true);
  });

  it('objetivos na mesma coleção em outra ordem não contam como mudança', () => {
    const initial = { ...baseForm, goals: ['TRAVEL', 'WORK'] as const };

    expect(
      diffStudySettings(
        { ...initial, goals: [...initial.goals] },
        { ...initial, goals: ['WORK', 'TRAVEL'] },
      ).hasChanges,
    ).toBe(false);
  });

  it('nível-alvo mudado pede o rebuild com o nível', () => {
    const changes = diffStudySettings(baseForm, {
      ...baseForm,
      targetLevel: 'B2',
    });

    expect(changes.targetLevel).toBe('B2');
    expect(changes.profile).toEqual({});
    expect(changes.replansPlan).toBe(true);
  });

  it('só interesses, horário preferido e observação: salva, mas não recalcula', () => {
    const changes = diffStudySettings(baseForm, {
      ...baseForm,
      interests: [{ topic: 'music', weight: 50 }],
      preferredStudyTime: 'MORNING',
      goalNote: '  viagem em dezembro ',
    });

    expect(changes.interests).toEqual([{ topic: 'music', weight: 50 }]);
    expect(changes.profile).toEqual({
      preferredStudyTime: 'MORNING',
      goalNote: 'viagem em dezembro',
    });
    expect(changes.replansPlan).toBe(false);
    expect(changes.hasChanges).toBe(true);
  });

  it('formFromServer: sem plano o nível-alvo é C1; data vem só com o dia', () => {
    const profile = {
      userId: 'u',
      goals: ['TRAVEL'],
      goalNote: null,
      availabilityMinutes: week,
      preferredStudyTime: 'ANY',
      targetDate: '2027-03-01T00:00:00.000Z',
      selfReportedLevel: 'NONE',
      timezone: 'America/Sao_Paulo',
      nativeLanguage: 'pt-BR',
      onboardingCompletedAt: null,
    } satisfies StudentProfile;

    const form = formFromServer({ profile, interests: [], targetLevel: null });

    expect(form.targetLevel).toBe('C1');
    expect(form.targetDate).toBe('2027-03-01');
    expect(form.goalNote).toBe('');
    expect(weeklyMinutes(form.availabilityMinutes)).toBe(100);
  });
});

describe('exportStateOf', () => {
  const base = {
    id: 'e1',
    createdAt: '2026-10-02T10:00:00.000Z',
    expiresAt: null,
    sizeBytes: null,
    downloadUrl: null,
  };

  it('um estado para cada situação', () => {
    expect(exportStateOf(null)).toEqual({ kind: 'none' });
    expect(exportStateOf({ ...base, status: 'PENDING' })).toEqual({
      kind: 'pending',
    });
    expect(exportStateOf({ ...base, status: 'FAILED' })).toEqual({
      kind: 'failed',
    });
    expect(
      exportStateOf({ ...base, status: 'READY', downloadUrl: 'https://f/x' }),
    ).toEqual({ kind: 'ready', downloadUrl: 'https://f/x' });
  });

  it('pronto sem link = venceu', () => {
    expect(exportStateOf({ ...base, status: 'READY' })).toEqual({
      kind: 'expired',
    });
  });
});

describe('urlBase64ToUint8Array', () => {
  it('converte base64url (com - e _) em bytes', () => {
    // "??>" em base64 é "Pz8+", em base64url "Pz8-".
    expect(Array.from(urlBase64ToUint8Array('Pz8-'))).toEqual([63, 63, 62]);
  });
});

type FakeSubscription = {
  endpoint: string;
  toJSON: () => {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  unsubscribe: () => Promise<boolean>;
};

function makeEnvironment(
  options: {
    supported?: boolean;
    permission?: NotificationPermission;
    requested?: NotificationPermission;
    existing?: FakeSubscription | null;
  } = {},
) {
  const created: FakeSubscription = {
    endpoint: 'https://push.example.com/new',
    toJSON: () => ({
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const subscribe = vi.fn().mockResolvedValue(created);
  const getSubscription = vi.fn().mockResolvedValue(options.existing ?? null);
  const requestPermission = vi
    .fn()
    .mockResolvedValue(options.requested ?? 'granted');
  const registerWorker = vi.fn().mockResolvedValue({
    pushManager: { subscribe, getSubscription },
  });
  const env: PushEnvironment = {
    isSupported: () => options.supported ?? true,
    permission: () => options.permission ?? 'default',
    requestPermission,
    registerWorker,
    hasSubscription: () => Promise.resolve(options.existing != null),
    userAgent: 'Chrome/Test',
  };

  return { env, subscribe, getSubscription, requestPermission, registerWorker };
}

describe('enablePush', () => {
  it('pede permissão, registra o worker e assina com a chave do servidor', async () => {
    const { env, requestPermission, subscribe } = makeEnvironment();
    const getPublicKey = vi.fn().mockResolvedValue('Pz8-');

    const result = await enablePush(env, getPublicKey);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(result).toEqual({
      status: 'subscribed',
      subscription: {
        endpoint: 'https://push.example.com/new',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        userAgent: 'Chrome/Test',
      },
    });
  });

  it('já autorizado: não pergunta de novo', async () => {
    const { env, requestPermission } = makeEnvironment({
      permission: 'granted',
    });

    await enablePush(env, () => Promise.resolve('Pz8-'));

    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('negado antes: nem pergunta, nem registra worker, nem busca a chave', async () => {
    const { env, requestPermission, registerWorker } = makeEnvironment({
      permission: 'denied',
    });
    const getPublicKey = vi.fn();

    const result = await enablePush(env, getPublicKey);

    expect(result).toEqual({ status: 'denied' });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(registerWorker).not.toHaveBeenCalled();
    expect(getPublicKey).not.toHaveBeenCalled();
  });

  it('o aluno nega no pedido: resultado "denied"; fecha sem escolher: "dismissed"', async () => {
    expect(
      await enablePush(makeEnvironment({ requested: 'denied' }).env, vi.fn()),
    ).toEqual({ status: 'denied' });
    expect(
      await enablePush(makeEnvironment({ requested: 'default' }).env, vi.fn()),
    ).toEqual({ status: 'dismissed' });
  });

  it('sem suporte do navegador: não mexe em nada', async () => {
    const { env, requestPermission } = makeEnvironment({ supported: false });

    expect(await enablePush(env, vi.fn())).toEqual({ status: 'unsupported' });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('reaproveita a inscrição que o navegador já tem', async () => {
    const existing: FakeSubscription = {
      endpoint: 'https://push.example.com/old',
      toJSON: () => ({
        endpoint: 'https://push.example.com/old',
        keys: { p256dh: 'old-p256dh', auth: 'old-auth' },
      }),
      unsubscribe: vi.fn(),
    };
    const { env, subscribe } = makeEnvironment({
      permission: 'granted',
      existing,
    });
    const getPublicKey = vi.fn();

    const result = await enablePush(env, getPublicKey);

    expect(subscribe).not.toHaveBeenCalled();
    expect(getPublicKey).not.toHaveBeenCalled();
    expect(result.status === 'subscribed' && result.subscription.endpoint).toBe(
      'https://push.example.com/old',
    );
  });
});

describe('disablePush', () => {
  it('cancela a inscrição do navegador e devolve o endpoint', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const { env } = makeEnvironment({
      existing: {
        endpoint: 'https://push.example.com/old',
        toJSON: () => ({}),
        unsubscribe,
      },
    });

    expect(await disablePush(env)).toBe('https://push.example.com/old');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('este navegador nunca assinou: devolve null', async () => {
    expect(await disablePush(makeEnvironment().env)).toBeNull();
  });
});
