/**
 * O que uma lição concluída cria: um card para cada skill-alvo, chunk e
 * conjunto de vocabulário que ela tocou, mais um por nota de registro
 * referenciada. "Vocabulário **novo**" do pedido é o filtro de `newCandidates`
 * — não recria o que o aluno já tem.
 *
 * Vocabulário e chunk já são `Skill` (`VOCAB_SET` e `CHUNK`), então a
 * classificação usa o `SkillType` de cada skill referenciada.
 */

export type ReviewCardKind =
  'SKILL' | 'VOCAB' | 'CHUNK' | 'REGISTER_NOTE' | 'ERROR_PATTERN' | 'TERM';

export type CardCandidate = { kind: ReviewCardKind; refId: string };

const KIND_BY_SKILL_TYPE: Record<string, ReviewCardKind> = {
  VOCAB_SET: 'VOCAB',
  CHUNK: 'CHUNK',
};

export function kindForSkillType(skillType: string): ReviewCardKind {
  return KIND_BY_SKILL_TYPE[skillType] ?? 'SKILL';
}

export function candidatesFromLessonOutline(
  outline: {
    targetSkillIds: readonly string[];
    referencedSkillIds: readonly string[];
    registerNoteIds: readonly string[];
  },
  skillTypeById: ReadonlyMap<string, string>,
): CardCandidate[] {
  const skillIds = new Set([
    ...outline.targetSkillIds,
    ...outline.referencedSkillIds,
  ]);

  const candidates: CardCandidate[] = [...skillIds].flatMap((skillId) => {
    const type = skillTypeById.get(skillId);
    return type === undefined
      ? []
      : [{ kind: kindForSkillType(type), refId: skillId }];
  });

  for (const registerNoteId of outline.registerNoteIds) {
    candidates.push({ kind: 'REGISTER_NOTE', refId: registerNoteId });
  }

  return candidates;
}

export function cardKey(card: { kind: ReviewCardKind; refId: string }): string {
  return `${card.kind}:${card.refId}`;
}

/** O que ainda não existe — cria uma vez, nunca reagenda o que já tem. */
export function newCandidates(
  candidates: readonly CardCandidate[],
  existingKeys: ReadonlySet<string>,
): CardCandidate[] {
  const seen = new Set(existingKeys);
  const result: CardCandidate[] = [];

  for (const candidate of candidates) {
    const key = cardKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }

  return result;
}

/**
 * Chave de dedup de um termo solto (card TERM): minúsculo, aspas e espaços
 * normalizados, sem pontuação nas pontas. "Set sail!" e "set  sail" são o
 * mesmo termo.
 */
export function normalizeTerm(term: string): string {
  return term
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
