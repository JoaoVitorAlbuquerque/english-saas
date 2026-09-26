import {
  dailyReminderMessage,
  joinPt,
  reviewBacklogMessage,
  weeklySummaryMessage,
} from './domain/messages';
import {
  BACKLOG_INTERVAL_DAYS,
  BACKLOG_THRESHOLD,
  chooseReminder,
  reminderDedupKey,
} from './domain/rules';
import { isQuietHour, localClock, reminderHourFor } from './domain/schedule';
import { signUnsubscribe, verifyUnsubscribe } from './domain/unsubscribe';

const BASE = {
  prefs: { dailyReminder: true, reviewBacklog: true },
  hasChannel: true,
  quiet: false,
  alreadyRemindedToday: false,
  studiedToday: false,
  pendingMinutes: 12,
  dueCards: 3,
  daysSinceLastBacklog: null,
};

describe('notifications / horário', () => {
  it('usa a hora escolhida, senão a do horário preferido', () => {
    expect(reminderHourFor(null, 'MORNING')).toBe(8);
    expect(reminderHourFor(null, 'ANY')).toBe(19);
    expect(reminderHourFor(7, 'EVENING')).toBe(7);
    expect(reminderHourFor(0, 'EVENING')).toBe(0);
  });

  it('horário silencioso atravessando a meia-noite', () => {
    expect(isQuietHour(22, 22, 8)).toBe(true);
    expect(isQuietHour(3, 22, 8)).toBe(true);
    expect(isQuietHour(8, 22, 8)).toBe(false);
    expect(isQuietHour(21, 22, 8)).toBe(false);
  });

  it('horário silencioso no mesmo dia, e sem silencioso', () => {
    expect(isQuietHour(13, 12, 14)).toBe(true);
    expect(isQuietHour(14, 12, 14)).toBe(false);
    expect(isQuietHour(3, 0, 0)).toBe(false);
  });

  it('lê hora, data e dia da semana no fuso', () => {
    // Segunda 01:30 UTC = domingo 22:30 em São Paulo.
    const instant = new Date('2026-09-28T01:30:00Z');

    expect(localClock(instant, 'America/Sao_Paulo')).toEqual({
      date: '2026-09-27',
      hour: 22,
      weekday: 0,
    });
    expect(localClock(instant, 'UTC')).toEqual({
      date: '2026-09-28',
      hour: 1,
      weekday: 1,
    });
  });
});

describe('notifications / regras de envio', () => {
  it('manda o lembrete diário quando há plano e o aluno não estudou', () => {
    expect(chooseReminder(BASE)).toEqual({
      send: true,
      type: 'DAILY_REMINDER',
    });
  });

  it('no máximo um lembrete por dia, de qualquer tipo', () => {
    expect(
      chooseReminder({
        ...BASE,
        alreadyRemindedToday: true,
        dueCards: BACKLOG_THRESHOLD * 2,
      }),
    ).toEqual({ send: false, reason: 'ALREADY_REMINDED_TODAY' });
  });

  it('não manda a quem já estudou hoje, nem no silencioso', () => {
    expect(chooseReminder({ ...BASE, studiedToday: true })).toEqual({
      send: false,
      reason: 'STUDIED_TODAY',
    });
    expect(chooseReminder({ ...BASE, quiet: true })).toEqual({
      send: false,
      reason: 'QUIET_HOURS',
    });
  });

  it('sem canal ligado, ou sem nada planejado, não manda', () => {
    expect(chooseReminder({ ...BASE, hasChannel: false })).toMatchObject({
      reason: 'NO_CHANNEL',
    });
    expect(chooseReminder({ ...BASE, pendingMinutes: 0 })).toMatchObject({
      reason: 'NOTHING_PLANNED',
    });
  });

  it('revisões acumuladas substituem o diário, com intervalo mínimo', () => {
    const backlog = { ...BASE, dueCards: BACKLOG_THRESHOLD };

    expect(chooseReminder(backlog)).toEqual({
      send: true,
      type: 'REVIEW_BACKLOG',
    });
    // Avisou há pouco: volta a ser o lembrete diário.
    expect(
      chooseReminder({
        ...backlog,
        daysSinceLastBacklog: BACKLOG_INTERVAL_DAYS - 1,
      }),
    ).toEqual({ send: true, type: 'DAILY_REMINDER' });
    expect(
      chooseReminder({
        ...backlog,
        daysSinceLastBacklog: BACKLOG_INTERVAL_DAYS,
      }),
    ).toMatchObject({ type: 'REVIEW_BACKLOG' });
  });

  it('respeita cada tipo desligado', () => {
    const backlog = { ...BASE, dueCards: 40 };

    expect(
      chooseReminder({
        ...backlog,
        prefs: { dailyReminder: true, reviewBacklog: false },
      }),
    ).toMatchObject({ type: 'DAILY_REMINDER' });
    expect(
      chooseReminder({
        ...BASE,
        prefs: { dailyReminder: false, reviewBacklog: true },
      }),
    ).toEqual({ send: false, reason: 'DISABLED' });
    // Só o aviso de revisões ligado ainda avisa quando elas acumulam.
    expect(
      chooseReminder({
        ...backlog,
        prefs: { dailyReminder: false, reviewBacklog: true },
      }),
    ).toMatchObject({ type: 'REVIEW_BACKLOG' });
  });

  it('a trava do dia é a mesma para os dois tipos', () => {
    expect(reminderDedupKey('u1', '2026-09-28')).toBe('reminder:u1:2026-09-28');
  });
});

describe('notifications / textos', () => {
  it('lembrete diário específico: tempo, revisões e a lição', () => {
    const message = dailyReminderMessage([
      { type: 'REVIEW', estimatedMinutes: 2, count: 1 },
      { type: 'LESSON', estimatedMinutes: 10, title: 'At the airport' },
    ]);

    expect(message.body).toBe(
      'Faltam 12 min para fechar o plano de hoje: 1 revisão e a lição "At the airport".',
    );
    expect(message.path).toBe('/hoje');
  });

  it('plural e agenda antiga sem título ou contagem', () => {
    expect(
      dailyReminderMessage([
        { type: 'REVIEW', estimatedMinutes: 5 },
        { type: 'LESSON', estimatedMinutes: 10 },
        { type: 'PRACTICE', estimatedMinutes: 1.5 },
        { type: 'PRACTICE', estimatedMinutes: 1.5 },
      ]).body,
    ).toBe(
      'Faltam 18 min para fechar o plano de hoje: a revisão do dia, a próxima lição e 2 exercícios de prática.',
    );
  });

  it('revisões acumuladas: quanto uma sessão curta resolve', () => {
    expect(reviewBacklogMessage(34).body).toBe(
      'Você tem 34 revisões esperando. Uma sessão de 10 min já dá conta de 24 delas.',
    );
    expect(reviewBacklogMessage(20).body).toContain('dá conta de todas');
  });

  it('resumo semanal com números, e sem culpa quando não houve estudo', () => {
    const week = {
      studyMinutes: 95,
      plannedMinutes: 150,
      lessonsCompleted: 3,
      reviewsDone: 1,
      firstTryAnswers: 40,
      firstTryCorrect: 31,
      activeDays: 4,
    };

    expect(weeklySummaryMessage(week).body).toBe(
      'Na semana passada: 95 min de estudo em 4 dias, 3 lições concluídas e 1 revisão. Acerto de primeira: 78%. O planejado era 150 min; se a rotina mudou, dá para ajustar a disponibilidade no seu perfil.',
    );
    expect(weeklySummaryMessage({ ...week, studyMinutes: 160 }).body).toContain(
      'Você cumpriu os 150 min planejados.',
    );

    const idle = weeklySummaryMessage({ ...week, activeDays: 0 }).body;
    expect(idle).not.toMatch(/!|esqueceu|perdeu|sequência/i);
  });

  it('nenhum texto usa culpa ou chantagem', () => {
    const texts = [
      dailyReminderMessage([{ type: 'LESSON', estimatedMinutes: 10 }]),
      reviewBacklogMessage(80),
    ].map((message) => `${message.title} ${message.body}`);

    for (const text of texts) {
      expect(text).not.toMatch(/!|esqueceu|perdeu|sequência|não desista/i);
    }
    expect(joinPt(['a'])).toBe('a');
  });
});

describe('notifications / descadastro', () => {
  it('assina e confere o token de um tipo', () => {
    const token = signUnsubscribe('user-1', 'WEEKLY_SUMMARY', 'segredo');

    expect(verifyUnsubscribe(token, 'segredo')).toEqual({
      userId: 'user-1',
      type: 'WEEKLY_SUMMARY',
    });
  });

  it('recusa token adulterado ou de outro segredo', () => {
    const token = signUnsubscribe('user-1', 'DAILY_REMINDER', 'segredo');
    const [, signature] = token.split('.');
    const forged = `${Buffer.from('user-2.DAILY_REMINDER').toString('base64url')}.${signature ?? ''}`;

    expect(verifyUnsubscribe(token, 'outro')).toBeNull();
    expect(verifyUnsubscribe(forged, 'segredo')).toBeNull();
    expect(verifyUnsubscribe('lixo', 'segredo')).toBeNull();
  });
});
