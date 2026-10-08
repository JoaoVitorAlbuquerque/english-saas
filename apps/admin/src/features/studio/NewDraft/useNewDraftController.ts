import {
  useAdminCharacters,
  useAdminLessons,
  useAdminUnits,
  useCourses,
  useDraftEstimate,
  useRequestItemsDraft,
  useRequestLessonDraft,
  useRequestRegisterNotesDraft,
  type ApiError,
  type Draft,
} from '@english-saas/api-client';
import {
  DRAFT_LIMITS,
  type CefrLevel,
  type DraftKind,
} from '@english-saas/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  EMPTY_ITEMS_FORM,
  EMPTY_LESSON_FORM,
  EMPTY_NOTES_FORM,
  countOf,
  nextLessonOrder,
  parseItemsRequest,
  parseLessonRequest,
  parseNotesRequest,
  validateItemsForm,
  validateLessonForm,
  validateNotesForm,
  withTitle,
  type DraftFieldErrors,
  type ItemsDraftForm,
  type LessonDraftForm,
  type NotesDraftForm,
} from '../lib/draft-form';

export const DRAFT_TABS = ['licao', 'questoes', 'notas'] as const;
export type DraftTab = (typeof DRAFT_TABS)[number];

const KIND_OF_TAB: Record<DraftTab, DraftKind> = {
  licao: 'LESSON',
  questoes: 'ITEMS',
  notas: 'REGISTER_NOTES',
};

/** A aba aberta vive na URL (`?tipo=`): dá para mandar o link e o reload não perde. */
export function useDraftTab(): [DraftTab, (tab: DraftTab) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tipo');
  const tab: DraftTab = DRAFT_TABS.find((entry) => entry === raw) ?? 'licao';

  return [
    tab,
    (next) =>
      setParams(next === 'licao' ? {} : { tipo: next }, { replace: true }),
  ];
}

/** Depois de pedir: a fila, com o pedido novo em destaque. */
function useAfterRequest() {
  const navigate = useNavigate();

  return (draft: Draft) => navigate(`/estudio?novo=${draft.id}`);
}

type Submission = {
  errors: DraftFieldErrors;
  /** Mensagem do servidor quando recusa o pedido (conflito, referência inexistente). */
  serverError: string | null;
  attempted: boolean;
};

const CLEAN: Submission = { errors: {}, serverError: null, attempted: false };

// ---------------------------------------------------------------------------
// Lição
// ---------------------------------------------------------------------------

export function useLessonDraftForm() {
  const [form, setForm] = useState<LessonDraftForm>(EMPTY_LESSON_FORM);
  const [orderEdited, setOrderEdited] = useState(false);
  const [submission, setSubmission] = useState<Submission>(CLEAN);
  const afterRequest = useAfterRequest();
  const request = useRequestLessonDraft();

  const courses = useCourses();
  const characters = useAdminCharacters();
  const levelId = useMemo(
    () =>
      courses.data
        ?.flatMap((course) => course.levels)
        .find((level) => level.cefrLevel === form.level)?.id,
    [courses.data, form.level],
  );
  const units = useAdminUnits(levelId);
  const lessons = useAdminLessons(form.unitId === '' ? undefined : form.unitId);
  const unit = units.data?.find((entry) => entry.id === form.unitId);

  // A posição sugerida é a seguinte à última lição, enquanto o editor não mexe.
  useEffect(() => {
    if (form.mode === 'new' && !orderEdited && lessons.data !== undefined) {
      const order = String(nextLessonOrder(lessons.data));

      setForm((current) =>
        current.order === order ? current : { ...current, order },
      );
    }
  }, [form.mode, orderEdited, lessons.data]);

  const errors = submission.attempted ? validateLessonForm(form) : {};
  const estimate = useDraftEstimate('LESSON', 1);

  function patch(change: Partial<LessonDraftForm>): void {
    setForm((current) => ({ ...current, ...change }));
  }

  function changeLevel(level: CefrLevel | ''): void {
    // A unidade e a lição eram do nível anterior.
    patch({ level, unitId: '', lessonId: '' });
    setOrderEdited(false);
  }

  function changeUnit(unitId: string): void {
    const chosen = units.data?.find((entry) => entry.id === unitId);

    setOrderEdited(false);
    setForm((current) => ({
      ...current,
      unitId,
      lessonId: '',
      // Quem fala na cena é o elenco da unidade: já vem marcado, o editor ajusta.
      characterIds:
        current.characterIds.length > 0
          ? current.characterIds
          : (chosen?.cast.map((entry) => entry.character.id) ?? []).slice(
              0,
              DRAFT_LIMITS.characters.max,
            ),
    }));
  }

  function toggleCharacter(id: string): void {
    setForm((current) => ({
      ...current,
      characterIds: current.characterIds.includes(id)
        ? current.characterIds.filter((entry) => entry !== id)
        : current.characterIds.length >= DRAFT_LIMITS.characters.max
          ? current.characterIds
          : [...current.characterIds, id],
    }));
  }

  function submit(event: FormEvent): void {
    event.preventDefault();

    const found = validateLessonForm(form);

    if (Object.keys(found).length > 0) {
      setSubmission({ errors: found, serverError: null, attempted: true });

      return;
    }

    setSubmission({ errors: {}, serverError: null, attempted: true });
    request.mutate(parseLessonRequest(form), {
      onSuccess: afterRequest,
      onError: (error: ApiError) =>
        setSubmission({
          errors: {},
          serverError: error.message,
          attempted: true,
        }),
    });
  }

  return {
    form,
    errors,
    serverError: submission.serverError,
    levels: courses.data?.flatMap((course) => course.levels) ?? [],
    units: units.data ?? [],
    isLoadingUnits: units.isFetching,
    lessons: lessons.data ?? [],
    characters: characters.data ?? [],
    unitCast: unit?.cast.map((entry) => entry.character.id) ?? [],
    estimate,
    isSubmitting: request.isPending,
    changeLevel,
    changeUnit,
    setMode: (mode: LessonDraftForm['mode']) => patch({ mode, lessonId: '' }),
    setLesson: (lessonId: string) => patch({ lessonId }),
    setTitle: (title: string) =>
      setForm((current) => withTitle(current, title)),
    setSlug: (slug: string) => patch({ slug, slugEdited: true }),
    setOrder: (order: string) => {
      setOrderEdited(true);
      patch({ order });
    },
    setObjective: (objective: string) => patch({ objective }),
    setSkills: (targetSkillIds: string[]) => patch({ targetSkillIds }),
    setContext: (unitContext: string) => patch({ unitContext }),
    toggleCharacter,
    submit,
  };
}

// ---------------------------------------------------------------------------
// Questões
// ---------------------------------------------------------------------------

export function useItemsDraftForm() {
  const [form, setForm] = useState<ItemsDraftForm>(EMPTY_ITEMS_FORM);
  const [submission, setSubmission] = useState<Submission>(CLEAN);
  const afterRequest = useAfterRequest();
  const request = useRequestItemsDraft();
  const estimate = useDraftEstimate(
    'ITEMS',
    countOf(form.count, DRAFT_LIMITS.itemCount.max),
  );

  const errors = submission.attempted ? validateItemsForm(form) : {};

  function submit(event: FormEvent): void {
    event.preventDefault();

    const found = validateItemsForm(form);

    if (Object.keys(found).length > 0) {
      setSubmission({ errors: found, serverError: null, attempted: true });

      return;
    }

    setSubmission({ errors: {}, serverError: null, attempted: true });
    request.mutate(parseItemsRequest(form), {
      onSuccess: afterRequest,
      onError: (error: ApiError) =>
        setSubmission({
          errors: {},
          serverError: error.message,
          attempted: true,
        }),
    });
  }

  return {
    form,
    errors,
    serverError: submission.serverError,
    estimate,
    isSubmitting: request.isPending,
    setSkill: (skillId: string | null) =>
      setForm((current) => ({ ...current, skillId: skillId ?? '' })),
    setLevel: (level: CefrLevel | '') =>
      setForm((current) => ({ ...current, level })),
    setCount: (count: string) => setForm((current) => ({ ...current, count })),
    toggleType: (type: ItemsDraftForm['types'][number]) =>
      setForm((current) => ({
        ...current,
        types: current.types.includes(type)
          ? current.types.filter((entry) => entry !== type)
          : [...current.types, type],
      })),
    submit,
  };
}

// ---------------------------------------------------------------------------
// Notas de registro
// ---------------------------------------------------------------------------

export function useNotesDraftForm() {
  const [form, setForm] = useState<NotesDraftForm>(EMPTY_NOTES_FORM);
  const [submission, setSubmission] = useState<Submission>(CLEAN);
  const afterRequest = useAfterRequest();
  const request = useRequestRegisterNotesDraft();
  const estimate = useDraftEstimate(
    'REGISTER_NOTES',
    countOf(form.count, DRAFT_LIMITS.noteCount.max),
  );

  const errors = submission.attempted ? validateNotesForm(form) : {};

  function submit(event: FormEvent): void {
    event.preventDefault();

    const found = validateNotesForm(form);

    if (Object.keys(found).length > 0) {
      setSubmission({ errors: found, serverError: null, attempted: true });

      return;
    }

    setSubmission({ errors: {}, serverError: null, attempted: true });
    request.mutate(parseNotesRequest(form), {
      onSuccess: afterRequest,
      onError: (error: ApiError) =>
        setSubmission({
          errors: {},
          serverError: error.message,
          attempted: true,
        }),
    });
  }

  return {
    form,
    errors,
    serverError: submission.serverError,
    estimate,
    isSubmitting: request.isPending,
    setLevel: (level: CefrLevel | '') =>
      setForm((current) => ({ ...current, level })),
    setCount: (count: string) => setForm((current) => ({ ...current, count })),
    submit,
  };
}

export { KIND_OF_TAB };
