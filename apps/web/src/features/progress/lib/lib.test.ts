import {
  learnerProfileSchema,
  studentProgressSchema,
  type WeaknessAction,
} from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import {
  learnerProfileFixture,
  newStudentProgressFixture,
  progressFixture,
} from '../../../mocks/progress-handlers';
import { formatDate, formatWeek } from './format-date';
import { isNewStudent } from './is-new-student';
import { examplesFor } from './join-error-examples';
import {
  BAR_SCALE,
  LINE_SCALE,
  competencyBars,
  levelAt,
  levelPoints,
  levelValue,
} from './level-scale';
import { weaknessLink } from './weakness-action';

// Passar pelo schema garante que as fixtures espelham o contrato da API.
const progress = studentProgressSchema.parse(progressFixture);
const newStudent = studentProgressSchema.parse(newStudentProgressFixture);
const learner = learnerProfileSchema.parse(learnerProfileFixture);

describe('level-scale', () => {
  it('A1 vale 1 e C1 vale 5, e o caminho de volta fecha', () => {
    expect(levelValue('A1')).toBe(1);
    expect(levelValue('B1')).toBe(3);
    expect(levelValue('C1')).toBe(5);
    expect(levelAt(3)).toBe('B1');
    expect(levelAt(9)).toBeNull();
  });

  it('as marcas das duas escalas são os cinco níveis, em ordem', () => {
    const labels = BAR_SCALE.ticks.map((tick) => tick.label);

    expect(labels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(LINE_SCALE.ticks.map((tick) => tick.value)).toEqual([1, 2, 3, 4, 5]);
    // A linha tem folga em cima e embaixo; a barra começa no zero.
    expect(LINE_SCALE.min).toBeLessThan(1);
    expect(BAR_SCALE.min).toBe(0);
  });

  it('barras: confiança baixa fica listrada com o texto, as outras mostram o rótulo da API', () => {
    const bars = competencyBars(progress.level.competencies, 'Poucos dados');
    const byId = new Map(bars.map((bar) => [bar.id, bar]));

    expect(byId.get('GRAMMAR')).toMatchObject({
      value: 3,
      valueLabel: 'B1',
      note: 'Estimativa razoável',
      hatched: false,
    });
    expect(byId.get('VOCABULARY')).toMatchObject({
      note: 'Estimativa firme',
      hatched: false,
    });
    expect(byId.get('LISTENING')).toMatchObject({
      value: 2,
      note: 'Poucos dados',
      hatched: true,
    });
  });

  it('barras: competência sem nível vira linha vazia, não barra zerada', () => {
    const bars = competencyBars(progress.level.competencies, 'Poucos dados');
    const speaking = bars.find((bar) => bar.id === 'SPEAKING');

    expect(speaking).toMatchObject({ value: null, valueLabel: '' });
    expect(speaking?.hatched).toBeUndefined();
    expect(bars).toHaveLength(6);
  });

  it('linha: nível geral por semana, com null antes da primeira foto', () => {
    const points = levelPoints(progress.level.weekly, 'OVERALL');

    expect(points.map((point) => point.x).slice(0, 3)).toEqual([
      '17/08',
      '24/08',
      '31/08',
    ]);
    expect(points.map((point) => point.y)).toEqual([
      null,
      null,
      1,
      1,
      2,
      2,
      2,
      2,
    ]);
  });

  it('linha: competência escolhida usa o nível dela, e semana sem ela é null', () => {
    const points = levelPoints(progress.level.weekly, 'GRAMMAR');

    expect(points.at(-1)?.y).toBe(3);
    expect(points.at(0)?.y).toBeNull();
    // Competência que nunca apareceu em nenhuma foto: tudo null.
    expect(
      levelPoints(progress.level.weekly, 'SPEAKING').every(
        (point) => point.y === null,
      ),
    ).toBe(true);
  });
});

describe('weaknessLink', () => {
  const action = (overrides: Partial<WeaknessAction>): WeaknessAction => ({
    type: 'LESSON',
    refId: null,
    lessonSlug: null,
    label: '',
    ...overrides,
  });

  it('lição abre pelo slug', () => {
    expect(
      weaknessLink(action({ type: 'LESSON', lessonSlug: 'yesterday' })),
    ).toEqual({ kind: 'lesson', to: '/licoes/yesterday' });
  });

  it('lição sem slug cai no catálogo em vez de uma rota quebrada', () => {
    expect(weaknessLink(action({ type: 'LESSON', lessonSlug: null }))).toEqual({
      kind: 'lesson',
      to: '/catalogo',
    });
  });

  it('revisão e prática levam a "Praticar agora"; material leva ao gerador', () => {
    expect(weaknessLink(action({ type: 'REVIEW', refId: 'c1' }))).toEqual({
      kind: 'practice',
      to: '/revisao',
    });
    expect(weaknessLink(action({ type: 'PRACTICE' }))).toEqual({
      kind: 'practice',
      to: '/hoje',
    });
    expect(weaknessLink(action({ type: 'MATERIAL', refId: 's1' }))).toEqual({
      kind: 'material',
      to: '/ferramentas/tema',
    });
  });
});

describe('isNewStudent', () => {
  it('sem nível, sem estudo e sem erro: aluno novo', () => {
    expect(isNewStudent(newStudent)).toBe(true);
  });

  it('com semanas de estudo, não', () => {
    expect(isNewStudent(progress)).toBe(false);
  });

  it('só o nivelamento já basta para sair do estado novo', () => {
    const placed = structuredClone(newStudent);
    placed.level.competencies[0] = {
      ...(placed.level
        .competencies[0] as (typeof placed.level.competencies)[0]),
      level: 'B1',
    };

    expect(isNewStudent(placed)).toBe(false);
  });

  it('um minuto, uma revisão ou um erro visto já contam', () => {
    for (const change of [
      (value: typeof newStudent) => {
        value.stats.minutesStudied = 1;
      },
      (value: typeof newStudent) => {
        value.stats.reviewsDone = 1;
      },
      (value: typeof newStudent) => {
        value.stats.topErrors = progress.stats.topErrors;
      },
    ]) {
      const changed = structuredClone(newStudent);
      change(changed);
      expect(isNewStudent(changed)).toBe(false);
    }
  });
});

describe('examplesFor', () => {
  it('acha as frases do aluno em erros recorrentes e em observados', () => {
    expect(examplesFor('l1.have-for-age', learner)).toEqual([
      'I have 22 years',
      'She have 20 years',
    ]);
    expect(examplesFor('article.country-the', learner)).toEqual([
      'I live in the Brazil',
    ]);
  });

  it('sem perfil (carregando ou falhou) ou erro desconhecido: lista vazia', () => {
    expect(examplesFor('l1.have-for-age', undefined)).toEqual([]);
    expect(examplesFor('nao-existe', learner)).toEqual([]);
  });

  it('tira repetição e limita a três frases', () => {
    const profile = learnerProfileSchema.parse({
      errors: [
        {
          ...learnerProfileFixture.errors[0],
          yourExamples: ['a', 'a', 'b', 'c', 'd'],
        },
      ],
      observedErrors: [],
    });

    expect(examplesFor('l1.have-for-age', profile)).toEqual(['a', 'b', 'c']);
  });
});

describe('format-date', () => {
  it('formata por string, sem deslocar o dia', () => {
    expect(formatWeek('2026-09-28')).toBe('28/09');
    expect(formatDate('2027-03-01')).toBe('01/03/2027');
  });
});
