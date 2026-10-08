import {
  type AdminVersion,
  type ApiError,
  useAdminCharacters,
  useCreateVersion,
  useSaveDraftSteps,
  useSaveVersionMeta,
} from '@english-saas/api-client';
import {
  lessonVersionMetaSchema,
  type ContentStatus,
  type LessonStepType,
} from '@english-saas/shared';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { isEditableStatus } from '../lib/editorial';
import {
  editorReducer,
  metaSnapshot,
  stepsSnapshot,
  toEditorState,
  toStepPayload,
  type EditorMeta,
  type EditorState,
} from '../lib/editor-reducer';
import { focusField } from '../lib/focus-field';
import { useAutosave } from '../lib/useAutosave';
import { validateEditor } from '../lib/validation';
import { META_TAB } from './StepList';

let keySeed = 0;

/** Chave local da etapa: dura enquanto o editor está aberto. */
function nextKey(): string {
  keySeed += 1;

  return `step-${String(keySeed)}`;
}

const META_FIELDS = [
  'title',
  'objective',
  'cefrLevel',
  'estimatedMinutes',
  'targetSkillIds',
] as const satisfies readonly (keyof EditorMeta)[];

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function snapshotOf(state: EditorState): string {
  return `${metaSnapshot(state.meta)}|${stepsSnapshot(state.steps)}`;
}

/**
 * Estado e ações do editor de uma versão. O conteúdo vive aqui, em memória,
 * e vai para o servidor pelo salvamento automático (`useAutosave`); a
 * validação roda a cada mudança, com os schemas do `packages/shared`.
 */
export function useVersionEditorController(version: AdminVersion) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(editorReducer, version, (initial) =>
    toEditorState(initial, nextKey),
  );
  const characters = useAdminCharacters();
  const saveMeta = useSaveVersionMeta();
  const saveSteps = useSaveDraftSteps();
  const createVersion = useCreateVersion();

  const [status, setStatus] = useState<ContentStatus>(version.status);
  const [returnedToDraft, setReturnedToDraft] = useState(false);
  const [unsavedFields, setUnsavedFields] = useState<string[]>([]);
  const [active, setActive] = useState<string>(
    () => state.steps[0]?.key ?? META_TAB,
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [focusTarget, setFocusTarget] = useState<{
    path: string;
    nonce: number;
  } | null>(null);
  const [newVersionError, setNewVersionError] = useState<string | null>(null);

  const stateRef = useRef(state);
  const statusRef = useRef<ContentStatus>(version.status);
  const initialSnapshot = useRef(snapshotOf(state)).current;
  const saved = useRef({
    meta: state.meta,
    steps: stepsSnapshot(state.steps),
  });

  stateRef.current = state;

  const readOnly = !isEditableStatus(status);
  const validation = useMemo(() => validateEditor(state), [state]);

  /** O servidor devolve o status: editar versão em revisão a manda de volta a rascunho. */
  const applyServerStatus = useCallback((next: ContentStatus): void => {
    if (statusRef.current === next) {
      return;
    }

    if (statusRef.current !== 'DRAFT' && next === 'DRAFT') {
      setReturnedToDraft(true);
    }

    statusRef.current = next;
    setStatus(next);
  }, []);

  const { mutateAsync: mutateMeta } = saveMeta;
  const { mutateAsync: mutateSteps } = saveSteps;

  const save = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    const patch: Partial<EditorMeta> = {};
    const invalid: string[] = [];

    for (const field of META_FIELDS) {
      if (!sameValue(current.meta[field], saved.current.meta[field])) {
        // Só vai o campo que passa no limite da API; o resto fica marcado.
        const parsed = lessonVersionMetaSchema.shape[field].safeParse(
          current.meta[field],
        );

        if (parsed.success) {
          Object.assign(patch, { [field]: parsed.data });
        } else {
          invalid.push(field);
        }
      }
    }

    setUnsavedFields(invalid);

    if (Object.keys(patch).length > 0) {
      const result = await mutateMeta({ id: version.id, input: patch });

      saved.current.meta = { ...saved.current.meta, ...patch };
      applyServerStatus(result.status);
    }

    const steps = stepsSnapshot(current.steps);

    if (steps !== saved.current.steps) {
      const result = await mutateSteps({
        id: version.id,
        input: { steps: toStepPayload(current.steps) },
      });

      saved.current.steps = steps;
      applyServerStatus(result.status);
    }
  }, [applyServerStatus, mutateMeta, mutateSteps, version.id]);

  const autosave = useAutosave({
    snapshot: snapshotOf(state),
    initialSnapshot,
    enabled: !readOnly,
    save,
  });

  // Depois de trocar de aba por causa de um erro, leva o foco ao campo.
  useEffect(() => {
    if (focusTarget === null) {
      return;
    }

    const panel = document.getElementById('editor-panel');

    if (panel !== null) {
      focusField(panel, focusTarget.path);
    }
  }, [focusTarget, active]);

  function patchMeta(patch: Partial<EditorMeta>): void {
    dispatch({ type: 'meta/patch', patch });
  }

  function addStep(stepType: LessonStepType): void {
    const key = nextKey();

    dispatch({ type: 'step/add', stepType, key });
    setActive(key);
  }

  function moveStep(key: string, delta: -1 | 1): void {
    dispatch({ type: 'step/move', key, delta });
  }

  function confirmRemove(): void {
    if (removing === null) {
      return;
    }

    const index = state.steps.findIndex((step) => step.key === removing);
    const neighbor = state.steps[index + 1] ?? state.steps[index - 1];

    dispatch({ type: 'step/remove', key: removing });

    if (active === removing) {
      setActive(neighbor?.key ?? META_TAB);
    }

    setRemoving(null);
  }

  /** Do erro (etapa, caminho) até o campo: abre a etapa e foca. */
  function jumpToIssue(order: number, path: string): void {
    const step = state.steps[order];

    if (step !== undefined) {
      setActive(step.key);
      setFocusTarget((current) => ({
        path,
        nonce: (current?.nonce ?? 0) + 1,
      }));
    }
  }

  /** Do aviso da revisão até um campo dos metadados (nível, skills-alvo). */
  function jumpToMeta(field: string | null): void {
    setActive(META_TAB);
    setFocusTarget((current) => ({
      path: field === null ? 'meta' : `meta.${field}`,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }

  function createNextVersion(): void {
    setNewVersionError(null);
    createVersion.mutate(version.lesson.id, {
      onSuccess: (created) => navigate(`/conteudo/versoes/${created.id}`),
      onError: (error: ApiError) =>
        setNewVersionError(error.message || t('editor.readOnly.error')),
    });
  }

  const removingStep = state.steps.find((step) => step.key === removing);

  return {
    version,
    state,
    status,
    readOnly,
    validation,
    characters: characters.data ?? [],
    returnedToDraft,
    unsavedFields,
    active,
    setActive,
    previewOpen,
    togglePreview: () => setPreviewOpen((open) => !open),
    autosave,
    patchMeta,
    addStep,
    moveStep,
    updateContent: (key: string, content: Record<string, unknown>) =>
      dispatch({ type: 'step/content', key, content }),
    requestRemove: setRemoving,
    cancelRemove: () => setRemoving(null),
    confirmRemove,
    removingStep: removingStep
      ? {
          position: state.steps.indexOf(removingStep) + 1,
          type: removingStep.type,
        }
      : null,
    jumpToIssue,
    jumpToMeta,
    showPanel: () => setPreviewOpen(true),
    onTransitioned: (next: AdminVersion) => {
      statusRef.current = next.status;
      setStatus(next.status);
      setReturnedToDraft(false);
    },
    createNextVersion,
    isCreatingVersion: createVersion.isPending,
    newVersionError,
  };
}
