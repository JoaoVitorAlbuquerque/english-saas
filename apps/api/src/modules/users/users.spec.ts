import {
  activeStudyDays,
  normalizeAvailability,
  studyDaysUntil,
  totalWeeklyMinutes,
} from './domain/availability';
import {
  anonymizationDueAt,
  buildAnonymizedUser,
  daysUntilAnonymization,
  isDueForAnonymization,
} from './domain/anonymization';
import {
  normalizeInterests,
  normalizeTopic,
  reinforceInterest,
} from './domain/interests';

describe('normalizeAvailability', () => {
  it('preenche os dias ausentes com zero', () => {
    expect(normalizeAvailability({ mon: 30 })).toEqual({
      mon: 30,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
      sun: 0,
    });
  });

  it('prende valores negativos em zero', () => {
    expect(normalizeAvailability({ mon: -50 }).mon).toBe(0);
  });

  it('prende valores absurdos no teto de 8 horas', () => {
    expect(normalizeAvailability({ mon: 5_000 }).mon).toBe(480);
  });

  it('arredonda fração de minuto', () => {
    expect(normalizeAvailability({ mon: 20.6 }).mon).toBe(21);
  });

  it('lida com entrada nula', () => {
    expect(totalWeeklyMinutes(normalizeAvailability(null))).toBe(0);
  });

  it('soma a semana inteira', () => {
    const availability = normalizeAvailability({ mon: 20, wed: 30, sat: 45 });

    expect(totalWeeklyMinutes(availability)).toBe(95);
    expect(activeStudyDays(availability)).toEqual(['mon', 'wed', 'sat']);
  });
});

describe('studyDaysUntil', () => {
  // 2026-06-01 é uma segunda-feira.
  const monday = new Date('2026-06-01T00:00:00.000Z');

  it('conta só os dias em que o aluno tem tempo', () => {
    const availability = normalizeAvailability({ mon: 30, wed: 30 });

    // Segunda a domingo: uma segunda e uma quarta.
    expect(
      studyDaysUntil(
        availability,
        monday,
        new Date('2026-06-07T00:00:00.000Z'),
      ),
    ).toBe(2);
  });

  it('conta duas semanas corretamente', () => {
    const availability = normalizeAvailability({ mon: 30, wed: 30 });

    expect(
      studyDaysUntil(
        availability,
        monday,
        new Date('2026-06-14T00:00:00.000Z'),
      ),
    ).toBe(4);
  });

  it('devolve zero quando a data-alvo já passou', () => {
    const availability = normalizeAvailability({ mon: 30 });

    expect(
      studyDaysUntil(
        availability,
        monday,
        new Date('2026-05-01T00:00:00.000Z'),
      ),
    ).toBe(0);
  });

  it('devolve zero quando o aluno não reservou nenhum dia', () => {
    expect(
      studyDaysUntil(
        normalizeAvailability({}),
        monday,
        new Date('2026-12-01T00:00:00.000Z'),
      ),
    ).toBe(0);
  });
});

describe('normalizeTopic', () => {
  it('vira slug sem acento', () => {
    expect(normalizeTopic('História')).toBe('historia');
  });

  it('troca espaços por hífen', () => {
    expect(normalizeTopic('Copa do Mundo')).toBe('copa-do-mundo');
  });

  it('descarta pontuação nas bordas', () => {
    expect(normalizeTopic('  ...música!  ')).toBe('musica');
  });
});

describe('normalizeInterests', () => {
  it('normaliza tópico e prende o peso', () => {
    expect(normalizeInterests([{ topic: 'História', weight: 500 }])).toEqual([
      { topic: 'historia', weight: 100 },
    ]);
  });

  it('resolve duplicata pelo maior peso', () => {
    expect(
      normalizeInterests([
        { topic: 'music', weight: 30 },
        { topic: 'Music', weight: 80 },
      ]),
    ).toEqual([{ topic: 'music', weight: 80 }]);
  });

  it('ordena do mais forte para o mais fraco', () => {
    const result = normalizeInterests([
      { topic: 'music', weight: 10 },
      { topic: 'history', weight: 90 },
    ]);

    expect(result.map((item) => item.topic)).toEqual(['history', 'music']);
  });

  it('descarta tópico curto demais para ser slug', () => {
    expect(normalizeInterests([{ topic: '!', weight: 50 }])).toEqual([]);
  });

  it('respeita o teto de interesses por aluno', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      topic: `topic-${String(index)}`,
      weight: 50,
    }));

    expect(normalizeInterests(many)).toHaveLength(20);
  });
});

describe('reinforceInterest', () => {
  it('sobe o peso de um tema existente', () => {
    const result = reinforceInterest([{ topic: 'music', weight: 40 }], 'music');

    expect(result).toEqual([{ topic: 'music', weight: 45 }]);
  });

  it('não passa do teto', () => {
    const result = reinforceInterest([{ topic: 'music', weight: 98 }], 'music');

    expect(result[0]?.weight).toBe(100);
  });

  it('acrescenta um tema novo com o passo como peso', () => {
    const result = reinforceInterest([], 'Futebol', 20);

    expect(result).toEqual([{ topic: 'futebol', weight: 20 }]);
  });

  it('ignora tema vazio', () => {
    const current = [{ topic: 'music', weight: 40 }];

    expect(reinforceInterest(current, '!')).toBe(current);
  });
});

describe('anonimização', () => {
  const deletedAt = new Date('2026-06-01T00:00:00.000Z');

  it('vence 30 dias depois do soft delete', () => {
    expect(anonymizationDueAt(deletedAt).toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );
  });

  it('não anonimiza antes da carência', () => {
    expect(
      isDueForAnonymization(
        { id: 'u1', deletedAt, anonymizedAt: null },
        new Date('2026-06-30T23:59:00.000Z'),
      ),
    ).toBe(false);
  });

  it('anonimiza no instante exato do vencimento', () => {
    expect(
      isDueForAnonymization(
        { id: 'u1', deletedAt, anonymizedAt: null },
        new Date('2026-07-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('ignora conta que nunca pediu exclusão', () => {
    expect(
      isDueForAnonymization(
        { id: 'u1', deletedAt: null, anonymizedAt: null },
        new Date('2027-01-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('ignora conta já anonimizada', () => {
    expect(
      isDueForAnonymization(
        { id: 'u1', deletedAt, anonymizedAt: new Date() },
        new Date('2027-01-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('conta os dias que faltam', () => {
    expect(
      daysUntilAnonymization(deletedAt, new Date('2026-06-25T00:00:00.000Z')),
    ).toBe(6);
  });

  it('não devolve dias negativos depois do vencimento', () => {
    expect(
      daysUntilAnonymization(deletedAt, new Date('2026-08-01T00:00:00.000Z')),
    ).toBe(0);
  });

  it('apaga o que identifica a pessoa e mantém a linha', () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    const fields = buildAnonymizedUser('user-123', now);

    expect(fields.name).toBe('Conta removida');
    expect(fields.passwordHash).toBeNull();
    expect(fields.anonymizedAt).toBe(now);
    // O e-mail continua único, mas não diz nada sobre a pessoa.
    expect(fields.email).toContain('user-123');
    expect(fields.email.endsWith('@deleted.invalid')).toBe(true);
  });
});
