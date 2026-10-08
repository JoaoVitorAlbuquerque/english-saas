import {
  DEFAULT_DRAFT_ITEM_TYPES,
  issueMessage,
  requestItemsDraftSchema,
  requestLessonDraftSchema,
  requestRegisterNotesDraftSchema,
  type CefrLevel,
  type RequestItemsDraft,
  type RequestLessonDraft,
  type RequestRegisterNotesDraft,
  type DRAFTABLE_ITEM_TYPES,
} from '@english-saas/shared';

import { t } from '../../../messages/pt-BR';
import { slugify } from '../../curriculum/lib/slug';

/**
 * Formulários de novo rascunho. O estado é texto (o que o campo guarda); a
 * validação roda os **mesmos schemas do servidor** (`packages/shared`), então
 * o limite que a API aplica é o que aparece no campo.
 */

export type DraftFieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Lição
// ---------------------------------------------------------------------------

export type LessonDraftForm = {
  level: CefrLevel | '';
  unitId: string;
  /** Uma lição nova na unidade, ou uma que já existe (abre a próxima versão). */
  mode: 'new' | 'existing';
  lessonId: string;
  slug: string;
  /** O editor mexeu no identificador: deixa de acompanhar o título. */
  slugEdited: boolean;
  title: string;
  order: string;
  objective: string;
  targetSkillIds: string[];
  characterIds: string[];
  unitContext: string;
};

export const EMPTY_LESSON_FORM: LessonDraftForm = {
  level: '',
  unitId: '',
  mode: 'new',
  lessonId: '',
  slug: '',
  slugEdited: false,
  title: '',
  order: '0',
  objective: '',
  targetSkillIds: [],
  characterIds: [],
  unitContext: '',
};

/** A posição seguinte à última lição da unidade. */
export function nextLessonOrder(lessons: readonly { order: number }[]): number {
  return lessons.reduce((max, lesson) => Math.max(max, lesson.order + 1), 0);
}

/** Muda o título e, enquanto o identificador não foi mexido, o acompanha. */
export function withTitle(
  form: LessonDraftForm,
  title: string,
): LessonDraftForm {
  return {
    ...form,
    title,
    slug: form.slugEdited ? form.slug : slugify(title),
  };
}

export function toLessonRequest(
  form: LessonDraftForm,
): Record<string, unknown> {
  const unitContext = form.unitContext.trim();
  const title = form.title.trim();

  return {
    ...(form.mode === 'existing'
      ? { lessonId: form.lessonId }
      : {
          unitId: form.unitId,
          slug: form.slug.trim(),
          order: Number(form.order),
          ...(title === '' ? {} : { title }),
        }),
    objective: form.objective.trim(),
    level: form.level,
    targetSkillIds: form.targetSkillIds,
    characterIds: form.characterIds,
    ...(unitContext === '' ? {} : { unitContext }),
  };
}

function collect(
  issues: readonly { path: PropertyKey[]; message: string }[],
  errors: DraftFieldErrors,
  skip: ReadonlySet<string> = new Set(),
): void {
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');

    if (field !== '' && !skip.has(field) && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
}

export function validateLessonForm(form: LessonDraftForm): DraftFieldErrors {
  const errors: DraftFieldErrors = {};

  if (form.mode === 'existing') {
    if (form.lessonId === '') {
      errors['lessonId'] = t('studio.new.lesson.errors.lesson');
    }
  } else {
    if (form.unitId === '') {
      errors['unitId'] = t('studio.new.lesson.errors.unit');
    }

    if (form.slug.trim() === '') {
      errors['slug'] = t('studio.new.lesson.errors.slug');
    }

    if (!/^\d+$/.test(form.order.trim())) {
      errors['order'] = t('studio.new.lesson.errors.order');
    }
  }

  if (form.level === '') {
    errors['level'] = t('studio.new.errors.level');
  }

  const parsed = requestLessonDraftSchema.safeParse(toLessonRequest(form));

  if (!parsed.success) {
    // `lessonId` aqui é o `refine` "informe a lição ou a unidade": já tratado acima.
    collect(
      parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issueMessage(issue),
      })),
      errors,
      new Set(['lessonId']),
    );
  }

  return errors;
}

export function parseLessonRequest(form: LessonDraftForm): RequestLessonDraft {
  return requestLessonDraftSchema.parse(toLessonRequest(form));
}

// ---------------------------------------------------------------------------
// Questões
// ---------------------------------------------------------------------------

export type ItemsDraftForm = {
  skillId: string;
  level: CefrLevel | '';
  count: string;
  types: (typeof DRAFTABLE_ITEM_TYPES)[number][];
};

export const EMPTY_ITEMS_FORM: ItemsDraftForm = {
  skillId: '',
  level: '',
  count: '5',
  types: [...DEFAULT_DRAFT_ITEM_TYPES],
};

export function toItemsRequest(form: ItemsDraftForm): Record<string, unknown> {
  return {
    skillId: form.skillId,
    level: form.level,
    count: /^\d+$/.test(form.count.trim()) ? Number(form.count) : Number.NaN,
    types: form.types,
  };
}

export function validateItemsForm(form: ItemsDraftForm): DraftFieldErrors {
  const errors: DraftFieldErrors = {};

  if (form.skillId === '') {
    errors['skillId'] = t('studio.new.items.errors.skill');
  }

  if (form.level === '') {
    errors['level'] = t('studio.new.errors.level');
  }

  if (!/^\d+$/.test(form.count.trim())) {
    errors['count'] = t('studio.new.errors.count');
  }

  const parsed = requestItemsDraftSchema.safeParse(toItemsRequest(form));

  if (!parsed.success) {
    collect(
      parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issueMessage(issue),
      })),
      errors,
    );
  }

  if (form.types.length === 0) {
    errors['types'] = t('studio.new.items.errors.types');
  }

  return errors;
}

export function parseItemsRequest(form: ItemsDraftForm): RequestItemsDraft {
  return requestItemsDraftSchema.parse(toItemsRequest(form));
}

// ---------------------------------------------------------------------------
// Notas de registro
// ---------------------------------------------------------------------------

export type NotesDraftForm = { level: CefrLevel | ''; count: string };

export const EMPTY_NOTES_FORM: NotesDraftForm = { level: '', count: '5' };

export function toNotesRequest(form: NotesDraftForm): Record<string, unknown> {
  return {
    level: form.level,
    count: /^\d+$/.test(form.count.trim()) ? Number(form.count) : Number.NaN,
  };
}

export function validateNotesForm(form: NotesDraftForm): DraftFieldErrors {
  const errors: DraftFieldErrors = {};

  if (form.level === '') {
    errors['level'] = t('studio.new.errors.level');
  }

  if (!/^\d+$/.test(form.count.trim())) {
    errors['count'] = t('studio.new.errors.count');
  }

  const parsed = requestRegisterNotesDraftSchema.safeParse(
    toNotesRequest(form),
  );

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');

      if (field !== '' && errors[field] === undefined) {
        errors[field] = issueMessage(issue);
      }
    }
  }

  return errors;
}

export function parseNotesRequest(
  form: NotesDraftForm,
): RequestRegisterNotesDraft {
  return requestRegisterNotesDraftSchema.parse(toNotesRequest(form));
}

/** A quantidade do formulário, quando é um número que serve para estimar. */
export function countOf(text: string, max: number): number {
  const value = Number(text);

  return Number.isInteger(value) && value >= 1 ? Math.min(value, max) : 1;
}
