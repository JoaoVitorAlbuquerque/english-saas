import type { z } from 'zod';

import {
  STEP_CONTENT_SCHEMAS,
  lessonStepSchema,
  type LessonStepInput,
  type LessonStepType,
  type Span,
} from './lesson-content';

/**
 * Validação do conteúdo de uma lição, **a mesma no servidor e no editor**.
 *
 * O zod (em `lesson-content.ts`) cuida da forma. Aqui entra o que ele não
 * alcança: as marcações contra o texto que elas marcam, e a lição como um
 * todo — ordem sem buraco, sem etapa repetida no mesmo lugar.
 *
 * São funções puras: entra objeto, sai lista de problema. Moram no `shared`
 * para o editor do admin dizer, enquanto a pessoa digita, exatamente o que a
 * API diria ao gravar ou publicar.
 */

// ---------------------------------------------------------------------------
// Spans
// ---------------------------------------------------------------------------

/**
 * Marcação sobre texto.
 *
 * O zod já garante a forma de cada span isolado (`end > start`, tipo com a
 * referência certa). O que falta é a relação com o texto marcado, e isso
 * depende dos dois juntos.
 *
 * Sobreposição é erro. Duas marcações no mesmo pedaço de frase não têm como
 * ser renderizadas sem ambiguidade; quando um chunk e uma estrutura caem no
 * mesmo trecho, marque o mais específico.
 */

export type SpanIssue = {
  /** Índice do span na lista original. */
  index: number;
  message: string;
};

/** Ordena por início; empate, o mais curto primeiro. */
export function sortSpans(spans: readonly Span[]): Span[] {
  return [...spans].sort(
    (a, b) => a.start - b.start || a.end - a.start - (b.end - b.start),
  );
}

/** O trecho que o span marca. */
export function sliceSpan(text: string, span: Span): string {
  return text.slice(span.start, span.end);
}

/** Confere os spans contra o texto que eles marcam. */
export function validateSpans(
  text: string,
  spans: readonly Span[],
): SpanIssue[] {
  const issues: SpanIssue[] = [];
  const indexed = spans.map((span, index) => ({ span, index }));

  for (const { span, index } of indexed) {
    if (span.end > text.length) {
      issues.push({
        index,
        message: `A marcação passa do fim do texto (${String(span.end)} > ${String(text.length)}).`,
      });
      continue;
    }

    if (sliceSpan(text, span).trim().length === 0) {
      issues.push({ index, message: 'A marcação cobre só espaço em branco.' });
    }
  }

  const ordered = [...indexed].sort((a, b) => a.span.start - b.span.start);

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];

    if (previous === undefined || current === undefined) {
      continue;
    }

    if (current.span.start < previous.span.end) {
      issues.push({
        index: current.index,
        message: 'Duas marcações se sobrepõem no mesmo trecho.',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------

/**
 * O zod escreve as mensagens padrão em inglês ("Too small: expected string
 * to have >=2 characters"). Quem edita conteúdo lê em pt-BR, no campo. As
 * mensagens que o próprio schema define (`.refine`, `.regex`) já são pt-BR
 * e passam como estão.
 */
export function issueMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.message.includes('received undefined')
        ? 'Preencha este campo.'
        : 'Valor inválido.';

    case 'too_small': {
      const min = Number(issue.minimum);

      if (issue.origin === 'string') {
        return min <= 1
          ? 'Preencha este campo.'
          : `Escreva ao menos ${String(min)} caracteres.`;
      }

      if (issue.origin === 'array') {
        return min <= 1
          ? 'Adicione ao menos um item.'
          : `Adicione ao menos ${String(min)} itens.`;
      }

      return `O mínimo é ${String(min)}.`;
    }

    case 'too_big': {
      const max = Number(issue.maximum);

      if (issue.origin === 'string') {
        return `Use no máximo ${String(max)} caracteres.`;
      }

      if (issue.origin === 'array') {
        return `Use no máximo ${String(max)} itens.`;
      }

      return `O máximo é ${String(max)}.`;
    }

    case 'invalid_format':
      return issue.format === 'uuid'
        ? 'Escolha uma opção da lista.'
        : issue.message;

    case 'invalid_value':
      return 'Escolha uma das opções.';

    default:
      return issue.message;
  }
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

export type StepInput = {
  order: number;
  type: LessonStepType;
  content: unknown;
};

export type StepIssue = {
  /** Ordem da etapa na lição. -1 quando o problema é da lição inteira. */
  order: number;
  /** Caminho dentro do conteúdo: `lines.2.spans.0`. */
  path: string;
  message: string;
};

export type ParsedStep = { order: number } & LessonStepInput;

export type StepValidation =
  { ok: true; steps: ParsedStep[] } | { ok: false; issues: StepIssue[] };

/** Texto que carrega marcação, com o caminho para apontar o erro. */
type SpanTarget = { path: string; text: string; spans: Span[] };

function spanTargets(step: LessonStepInput): SpanTarget[] {
  switch (step.type) {
    case 'SCENE':
      return step.content.lines.map((line, index) => ({
        path: `lines.${String(index)}`,
        text: line.text,
        spans: line.spans,
      }));

    case 'EXPLANATION_CARDS':
      return step.content.cards.flatMap((card, cardIndex) =>
        card.examples.map((example, exampleIndex) => ({
          path: `cards.${String(cardIndex)}.examples.${String(exampleIndex)}`,
          text: example.text,
          spans: example.spans,
        })),
      );

    default:
      return [];
  }
}

/** Valida uma etapa isolada: schema do tipo + marcações. */
export function parseStep(
  step: StepInput,
): { ok: true; step: ParsedStep } | { ok: false; issues: StepIssue[] } {
  const parsed = lessonStepSchema.safeParse({
    type: step.type,
    content: step.content,
  });

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        order: step.order,
        path: issue.path.join('.').replace(/^content\.?/, ''),
        message: issueMessage(issue),
      })),
    };
  }

  const issues: StepIssue[] = [];

  for (const target of spanTargets(parsed.data)) {
    for (const spanIssue of validateSpans(target.text, target.spans)) {
      issues.push({
        order: step.order,
        path: `${target.path}.spans.${String(spanIssue.index)}`,
        message: spanIssue.message,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, step: { order: step.order, ...parsed.data } };
}

/**
 * Valida a lição inteira. Devolve todos os problemas de uma vez: o editor
 * não deve descobrir um erro por vez.
 */
export function validateSteps(steps: readonly StepInput[]): StepValidation {
  const issues: StepIssue[] = [];

  if (steps.length === 0) {
    return {
      ok: false,
      issues: [
        {
          order: -1,
          path: 'steps',
          message: 'A lição precisa de ao menos uma etapa.',
        },
      ],
    };
  }

  const orders = steps.map((step) => step.order);

  if (new Set(orders).size !== orders.length) {
    issues.push({
      order: -1,
      path: 'steps',
      message: 'Duas etapas ocupam a mesma posição.',
    });
  }

  const expected = [...orders].sort((a, b) => a - b);

  if (expected.some((order, index) => order !== index)) {
    issues.push({
      order: -1,
      path: 'steps',
      message: 'A ordem das etapas precisa começar em 0 e não pular número.',
    });
  }

  const parsedSteps: ParsedStep[] = [];

  for (const step of steps) {
    const result = parseStep(step);

    if (result.ok) {
      parsedSteps.push(result.step);
    } else {
      issues.push(...result.issues);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    steps: [...parsedSteps].sort((a, b) => a.order - b.order),
  };
}

/** Valida só o `content`, quando o tipo já é conhecido e confiável. */
export function parseStepContent(
  type: LessonStepType,
  content: unknown,
): unknown {
  return STEP_CONTENT_SCHEMAS[type].parse(content);
}
