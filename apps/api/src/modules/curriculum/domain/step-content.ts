import {
  STEP_CONTENT_SCHEMAS,
  lessonStepSchema,
  type LessonStepInput,
  type LessonStepType,
  type Span,
} from '@english-saas/shared';

import { validateSpans } from './spans';

/**
 * Validação do conteúdo de uma etapa de lição.
 *
 * O zod (em `packages/shared`) cuida da forma. Aqui entra o que ele não
 * alcança: as marcações contra o texto que elas marcam, e a lição como um
 * todo — ordem sem buraco, sem etapa repetida no mesmo lugar.
 *
 * Nada disso toca banco: entra objeto, sai lista de problema.
 */

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
        message: issue.message,
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
