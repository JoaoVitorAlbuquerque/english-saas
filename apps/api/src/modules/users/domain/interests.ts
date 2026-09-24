import {
  MAX_INTEREST_WEIGHT,
  MIN_INTEREST_WEIGHT,
  type Interest,
} from '@english-saas/shared';

/**
 * Interesses do aluno.
 *
 * O aluno escolhe os primeiros no onboarding; depois o sistema aprende
 * (módulo 7) e reajusta os pesos. Tudo que vem do cliente passa por aqui
 * antes de encostar no banco.
 */

export const MAX_INTERESTS_PER_USER = 20;

/** `História!` → `historia`. Vira slug estável, sem acento nem espaço. */
export function normalizeTopic(topic: string): string {
  return topic
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return 50;
  }

  return Math.min(
    Math.max(Math.round(weight), MIN_INTEREST_WEIGHT),
    MAX_INTEREST_WEIGHT,
  );
}

/**
 * Normaliza a lista enviada pelo aluno: slugs limpos, pesos no intervalo,
 * duplicata resolvida pelo maior peso e teto de itens.
 */
export function normalizeInterests(input: Interest[]): Interest[] {
  const byTopic = new Map<string, number>();

  for (const item of input) {
    const topic = normalizeTopic(item.topic);

    if (topic.length < 2) {
      continue;
    }

    const weight = clampWeight(item.weight);
    const current = byTopic.get(topic);

    byTopic.set(
      topic,
      current === undefined ? weight : Math.max(current, weight),
    );
  }

  return [...byTopic.entries()]
    .map(([topic, weight]) => ({ topic, weight }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic))
    .slice(0, MAX_INTERESTS_PER_USER);
}

/**
 * Reforça um interesse observado pelo uso, sem deixar disparar.
 *
 * Usado pelo módulo 7 quando percebe que o aluno escolhe muito um tema.
 * O peso sobe por um passo, nunca passa do teto, e um tema novo entra com o
 * próprio passo como peso inicial.
 */
export function reinforceInterest(
  current: Interest[],
  topic: string,
  step = 5,
): Interest[] {
  const slug = normalizeTopic(topic);

  if (slug.length < 2) {
    return current;
  }

  const existing = current.find((item) => item.topic === slug);

  if (existing === undefined) {
    return normalizeInterests([
      ...current,
      { topic: slug, weight: clampWeight(step) },
    ]);
  }

  return normalizeInterests(
    current.map((item) =>
      item.topic === slug
        ? { topic: item.topic, weight: clampWeight(item.weight + step) }
        : item,
    ),
  );
}
