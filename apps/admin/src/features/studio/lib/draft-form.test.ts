import { describe, expect, it } from 'vitest';

import {
  EMPTY_ITEMS_FORM,
  EMPTY_LESSON_FORM,
  EMPTY_NOTES_FORM,
  countOf,
  nextLessonOrder,
  parseItemsRequest,
  parseLessonRequest,
  parseNotesRequest,
  toLessonRequest,
  validateItemsForm,
  validateLessonForm,
  validateNotesForm,
  withTitle,
  type LessonDraftForm,
} from './draft-form';

const UNIT = '22222222-2222-4222-8222-222222222222';
const CHARACTER = '33333333-3333-4333-8333-333333333333';

const valid: LessonDraftForm = {
  ...EMPTY_LESSON_FORM,
  level: 'A1',
  unitId: UNIT,
  slug: 'at-the-airport',
  order: '2',
  objective: 'Fazer o check-in no aeroporto.',
  targetSkillIds: ['grammar.be.present.affirmative'],
  characterIds: [CHARACTER],
};

describe('formulário de lição', () => {
  it('um formulário completo não tem erro e vira o pedido da API', () => {
    expect(validateLessonForm(valid)).toEqual({});
    expect(parseLessonRequest(valid)).toEqual({
      unitId: UNIT,
      slug: 'at-the-airport',
      order: 2,
      objective: 'Fazer o check-in no aeroporto.',
      level: 'A1',
      targetSkillIds: ['grammar.be.present.affirmative'],
      characterIds: [CHARACTER],
    });
  });

  it('título e contexto só vão quando preenchidos', () => {
    const request = toLessonRequest({
      ...valid,
      title: '  At the airport ',
      unitContext: '  ',
    });

    expect(request).toMatchObject({ title: 'At the airport' });
    expect(request).not.toHaveProperty('unitContext');
  });

  it('formulário vazio aponta cada campo que falta, em português', () => {
    const errors = validateLessonForm(EMPTY_LESSON_FORM);

    expect(errors['level']).toBe('Escolha o nível.');
    expect(errors['unitId']).toBe('Escolha a unidade.');
    expect(errors['slug']).toBe('Dê um identificador à lição.');
    expect(errors['objective']).toBeDefined();
    expect(errors['targetSkillIds']).toBeDefined();
    expect(errors['characterIds']).toBeDefined();
  });

  it('usa os limites do servidor: objetivo curto, skills demais, contexto longo', () => {
    expect(
      validateLessonForm({ ...valid, objective: 'Oi' })['objective'],
    ).toBeDefined();
    expect(
      validateLessonForm({
        ...valid,
        targetSkillIds: Array.from(
          { length: 9 },
          (_, n) => `skill.n${String(n)}`,
        ),
      })['targetSkillIds'],
    ).toBeDefined();
    expect(
      validateLessonForm({ ...valid, unitContext: 'x'.repeat(2_001) })[
        'unitContext'
      ],
    ).toBeDefined();
  });

  it('posição precisa ser um número', () => {
    expect(validateLessonForm({ ...valid, order: 'a' })['order']).toBe(
      'A posição é um número, a partir de 0.',
    );
  });

  it('lição que já existe: pede a lição, não a unidade nem o identificador', () => {
    const existing: LessonDraftForm = {
      ...valid,
      mode: 'existing',
      lessonId: '44444444-4444-4444-8444-444444444444',
      unitId: '',
      slug: '',
    };

    expect(validateLessonForm(existing)).toEqual({});
    expect(parseLessonRequest(existing)).toMatchObject({
      lessonId: '44444444-4444-4444-8444-444444444444',
    });
    expect(validateLessonForm({ ...existing, lessonId: '' })['lessonId']).toBe(
      'Escolha a lição.',
    );
  });

  it('o identificador acompanha o título até o editor mexer nele', () => {
    const typed = withTitle(EMPTY_LESSON_FORM, 'Na lanchonete — café');

    expect(typed.slug).toBe('na-lanchonete-cafe');

    const edited = withTitle(
      { ...typed, slug: 'meu-slug', slugEdited: true },
      'Outro título',
    );

    expect(edited.slug).toBe('meu-slug');
  });

  it('a posição sugerida é a seguinte à última', () => {
    expect(nextLessonOrder([])).toBe(0);
    expect(nextLessonOrder([{ order: 0 }, { order: 3 }, { order: 1 }])).toBe(4);
  });
});

describe('formulário de questões', () => {
  const items = {
    ...EMPTY_ITEMS_FORM,
    skillId: 'grammar.be.present.affirmative',
    level: 'A1' as const,
    count: '8',
  };

  it('completo: sem erro, e os tipos padrão vão junto', () => {
    expect(validateItemsForm(items)).toEqual({});
    expect(parseItemsRequest(items)).toEqual({
      skillId: 'grammar.be.present.affirmative',
      level: 'A1',
      count: 8,
      types: ['MULTIPLE_CHOICE', 'FILL_BLANK', 'ORDER_WORDS'],
    });
  });

  it('pede a skill e o nível; quantidade fora de 1 a 20 e sem tipo são recusadas', () => {
    expect(validateItemsForm(EMPTY_ITEMS_FORM)).toMatchObject({
      skillId: 'Escolha a skill.',
      level: 'Escolha o nível.',
    });
    expect(validateItemsForm({ ...items, count: '21' })['count']).toBeDefined();
    expect(validateItemsForm({ ...items, count: '0' })['count']).toBeDefined();
    expect(validateItemsForm({ ...items, count: 'oito' })['count']).toBe(
      'Informe a quantidade, em número.',
    );
    expect(validateItemsForm({ ...items, types: [] })['types']).toBe(
      'Escolha ao menos um tipo.',
    );
  });
});

describe('formulário de notas', () => {
  it('completo: sem erro; quantidade de 1 a 15', () => {
    const notes = { ...EMPTY_NOTES_FORM, level: 'A2' as const, count: '3' };

    expect(validateNotesForm(notes)).toEqual({});
    expect(parseNotesRequest(notes)).toEqual({ level: 'A2', count: 3 });
    expect(validateNotesForm({ ...notes, count: '16' })['count']).toBeDefined();
    expect(validateNotesForm(EMPTY_NOTES_FORM)['level']).toBe(
      'Escolha o nível.',
    );
  });
});

describe('countOf', () => {
  it('serve para estimar: número válido, ou 1, nunca acima do teto', () => {
    expect(countOf('7', 20)).toBe(7);
    expect(countOf('99', 20)).toBe(20);
    expect(countOf('', 20)).toBe(1);
    expect(countOf('x', 20)).toBe(1);
    expect(countOf('0', 20)).toBe(1);
  });
});
