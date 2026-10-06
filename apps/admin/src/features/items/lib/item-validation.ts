import {
  hasTypedAnswer,
  issueMessage,
  itemAuthoringSchema,
  validateItem,
} from '@english-saas/shared';

import { t } from '../../../messages/pt-BR';
import type { FieldIssue } from '../../curriculum/lib/validation';
import {
  cleanContent,
  isRowIncomplete,
  parseNumber,
  rowsToMap,
  type ItemFormState,
} from './item-form';

/**
 * Validação ao vivo do item — a **mesma** do servidor.
 *
 * Roda `itemAuthoringSchema` (limites dos campos) e `validateItem`
 * (conteúdo do tipo, gabarito, respostas aceitas) do `packages/shared`, que
 * a API também usa ao gravar. O que o servidor confere no banco (a skill
 * existe, a nota de registro existe) fica com ele.
 *
 * Caminhos: `prompt`, `explanation`, `skillIds`, `difficulty`…, o conteúdo
 * em `content.<campo>` (`content.options.0.text`), `acceptedAnswers.<n>` e
 * `errorPatternMap.<n>` (a linha do mapa).
 */

const ITEM_LEVEL_PATHS = new Set(['acceptedAnswers', 'errorPatternMap']);

/** O caminho que `validateItem` devolve (relativo ao conteúdo) → o do campo. */
export function fieldPathOf(path: string): string {
  if (path === 'content' || path.startsWith('content.')) {
    return path;
  }

  const [head = ''] = path.split('.');

  return ITEM_LEVEL_PATHS.has(head) ? path : `content.${path}`;
}

export function validateItemForm(state: ItemFormState): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const content = cleanContent(state.type, state.content);
  const accepted = hasTypedAnswer(state.type) ? state.acceptedAnswers : [];
  const map = rowsToMap(state.errorPatternMap);

  const fields = itemAuthoringSchema.safeParse({
    type: state.type,
    prompt: state.prompt,
    content,
    acceptedAnswers: accepted,
    explanation: state.explanation,
    errorPatternMap: map,
    cefrLevel: state.cefrLevel,
    difficulty: parseNumber(state.difficulty),
    ...(parseNumber(state.discrimination) === null
      ? {}
      : { discrimination: parseNumber(state.discrimination) }),
    skillIds: state.skillIds,
    ...(state.slug.trim() === '' ? {} : { slug: state.slug.trim() }),
  });

  if (!fields.success) {
    for (const issue of fields.error.issues) {
      issues.push({
        path: issue.path.join('.'),
        message: issueMessage(issue),
      });
    }
  }

  for (const issue of validateItem({
    type: state.type,
    content,
    acceptedAnswers: accepted,
    errorPatternMap: map,
  })) {
    issues.push({ path: fieldPathOf(issue.path), message: issue.message });
  }

  state.errorPatternMap.forEach((row, index) => {
    if (isRowIncomplete(row)) {
      issues.push({
        path: `errorPatternMap.${String(index)}`,
        message:
          row.wrong.trim() === ''
            ? t('items.map.needWrong')
            : t('items.map.needPattern'),
      });
    }
  });

  return dedupe(issues);
}

/** Dois motivos para o mesmo campo com a mesma frase aparecem uma vez só. */
function dedupe(issues: FieldIssue[]): FieldIssue[] {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.path}|${issue.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

/** O conteúdo passa no schema do tipo? Só então o preview o desenha. */
export function contentIsRenderable(state: ItemFormState): boolean {
  return !validateItem({
    type: state.type,
    content: cleanContent(state.type, state.content),
    // Só o conteúdo importa para desenhar: o gabarito entra no "ver gabarito".
    acceptedAnswers: hasTypedAnswer(state.type) ? ['x'] : [],
  }).some((issue) => !ITEM_LEVEL_PATHS.has(issue.path));
}
