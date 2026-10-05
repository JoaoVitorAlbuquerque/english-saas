import type { LessonStepType } from '@english-saas/shared';

/**
 * Conteúdo de etapa no editor.
 *
 * É rascunho: pode estar incompleto (texto vazio, personagem não escolhido).
 * O que o editor garante é a **forma** — os arrays existem — para os campos
 * nunca quebrarem na hora de desenhar. Quem diz se o conteúdo está bom é a
 * validação (`validation.ts`), com os schemas do `packages/shared`.
 */
export type StepContent = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Uma fala em branco — a cena precisa de ao menos uma. */
export function emptySceneLine(characterId = ''): StepContent {
  return { characterId, text: '', translation: '', spans: [] };
}

export function emptyCard(): StepContent {
  return { title: '', bodyMd: '', examples: [] };
}

export function emptyExample(): StepContent {
  return { text: '', spans: [] };
}

export function emptyRubricCriterion(index: number): StepContent {
  return { id: `criterio-${String(index + 1)}`, description: '' };
}

export function emptyGoal(index: number): StepContent {
  return { id: `meta-${String(index + 1)}`, description: '', skillIds: [] };
}

export function emptyContent(type: LessonStepType): StepContent {
  switch (type) {
    case 'SCENE':
      return {
        location: '',
        characterIds: [],
        lines: [emptySceneLine()],
      };

    case 'EXPLANATION_CARDS':
      return { cards: [emptyCard()] };

    case 'PRACTICE':
      return { itemIds: [], shuffle: false };

    case 'FREE_PRODUCTION':
      return {
        prompt: '',
        helpers: [],
        rubric: [emptyRubricCriterion(0)],
        targetSkillIds: [],
      };

    case 'ROLEPLAY':
      return {
        characterId: '',
        scenario: '',
        goals: [emptyGoal(0)],
        maxTurns: 8,
        allowedVocabularyLevel: 'A1',
      };

    case 'SUMMARY':
      return { takeaways: [''], skillIds: [], registerNoteIds: [] };
  }
}

/**
 * Completa o que falta num conteúdo vindo do servidor (o rascunho tolerante
 * aceita JSON pela metade): campos ausentes ganham o valor de uma etapa
 * nova, listas viram listas. O que já existe não muda.
 */
export function normalizeContent(
  type: LessonStepType,
  raw: unknown,
): StepContent {
  const content = isRecord(raw) ? raw : {};
  const merged: StepContent = { ...emptyContent(type), ...content };

  switch (type) {
    case 'SCENE':
      return {
        ...merged,
        characterIds: asArray(merged.characterIds),
        lines: asArray(merged.lines).map((line) => ({
          ...emptySceneLine(),
          ...(isRecord(line) ? line : {}),
          spans: asArray(isRecord(line) ? line.spans : []),
        })),
      };

    case 'EXPLANATION_CARDS':
      return {
        ...merged,
        cards: asArray(merged.cards).map((card) => {
          const record = isRecord(card) ? card : {};

          return {
            ...emptyCard(),
            ...record,
            examples: asArray(record.examples).map((example) => {
              const exampleRecord = isRecord(example) ? example : {};

              return {
                ...emptyExample(),
                ...exampleRecord,
                spans: asArray(exampleRecord.spans),
              };
            }),
          };
        }),
      };

    case 'PRACTICE':
      return { ...merged, itemIds: asArray(merged.itemIds) };

    case 'FREE_PRODUCTION':
      return {
        ...merged,
        helpers: asArray(merged.helpers),
        rubric: asArray(merged.rubric),
        targetSkillIds: asArray(merged.targetSkillIds),
      };

    case 'ROLEPLAY':
      return {
        ...merged,
        goals: asArray(merged.goals).map((goal) => ({
          skillIds: [],
          ...(isRecord(goal) ? goal : {}),
        })),
      };

    case 'SUMMARY':
      return {
        ...merged,
        takeaways: asArray(merged.takeaways),
        skillIds: asArray(merged.skillIds),
        registerNoteIds: asArray(merged.registerNoteIds),
      };
  }
}
