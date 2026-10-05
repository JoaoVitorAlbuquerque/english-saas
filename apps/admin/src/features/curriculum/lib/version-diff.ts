import type { CefrLevel, LessonStepType } from '@english-saas/shared';

/**
 * Diferença entre duas versões da mesma lição — a lista do que mudou, campo
 * a campo, "antes → depois". Sem diff de palavra: o editor quer saber **onde**
 * mexeram, e abre a etapa para ver o resto.
 *
 * As etapas são comparadas por posição. Reordenar duas etapas aparece como
 * as duas "alteradas" — é o que a pessoa vê na lista.
 */

export type DiffVersion = {
  title: string;
  objective: string;
  cefrLevel: CefrLevel;
  estimatedMinutes: number;
  targetSkills: { skillId: string; position: number }[];
  steps: { order: number; type: LessonStepType; content: unknown }[];
};

export type MetaField =
  'title' | 'objective' | 'cefrLevel' | 'estimatedMinutes';

export type MetaChange = { field: MetaField; before: string; after: string };

/** Um campo de texto de uma etapa que mudou. `path`: `lines.2.text`. */
export type FieldChange = { path: string; before: string; after: string };

export type StepDiff =
  | { kind: 'added'; position: number; type: LessonStepType }
  | { kind: 'removed'; position: number; type: LessonStepType }
  | {
      kind: 'changed';
      position: number;
      type: LessonStepType;
      /** Quando a etapa trocou de tipo, de qual para qual. */
      typeChange: { from: LessonStepType; to: LessonStepType } | null;
      fields: FieldChange[];
    };

export type VersionDiff = {
  meta: MetaChange[];
  skillsAdded: string[];
  skillsRemoved: string[];
  steps: StepDiff[];
  unchangedSteps: number;
  /** Nada mudou entre as duas versões. */
  isEmpty: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinPath(prefix: string, part: string | number): string {
  return prefix === '' ? String(part) : `${prefix}.${String(part)}`;
}

function formatSpans(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return '';
  }

  return value
    .map((span) => {
      if (!isRecord(span)) {
        return String(span);
      }

      const ref =
        typeof span.skillId === 'string'
          ? span.skillId
          : typeof span.registerNoteId === 'string'
            ? span.registerNoteId
            : '';

      return `${String(span.kind)} ${String(span.start)}–${String(span.end)}${
        ref === '' ? '' : ` (${ref})`
      }`;
    })
    .join('; ');
}

/** Achata o conteúdo em `caminho → texto`, uma entrada por campo. */
export function flattenContent(
  value: unknown,
  prefix = '',
  out = new Map<string, string>(),
): Map<string, string> {
  if (Array.isArray(value)) {
    const allPrimitive = value.every(
      (entry) => typeof entry !== 'object' || entry === null,
    );

    if (allPrimitive) {
      out.set(prefix, value.map(String).join(', '));
    } else {
      value.forEach((entry, index) => {
        flattenContent(entry, joinPath(prefix, index), out);
      });
    }

    return out;
  }

  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'spans') {
        out.set(joinPath(prefix, key), formatSpans(entry));
      } else {
        flattenContent(entry, joinPath(prefix, key), out);
      }
    }

    return out;
  }

  out.set(prefix, value === undefined || value === null ? '' : String(value));

  return out;
}

function diffFields(before: unknown, after: unknown): FieldChange[] {
  const a = flattenContent(before);
  const b = flattenContent(after);
  const paths = [...new Set([...b.keys(), ...a.keys()])];

  return paths.flatMap((path) => {
    const beforeText = a.get(path) ?? '';
    const afterText = b.get(path) ?? '';

    return beforeText === afterText
      ? []
      : [{ path, before: beforeText, after: afterText }];
  });
}

const META_FIELDS: MetaField[] = [
  'title',
  'objective',
  'cefrLevel',
  'estimatedMinutes',
];

export function diffVersions(from: DiffVersion, to: DiffVersion): VersionDiff {
  const meta: MetaChange[] = META_FIELDS.flatMap((field) => {
    const before = String(from[field]);
    const after = String(to[field]);

    return before === after ? [] : [{ field, before, after }];
  });

  const fromSkills = from.targetSkills.map((target) => target.skillId);
  const toSkills = to.targetSkills.map((target) => target.skillId);
  const skillsAdded = toSkills.filter((id) => !fromSkills.includes(id));
  const skillsRemoved = fromSkills.filter((id) => !toSkills.includes(id));

  const fromSteps = [...from.steps].sort((a, b) => a.order - b.order);
  const toSteps = [...to.steps].sort((a, b) => a.order - b.order);
  const length = Math.max(fromSteps.length, toSteps.length);
  const steps: StepDiff[] = [];
  let unchangedSteps = 0;

  for (let position = 0; position < length; position += 1) {
    const before = fromSteps[position];
    const after = toSteps[position];

    if (before === undefined && after !== undefined) {
      steps.push({ kind: 'added', position, type: after.type });
    } else if (after === undefined && before !== undefined) {
      steps.push({ kind: 'removed', position, type: before.type });
    } else if (before !== undefined && after !== undefined) {
      const fields = diffFields(before.content, after.content);
      const typeChange =
        before.type === after.type
          ? null
          : { from: before.type, to: after.type };

      if (fields.length === 0 && typeChange === null) {
        unchangedSteps += 1;
      } else {
        steps.push({
          kind: 'changed',
          position,
          type: after.type,
          typeChange,
          fields,
        });
      }
    }
  }

  return {
    meta,
    skillsAdded,
    skillsRemoved,
    steps,
    unchangedSteps,
    isEmpty:
      meta.length === 0 &&
      skillsAdded.length === 0 &&
      skillsRemoved.length === 0 &&
      steps.length === 0,
  };
}
