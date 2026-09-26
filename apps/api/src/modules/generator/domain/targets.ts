import { createHash } from 'node:crypto';

import type { CefrLevel } from '@english-saas/shared';

import { levelIndex } from './level-profile';

/**
 * Alvos pedagógicos de um material: 2–3 skills que o texto usa de propósito
 * e 1–2 notas de registro falado × formal.
 *
 * Sem IA e determinístico: a mesma entrada dá sempre os mesmos alvos, e é
 * isso que deixa outro aluno do mesmo nível, com as mesmas necessidades,
 * reaproveitar o texto base (`materialCacheKey`).
 */

export const THEME_CATEGORIES = [
  'HISTORY',
  'SCIENCE',
  'SPORTS',
  'MUSIC',
  'ARTS',
  'GEOGRAPHY',
  'TECHNOLOGY',
  'OTHER',
] as const;

export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

/**
 * Estruturas que combinam com cada tipo de assunto. História se conta no
 * passado; ciência e geografia descrevem no presente. Slug que o catálogo
 * ainda não tem é ignorado na escolha — a lista pode estar à frente dele.
 */
const THEME_SKILLS: Record<ThemeCategory, readonly string[]> = {
  HISTORY: [
    'grammar.past-simple.irregular',
    'grammar.past-simple.regular',
    'grammar.there-was-were',
    'grammar.past-simple.negative-questions',
  ],
  SCIENCE: [
    'grammar.present-simple.third-person',
    'grammar.passive.present',
    'grammar.there-was-were',
  ],
  SPORTS: [
    'grammar.past-simple.regular',
    'grammar.past-simple.irregular',
    'grammar.comparatives',
  ],
  MUSIC: [
    'grammar.past-simple.regular',
    'grammar.past-simple.irregular',
    'grammar.present-simple.third-person',
  ],
  ARTS: [
    'grammar.past-simple.irregular',
    'grammar.passive.past',
    'grammar.past-simple.regular',
  ],
  GEOGRAPHY: [
    'grammar.there-was-were',
    'grammar.present-simple.third-person',
    'grammar.comparatives',
  ],
  TECHNOLOGY: [
    'grammar.present-simple.third-person',
    'grammar.past-simple.regular',
    'grammar.comparatives',
  ],
  OTHER: ['grammar.past-simple.regular', 'grammar.there-was-were'],
};

/** Interesse em pt-BR que cada categoria alimenta no modelo do aluno. */
export const THEME_TOPIC_PT: Record<ThemeCategory, string> = {
  HISTORY: 'história',
  SCIENCE: 'ciência',
  SPORTS: 'esportes',
  MUSIC: 'música',
  ARTS: 'arte',
  GEOGRAPHY: 'geografia',
  TECHNOLOGY: 'tecnologia',
  OTHER: 'curiosidades',
};

export function themeSkills(category: ThemeCategory): readonly string[] {
  return THEME_SKILLS[category];
}

export const MAX_TARGET_SKILLS = 3;
export const MAX_REGISTER_NOTES = 2;

/** Tipos de skill que um texto consegue praticar como estrutura. */
const TARGETABLE_TYPES = new Set(['GRAMMAR', 'CHUNK']);

export type CatalogSkill = { id: string; type: string; cefrLevel: CefrLevel };
export type CatalogRegisterNote = { id: string; cefrLevel: CefrLevel };

export type PickTargetsInput = {
  /** Nível em que o material vai ser escrito. */
  level: CefrLevel;
  /** Na ordem do snapshot: a mais fraca primeiro. */
  weakSkillIds: readonly string[];
  nextTargetSkillIds: readonly string[];
  themeSkillIds: readonly string[];
  catalog: readonly CatalogSkill[];
  registerNotes: readonly CatalogRegisterNote[];
  /** Varia a nota de registro entre assuntos, sem sorteio (ex.: id da página). */
  seed: string;
};

export type Targets = {
  skillIds: string[];
  registerNoteIds: string[];
};

/**
 * Prioridade: fraquezas → próximas skills do aluno → skills do tema.
 *
 * As duas primeiras fontes ocupam no máximo dois lugares: o terceiro fica
 * para uma estrutura que combine com o assunto, quando há — um texto de
 * história que não pratica o passado desperdiça o assunto. Sem skill do
 * tema, as vagas voltam para as necessidades do aluno.
 *
 * Só entra skill ativa do catálogo, de tipo estrutural, até um nível acima
 * do material (a próxima coisa a aprender, não algo inalcançável).
 */
export function pickTargets(input: PickTargetsInput): Targets {
  const maxIndex = levelIndex(input.level) + 1;
  const eligible = new Map(
    input.catalog
      .filter(
        (skill) =>
          TARGETABLE_TYPES.has(skill.type) &&
          levelIndex(skill.cefrLevel) <= maxIndex,
      )
      .map((skill) => [skill.id, skill]),
  );

  const needs = unique([
    ...input.weakSkillIds,
    ...input.nextTargetSkillIds,
  ]).filter((id) => eligible.has(id));
  const theme = unique(input.themeSkillIds).filter(
    (id) =>
      eligible.has(id) &&
      levelIndex(eligible.get(id)?.cefrLevel ?? input.level) <=
        levelIndex(input.level),
  );

  const chosen: string[] = needs.slice(0, MAX_TARGET_SKILLS - 1);
  const themeFill = theme.find((id) => !chosen.includes(id));

  if (themeFill !== undefined) {
    chosen.push(themeFill);
  }

  for (const id of [...needs, ...theme]) {
    if (chosen.length >= MAX_TARGET_SKILLS) break;
    if (!chosen.includes(id)) chosen.push(id);
  }

  // Aluno sem histórico e assunto sem estrutura mapeada: as gramáticas do
  // próprio nível, em ordem de catálogo.
  if (chosen.length < 2) {
    for (const skill of eligible.values()) {
      if (chosen.length >= 2) break;
      if (
        skill.type === 'GRAMMAR' &&
        skill.cefrLevel === input.level &&
        !chosen.includes(skill.id)
      ) {
        chosen.push(skill.id);
      }
    }
  }

  return {
    skillIds: chosen,
    registerNoteIds: pickRegisterNotes(
      input.registerNotes,
      input.level,
      input.seed,
    ),
  };
}

/**
 * 1–2 notas de registro: do nível do material primeiro, depois as de baixo.
 * Qual delas depende de `seed`, para dois assuntos diferentes não trazerem
 * sempre o mesmo "gonna".
 */
export function pickRegisterNotes(
  notes: readonly CatalogRegisterNote[],
  level: CefrLevel,
  seed: string,
): string[] {
  const target = levelIndex(level);
  const sameLevel = notes
    .filter((note) => note.cefrLevel === level)
    .map((note) => note.id)
    .sort();
  const below = notes
    .filter((note) => levelIndex(note.cefrLevel) < target)
    .map((note) => note.id)
    .sort();
  const pool = [...sameLevel, ...below];

  if (pool.length === 0) {
    return [];
  }

  // Gira só entre as do nível; as de baixo ficam como reserva, em ordem.
  const offset = stableNumber(seed) % Math.max(1, sameLevel.length);
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  return rotated.slice(0, MAX_REGISTER_NOTES);
}

/**
 * Chave do material base compartilhado. A ordem dos alvos não importa:
 * "[a, b]" e "[b, a]" são o mesmo pedido.
 */
export function materialCacheKey(input: {
  pageId: number;
  revisionId: string;
  level: CefrLevel;
  targetSkillIds: readonly string[];
  registerNoteIds: readonly string[];
  promptVersion: number;
}): string {
  const payload = JSON.stringify({
    pageId: input.pageId,
    revisionId: input.revisionId,
    level: input.level,
    targetSkillIds: [...input.targetSkillIds].sort(),
    registerNoteIds: [...input.registerNoteIds].sort(),
    promptVersion: input.promptVersion,
  });

  return createHash('sha256').update(payload).digest('hex');
}

function stableNumber(seed: string): number {
  return createHash('sha256').update(seed).digest().readUInt32BE(0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
