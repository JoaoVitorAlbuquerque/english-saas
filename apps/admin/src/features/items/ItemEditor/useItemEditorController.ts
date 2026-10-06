import {
  type AdminItemDetail,
  type ApiError,
  useAdminItem,
  useCreateItem,
  useCreateItemRevision,
  useUpdateItem,
} from '@english-saas/api-client';
import type { ItemType } from '@english-saas/shared';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { isEditableStatus } from '../../curriculum/lib/editorial';
import { focusField } from '../../curriculum/lib/focus-field';
import type { FieldIssue } from '../../curriculum/lib/validation';
import {
  blankItemState,
  itemToState,
  snapshotOf,
  toCreateRequest,
  toPatch,
  type ItemFormState,
} from '../lib/item-form';
import {
  describeItemError,
  issuesOfProblem,
  type ItemProblem,
} from '../lib/item-editorial';
import {
  hasTypedContent,
  itemReducer,
  type ItemAction,
} from '../lib/item-reducer';
import { validateItemForm } from '../lib/item-validation';

/** O que ainda se corrige num item publicado ou arquivado. */
const EDITABLE_AFTER_PUBLISH = new Set([
  'explanation',
  'errorPatternMap',
  'cefrLevel',
  'difficulty',
  'discrimination',
  'skillIds',
]);

const PANEL_ID = 'item-editor-panel';

type PatchOf = Extract<ItemAction, { type: 'patch' }>['patch'];

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * O editor de item: formulário em memória, validação ao vivo com o código do
 * servidor e **salvar explícito** — `POST/PATCH items` valida tudo-ou-nada,
 * então um salvamento automático gravaria só rascunhos que já passam (o item
 * pela metade nunca chegaria ao servidor, e o editor perderia o trabalho).
 */
export function useItemEditorController(itemId: string | null) {
  const navigate = useNavigate();
  const query = useAdminItem(itemId);
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const createRevision = useCreateItemRevision();

  const [state, dispatch] = useReducer(itemReducer, undefined, () =>
    blankItemState(),
  );
  // O item como o servidor o tem (status, estatística, revisão) e o
  // formulário correspondente — a base para saber o que mudou.
  const [item, setItem] = useState<AdminItemDetail | null>(null);
  const [saved, setSaved] = useState<ItemFormState>(() => blankItemState());
  const [attempted, setAttempted] = useState(false);
  const [problem, setProblem] = useState<ItemProblem | null>(null);
  const [pendingType, setPendingType] = useState<ItemType | null>(null);
  const [returnedToDraft, setReturnedToDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isNew = itemId === null;
  const stateRef = useRef(state);

  stateRef.current = state;

  /** O item que veio do servidor vira o formulário. */
  const adopt = useCallback((next: AdminItemDetail, keepEdits: boolean) => {
    const form = itemToState(next);

    setItem(next);
    setSaved(form);

    if (!keepEdits) {
      dispatch({ type: 'reset', state: form });
    }
  }, []);

  // Carrega uma vez: depois disso o formulário é do editor.
  useEffect(() => {
    if (query.data !== undefined && item === null) {
      adopt(query.data, false);
    }
  }, [query.data, item, adopt]);

  const status = item?.status ?? 'DRAFT';
  const frozen = item !== null && !isEditableStatus(status);
  const dirty = snapshotOf(state) !== snapshotOf(saved);

  // O que vale conferir: num item publicado, só o que ainda se edita.
  const live = useMemo(() => {
    const all = validateItemForm(state);

    return frozen
      ? all.filter((issue) =>
          EDITABLE_AFTER_PUBLISH.has(issue.path.split('.')[0] ?? ''),
        )
      : all;
  }, [state, frozen]);
  const issues: FieldIssue[] = [...live, ...issuesOfProblem(problem)];
  // O item novo não abre pintado de vermelho: os erros aparecem depois da
  // primeira tentativa de salvar.
  const visibleIssues = isNew && !attempted ? [] : issues;

  // Aviso do navegador ao sair com alteração não salva.
  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function jumpTo(path: string): void {
    const panel = document.getElementById(PANEL_ID);

    if (panel !== null) {
      focusField(panel, path);
    }
  }

  const save = useCallback(async (): Promise<boolean> => {
    setProblem(null);
    setAttempted(true);

    if (live.length > 0) {
      const first = live[0];

      if (first !== undefined) {
        // Espera o React pintar os erros antes de levar o foco ao campo.
        window.setTimeout(() => {
          const panel = document.getElementById(PANEL_ID);

          if (panel !== null) {
            focusField(panel, first.path);
          }
        }, 0);
      }

      return false;
    }

    const startedWith = snapshotOf(stateRef.current);

    try {
      if (item === null) {
        const created = await createItem.mutateAsync(
          toCreateRequest(stateRef.current),
        );

        setSavedAt(timeLabel(new Date()));
        adopt(created, false);
        navigate(`/conteudo/questoes/${created.id}`, { replace: true });

        return true;
      }

      const patch = toPatch(stateRef.current, saved, frozen);

      if (Object.keys(patch).length === 0) {
        return true;
      }

      const updated = await updateItem.mutateAsync({
        id: item.id,
        input: patch,
      });

      // Editar item em revisão ou aprovado o devolve a rascunho.
      if (
        updated.status === 'DRAFT' &&
        (item.status === 'IN_REVIEW' || item.status === 'APPROVED')
      ) {
        setReturnedToDraft(true);
      }

      setSavedAt(timeLabel(new Date()));
      // Se o editor digitou durante o salvamento, o que ele digitou fica.
      adopt(updated, snapshotOf(stateRef.current) !== startedWith);

      return true;
    } catch (error) {
      setProblem(describeItemError(error as ApiError));

      return false;
    }
  }, [live, item, saved, frozen, createItem, updateItem, adopt, navigate]);

  function requestType(next: ItemType): void {
    if (next === state.type) {
      return;
    }

    if (hasTypedContent(state)) {
      setPendingType(next);
    } else {
      dispatch({ type: 'setType', itemType: next });
    }
  }

  function makeRevision(): void {
    if (item === null) {
      return;
    }

    setProblem(null);
    createRevision.mutate(
      { id: item.id },
      {
        onSuccess: (revision) => navigate(`/conteudo/questoes/${revision.id}`),
        onError: (error: ApiError) => setProblem(describeItemError(error)),
      },
    );
  }

  const audioAssetId = state.content.audioAssetId;
  // O áudio já gerado só vale enquanto o texto não mudou (o reducer solta o
  // `audioAssetId` quando muda).
  const audioUrl =
    typeof audioAssetId === 'string' &&
    audioAssetId === saved.content.audioAssetId
      ? (item?.audioUrl ?? null)
      : null;

  return {
    isNew,
    isLoading: itemId !== null && item === null && query.isPending,
    loadError: itemId !== null && item === null ? query.error : null,
    retry: () => void query.refetch(),
    state,
    item,
    status,
    frozen,
    dirty,
    issues: visibleIssues,
    issueCount: isNew && !attempted ? 0 : issues.length,
    problem,
    dismissProblem: () => setProblem(null),
    returnedToDraft,
    dismissReturnedToDraft: () => setReturnedToDraft(false),
    audioUrl,
    isSaving: createItem.isPending || updateItem.isPending,
    savedAt,
    save,
    jumpTo,
    patch: (patch: PatchOf) => dispatch({ type: 'patch', patch }),
    setContent: (content: ItemFormState['content']) =>
      dispatch({ type: 'content', content }),
    setAccepted: (acceptedAnswers: string[]) =>
      dispatch({ type: 'patch', patch: { acceptedAnswers } }),
    addMapRow: () => dispatch({ type: 'map/add' }),
    setMapRow: (key: string, patch: { wrong?: string; patternId?: string }) =>
      dispatch({ type: 'map/set', key, patch }),
    removeMapRow: (key: string) => dispatch({ type: 'map/remove', key }),
    requestType,
    pendingType,
    confirmType: () => {
      if (pendingType !== null) {
        dispatch({ type: 'setType', itemType: pendingType });
        setPendingType(null);
      }
    },
    cancelType: () => setPendingType(null),
    isCreatingRevision: createRevision.isPending,
    makeRevision,
    /** Depois de uma ação editorial, o servidor manda o item atualizado. */
    onTransitioned: (next: AdminItemDetail) => {
      setReturnedToDraft(false);
      adopt(next, true);
    },
    panelId: PANEL_ID,
  };
}
