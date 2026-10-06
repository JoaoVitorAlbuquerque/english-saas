import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as service from './service';
import type {
  AdminCharacter,
  AdminCourse,
  AdminLesson,
  AdminLessonSummary,
  AdminUnit,
  AdminVersion,
  CreateCharacterRequest,
  CreateLessonRequest,
  CreateUnitRequest,
  DraftSaveResult,
  LessonPreview,
  SaveDraftStepsRequest,
  SaveVersionMetaRequest,
  UnitAction,
  UpdateCharacterRequest,
  UpdateUnitRequest,
  UploadedImage,
  VersionAction,
} from './schemas';

/**
 * Hooks do painel de conteúdo. O editor guarda o próprio estado local:
 * por isso as queries da versão não se refazem sozinhas (`staleTime`
 * infinito) — um refetch no meio da digitação sobrescreveria o texto.
 */

// --- Estrutura ---

export function useCourses() {
  return useQuery<AdminCourse[], ApiError>({
    queryKey: queryKeys.adminCourses,
    queryFn: () => service.listCourses(),
  });
}

export function useAdminUnits(levelId?: string) {
  return useQuery<AdminUnit[], ApiError>({
    queryKey: queryKeys.adminUnits(levelId),
    queryFn: () => service.listUnits(levelId),
  });
}

export function useAdminLessons(unitId?: string) {
  return useQuery<AdminLessonSummary[], ApiError>({
    queryKey: queryKeys.adminLessons(unitId),
    queryFn: () => service.listLessons(unitId),
  });
}

export function useAdminLesson(id: string) {
  return useQuery<AdminLesson, ApiError>({
    queryKey: queryKeys.adminLesson(id),
    queryFn: () => service.getLesson(id),
  });
}

function invalidateStructure(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ['admin'] });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation<AdminUnit, ApiError, CreateUnitRequest>({
    mutationFn: (input) => service.createUnit(input),
    onSuccess: () => invalidateStructure(queryClient),
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminUnit,
    ApiError,
    { id: string; input: UpdateUnitRequest }
  >({
    mutationFn: ({ id, input }) => service.updateUnit(id, input),
    onSuccess: () => invalidateStructure(queryClient),
  });
}

export function useTransitionUnit() {
  const queryClient = useQueryClient();

  return useMutation<AdminUnit, ApiError, { id: string; action: UnitAction }>({
    mutationFn: ({ id, action }) => service.transitionUnit(id, action),
    onSuccess: () => invalidateStructure(queryClient),
  });
}

/**
 * Reordena, dentro da lista, o grupo de linhas cujo id está em `ids`: elas
 * ocupam as mesmas posições, só que na ordem pedida. O que não é do grupo
 * (outros níveis, outras unidades) fica onde estava.
 */
function reorderGroup<T extends { id: string }>(
  rows: T[],
  ids: readonly string[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.flatMap((id) => {
    const row = byId.get(id);

    return row === undefined ? [] : [row];
  });
  const slots = rows.flatMap((row, index) =>
    byId.has(row.id) && ids.includes(row.id) ? [index] : [],
  );

  if (ordered.length !== slots.length) {
    return rows;
  }

  const next = [...rows];

  slots.forEach((slot, position) => {
    next[slot] = ordered[position] as T;
  });

  return next;
}

/**
 * Reordena as unidades de um nível. Atualiza a tela na hora (otimista) e
 * volta ao que era se a API recusar — a lista não pode ficar mentindo.
 */
export function useReorderUnits() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminUnit[],
    ApiError,
    { levelId: string; ids: string[] },
    { previous: [readonly unknown[], AdminUnit[] | undefined][] }
  >({
    mutationFn: ({ levelId, ids }) => service.reorderUnits(levelId, ids),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'units'] });
      const previous = queryClient.getQueriesData<AdminUnit[]>({
        queryKey: ['admin', 'units'],
      });

      queryClient.setQueriesData<AdminUnit[]>(
        { queryKey: ['admin', 'units'] },
        (rows) => (rows === undefined ? rows : reorderGroup(rows, ids)),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => invalidateStructure(queryClient),
  });
}

export function useReorderLessons() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminLessonSummary[],
    ApiError,
    { unitId: string; ids: string[] },
    { previous: [readonly unknown[], AdminLessonSummary[] | undefined][] }
  >({
    mutationFn: ({ unitId, ids }) => service.reorderLessons(unitId, ids),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'lessons'] });
      const previous = queryClient.getQueriesData<AdminLessonSummary[]>({
        queryKey: ['admin', 'lessons'],
      });

      queryClient.setQueriesData<AdminLessonSummary[]>(
        { queryKey: ['admin', 'lessons'] },
        (rows) => (rows === undefined ? rows : reorderGroup(rows, ids)),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => invalidateStructure(queryClient),
  });
}

export function useCreateLesson() {
  const queryClient = useQueryClient();

  return useMutation<AdminLesson, ApiError, CreateLessonRequest>({
    mutationFn: (input) => service.createLesson(input),
    onSuccess: () => invalidateStructure(queryClient),
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation<AdminVersion, ApiError, string>({
    mutationFn: (lessonId) => service.createVersion(lessonId),
    onSuccess: () => invalidateStructure(queryClient),
  });
}

// --- Versão ---

export function useAdminVersion(id: string) {
  return useQuery<AdminVersion, ApiError>({
    queryKey: queryKeys.adminVersion(id),
    queryFn: () => service.getVersion(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveVersionMeta() {
  return useMutation<
    AdminVersion,
    ApiError,
    { id: string; input: SaveVersionMetaRequest }
  >({
    mutationFn: ({ id, input }) => service.saveVersionMeta(id, input),
  });
}

export function useSaveDraftSteps() {
  return useMutation<
    DraftSaveResult,
    ApiError,
    { id: string; input: SaveDraftStepsRequest }
  >({
    mutationFn: ({ id, input }) => service.saveDraftSteps(id, input),
  });
}

/**
 * Enviar, aprovar, devolver, publicar e arquivar. Devolve a versão nova;
 * a lista de lições e a árvore se refazem, porque o status aparece nelas.
 */
export function useTransitionVersion() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminVersion,
    ApiError,
    { id: string; action: VersionAction }
  >({
    mutationFn: ({ id, action }) => service.transitionVersion(id, action),
    onSuccess: (version) => {
      queryClient.setQueryData(queryKeys.adminVersion(version.id), version);

      return queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'admin' &&
          query.queryKey[1] !== 'version' &&
          query.queryKey[1] !== 'preview',
      });
    },
  });
}

/** O preview lê do servidor (áudio assinado, itens sem gabarito) a cada pedido. */
export function useVersionPreview(id: string, enabled = true) {
  return useQuery<LessonPreview, ApiError>({
    queryKey: queryKeys.adminPreview(id),
    queryFn: () => service.getPreview(id),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

// --- Personagem e mídia ---

export function useAdminCharacters() {
  return useQuery<AdminCharacter[], ApiError>({
    queryKey: queryKeys.adminCharacters,
    queryFn: () => service.listCharacters(),
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation<AdminCharacter, ApiError, CreateCharacterRequest>({
    mutationFn: (input) => service.createCharacter(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCharacters }),
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminCharacter,
    ApiError,
    { id: string; input: UpdateCharacterRequest }
  >({
    mutationFn: ({ id, input }) => service.updateCharacter(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCharacters }),
  });
}

export function useUploadImage() {
  return useMutation<UploadedImage, ApiError, File>({
    mutationFn: (file) => service.uploadImage(file),
  });
}
