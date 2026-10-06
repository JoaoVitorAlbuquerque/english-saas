import { normalizeAnswer } from './answer-normalization';
import type { ContentStatus } from './curriculum';
import {
  ITEM_CONTENT_SCHEMAS,
  hasTypedAnswer,
  itemContentSchema,
  type ItemType,
} from './item-content';
import { issueMessage, validateSpans } from './lesson-validation';

/**
 * Regras do banco de questões, **as mesmas no servidor e no editor do admin**.
 *
 * A principal: **item publicado é imutável no que define a pergunta.**
 * `type`, `prompt`, `content` e `acceptedAnswers` ficam congelados depois do
 * publish, porque `exposureCount` e `correctRate` são estatística de uma
 * pergunta específica — mexer no enunciado e manter o histórico produziria
 * uma calibração que não corresponde a nada (módulo 8). Para mudar, cria-se
 * um item novo em DRAFT ligado ao antigo por `replacedById`.
 *
 * O resto (`explanation`, `skillIds`, `errorPatternMap`, `difficulty`) pode
 * ser corrigido no lugar: nenhum deles muda o que foi perguntado.
 *
 * São funções puras: entra objeto, sai lista de problema.
 */

export const IMMUTABLE_ITEM_FIELDS = [
  'type',
  'prompt',
  'content',
  'acceptedAnswers',
] as const;

export type ImmutableItemField = (typeof IMMUTABLE_ITEM_FIELDS)[number];

export type ItemDefinition = {
  type: ItemType;
  prompt: string;
  content: unknown;
  acceptedAnswers: string[];
};

/** Comparação estável: a ordem das chaves do JSON não é informação. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

  return `{${entries.join(',')}}`;
}

/** Quais campos congelados a edição mexeria. Lista vazia = edição inócua. */
export function immutableFieldChanges(
  current: ItemDefinition,
  incoming: Partial<ItemDefinition>,
): ImmutableItemField[] {
  const changed: ImmutableItemField[] = [];

  if (incoming.type !== undefined && incoming.type !== current.type) {
    changed.push('type');
  }

  if (incoming.prompt !== undefined && incoming.prompt !== current.prompt) {
    changed.push('prompt');
  }

  if (
    incoming.content !== undefined &&
    stableStringify(incoming.content) !== stableStringify(current.content)
  ) {
    changed.push('content');
  }

  if (
    incoming.acceptedAnswers !== undefined &&
    stableStringify([...incoming.acceptedAnswers].sort()) !==
      stableStringify([...current.acceptedAnswers].sort())
  ) {
    changed.push('acceptedAnswers');
  }

  return changed;
}

/**
 * A edição precisa virar item novo?
 *
 * Só quando o item já circulou — DRAFT, IN_REVIEW e APPROVED ainda não
 * foram respondidos por ninguém, então podem ser corrigidos no lugar.
 */
export function requiresNewItem(
  status: ContentStatus,
  changes: readonly ImmutableItemField[],
): boolean {
  return (
    (status === 'PUBLISHED' || status === 'ARCHIVED') && changes.length > 0
  );
}

export type ItemIssue = { path: string; message: string };

/**
 * Valida a questão inteira: conteúdo conforme o tipo e gabarito no lugar
 * certo — nos tipos digitados ele mora em `acceptedAnswers`; nos de escolha,
 * dentro do próprio `content`.
 *
 * O `path` das mensagens do conteúdo vem sem o prefixo `content.`
 * (`options.0.text`); as que são do item em si usam `acceptedAnswers` e
 * `errorPatternMap`.
 */
export function validateItem(input: {
  type: ItemType;
  content: unknown;
  acceptedAnswers: readonly string[];
  errorPatternMap?: Record<string, string>;
}): ItemIssue[] {
  const issues: ItemIssue[] = [];
  const parsed = itemContentSchema.safeParse({
    type: input.type,
    content: input.content,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join('.').replace(/^content\.?/, '') || 'content',
        message: issueMessage(issue),
      });
    }
  } else if (parsed.data.type === 'READING_COMPREHENSION') {
    const { passage, spans } = parsed.data.content;

    for (const issue of validateSpans(passage, spans)) {
      issues.push({
        path: `spans.${String(issue.index)}`,
        message: issue.message,
      });
    }
  }

  if (hasTypedAnswer(input.type)) {
    if (input.acceptedAnswers.length === 0) {
      issues.push({
        path: 'acceptedAnswers',
        message: 'Este tipo de questão precisa de ao menos uma resposta certa.',
      });
    }

    const normalized = input.acceptedAnswers.map(normalizeAnswer);

    if (normalized.some((answer) => answer.length === 0)) {
      issues.push({
        path: 'acceptedAnswers',
        message: 'Uma das respostas aceitas ficou vazia depois de normalizar.',
      });
    }

    if (new Set(normalized).size !== normalized.length) {
      issues.push({
        path: 'acceptedAnswers',
        message: 'Duas respostas aceitas são equivalentes — mantenha só uma.',
      });
    }
  } else if (input.acceptedAnswers.length > 0) {
    issues.push({
      path: 'acceptedAnswers',
      message:
        'Neste tipo a resposta certa fica no conteúdo, não em acceptedAnswers.',
    });
  }

  for (const wrongAnswer of Object.keys(input.errorPatternMap ?? {})) {
    if (normalizeAnswer(wrongAnswer).length === 0) {
      issues.push({
        path: 'errorPatternMap',
        message: 'Uma chave do mapa de erros ficou vazia depois de normalizar.',
      });
    }
  }

  return issues;
}

/** Só o `content`, quando o tipo já veio validado. */
export function parseItemContent(type: ItemType, content: unknown): unknown {
  return ITEM_CONTENT_SCHEMAS[type].parse(content);
}
