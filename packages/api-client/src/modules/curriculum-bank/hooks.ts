import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import type { SkillType } from '@english-saas/shared';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as service from './service';
import type {
  AdminErrorPattern,
  AdminErrorPatternPage,
  AdminItemDetail,
  AdminItemPage,
  AdminRegisterNote,
  AdminRegisterNotePage,
  AdminSkill,
  AdminSkillPage,
  CreateErrorPatternRequest,
  CreateItemRequest,
  CreateRegisterNoteRequest,
  CreateSkillRequest,
  FlaggedItemPage,
  ItemAction,
  ItemStats,
  UpdateErrorPatternRequest,
  UpdateItemRequest,
  UpdateRegisterNoteRequest,
  UpdateSkillRequest,
} from './schemas';

/**
 * Hooks da taxonomia e do banco de questões.
 *
 * As listas são paginadas por cursor ("Carregar mais"). Uma escrita refaz
 * todas elas **e** os seletores do editor de lição (skills, notas, erros),
 * que guardam a resposta por 60 s — sem isso a skill recém-criada não
 * apareceria no picker.
 */

const PAGE_SIZE = 30;

/** Refaz tudo do painel, menos a versão aberta e o preview. */
function invalidateBank(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'admin' &&
      query.queryKey[1] !== 'version' &&
      query.queryKey[1] !== 'preview' &&
      // A ficha do item é atualizada pela própria resposta da escrita.
      query.queryKey[1] !== 'item',
  });
}

// --- Seletores do editor (só o que está em circulação) ---

/**
 * Busca de skill por texto; `q` vazio lista as primeiras. `type` limita ao
 * tipo (a skill de uma nota de registro precisa ser REGISTER).
 */
export function useSkillSearch(q: string, enabled = true, type?: SkillType) {
  return useQuery<AdminSkillPage, ApiError>({
    queryKey: queryKeys.adminSkills(q, type),
    queryFn: () =>
      service.listSkills({
        q,
        limit: 30,
        ...(type === undefined ? {} : { type }),
      }),
    enabled,
    staleTime: 60_000,
  });
}

export function useRegisterNotes() {
  return useQuery<AdminRegisterNotePage, ApiError>({
    queryKey: queryKeys.adminRegisterNotes,
    queryFn: () => service.listRegisterNotes({ limit: 100 }),
    staleTime: 60_000,
  });
}

export function useErrorPatterns() {
  return useQuery<AdminErrorPatternPage, ApiError>({
    queryKey: queryKeys.adminErrorPatterns,
    queryFn: () => service.listErrorPatterns({ limit: 100 }),
    staleTime: 60_000,
  });
}

// --- Skills ---

export function useSkillList(filter: service.SkillFilter, enabled = true) {
  return useInfiniteQuery<AdminSkillPage, ApiError>({
    queryKey: queryKeys.adminSkillList(filter),
    queryFn: ({ pageParam }) =>
      service.listSkills({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation<AdminSkill, ApiError, CreateSkillRequest>({
    mutationFn: (input) => service.createSkill(input),
    onSuccess: () => invalidateBank(queryClient),
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminSkill,
    ApiError,
    { id: string; input: UpdateSkillRequest }
  >({
    mutationFn: ({ id, input }) => service.updateSkill(id, input),
    onSuccess: () => invalidateBank(queryClient),
  });
}

export function useDeprecateSkill() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminSkill,
    ApiError,
    { id: string; replacedById?: string | null }
  >({
    mutationFn: ({ id, replacedById }) =>
      service.deprecateSkill(id, replacedById),
    onSuccess: () => invalidateBank(queryClient),
  });
}

// --- Erros típicos ---

export function useErrorPatternList(
  filter: service.ErrorPatternFilter,
  enabled = true,
) {
  return useInfiniteQuery<AdminErrorPatternPage, ApiError>({
    queryKey: queryKeys.adminErrorPatternList(filter),
    queryFn: ({ pageParam }) =>
      service.listErrorPatterns({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useCreateErrorPattern() {
  const queryClient = useQueryClient();

  return useMutation<AdminErrorPattern, ApiError, CreateErrorPatternRequest>({
    mutationFn: (input) => service.createErrorPattern(input),
    onSuccess: () => invalidateBank(queryClient),
  });
}

export function useUpdateErrorPattern() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminErrorPattern,
    ApiError,
    { id: string; input: UpdateErrorPatternRequest }
  >({
    mutationFn: ({ id, input }) => service.updateErrorPattern(id, input),
    onSuccess: () => invalidateBank(queryClient),
  });
}

export function useDeprecateErrorPattern() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminErrorPattern,
    ApiError,
    { id: string; replacedById?: string | null }
  >({
    mutationFn: ({ id, replacedById }) =>
      service.deprecateErrorPattern(id, replacedById),
    onSuccess: () => invalidateBank(queryClient),
  });
}

// --- Notas de registro ---

export function useRegisterNoteList(
  filter: service.RegisterNoteFilter,
  enabled = true,
) {
  return useInfiniteQuery<AdminRegisterNotePage, ApiError>({
    queryKey: queryKeys.adminRegisterNoteList(filter),
    queryFn: ({ pageParam }) =>
      service.listRegisterNotes({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useCreateRegisterNote() {
  const queryClient = useQueryClient();

  return useMutation<AdminRegisterNote, ApiError, CreateRegisterNoteRequest>({
    mutationFn: (input) => service.createRegisterNote(input),
    onSuccess: () => invalidateBank(queryClient),
  });
}

export function useUpdateRegisterNote() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminRegisterNote,
    ApiError,
    { id: string; input: UpdateRegisterNoteRequest }
  >({
    mutationFn: ({ id, input }) => service.updateRegisterNote(id, input),
    onSuccess: () => invalidateBank(queryClient),
  });
}

export function useDeprecateRegisterNote() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminRegisterNote,
    ApiError,
    { id: string; replacedById?: string | null }
  >({
    mutationFn: ({ id, replacedById }) =>
      service.deprecateRegisterNote(id, replacedById),
    onSuccess: () => invalidateBank(queryClient),
  });
}

// --- Banco de questões ---

export function useAdminItemList(
  filter: service.AdminItemFilter,
  enabled = true,
) {
  return useInfiniteQuery<AdminItemPage, ApiError>({
    queryKey: queryKeys.adminItemList(filter),
    queryFn: ({ pageParam }) =>
      service.listItems({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

/**
 * A ficha do item. Como no editor de lição, não se refaz sozinha: o editor
 * guarda o próprio estado, e um refetch no meio da digitação o sobrescreveria.
 */
export function useAdminItem(id: string | null) {
  return useQuery<AdminItemDetail, ApiError>({
    queryKey: queryKeys.adminItem(id ?? ''),
    queryFn: () => service.getItem(id ?? ''),
    enabled: id !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Guarda a resposta de uma escrita como a ficha do item. */
function rememberItem(queryClient: QueryClient, item: AdminItemDetail): void {
  queryClient.setQueryData(queryKeys.adminItem(item.id), item);
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation<AdminItemDetail, ApiError, CreateItemRequest>({
    mutationFn: (input) => service.createItem(input),
    onSuccess: (item) => {
      rememberItem(queryClient, item);
      // As listas se refazem em segundo plano: o editor não espera por elas
      // para seguir (a resposta da escrita já é a ficha atual do item).
      void invalidateBank(queryClient);
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminItemDetail,
    ApiError,
    { id: string; input: UpdateItemRequest }
  >({
    mutationFn: ({ id, input }) => service.updateItem(id, input),
    onSuccess: (item) => {
      rememberItem(queryClient, item);
      // As listas se refazem em segundo plano: o editor não espera por elas
      // para seguir (a resposta da escrita já é a ficha atual do item).
      void invalidateBank(queryClient);
    },
  });
}

/** A próxima versão de um item publicado. Devolve o rascunho novo. */
export function useCreateItemRevision() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminItemDetail,
    ApiError,
    { id: string; input?: UpdateItemRequest }
  >({
    mutationFn: ({ id, input }) => service.createItemRevision(id, input),
    onSuccess: (revision) => {
      rememberItem(queryClient, revision);
      // O original passou a apontar para a revisão (`replacedById`): a ficha
      // dele (em cache) se refaz na próxima vez que alguém a abrir.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'item'] });
      void invalidateBank(queryClient);
    },
  });
}

export function useTransitionItem() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminItemDetail,
    ApiError,
    { id: string; action: ItemAction }
  >({
    mutationFn: ({ id, action }) => service.transitionItem(id, action),
    onSuccess: (item) => {
      rememberItem(queryClient, item);
      // As listas se refazem em segundo plano: o editor não espera por elas
      // para seguir (a resposta da escrita já é a ficha atual do item).
      void invalidateBank(queryClient);
    },
  });
}

// --- Itens problemáticos e estatísticas (módulo 8) ---

export function useFlaggedItems(
  filter: service.FlaggedItemFilter,
  enabled = true,
) {
  return useInfiniteQuery<FlaggedItemPage, ApiError>({
    queryKey: queryKeys.adminFlaggedItems(filter),
    queryFn: ({ pageParam }) =>
      service.listFlaggedItems({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useItemStats(id: string | null) {
  return useQuery<ItemStats, ApiError>({
    queryKey: queryKeys.adminItemStats(id ?? ''),
    queryFn: () => service.getItemStats(id ?? ''),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useResolveFlaggedItem() {
  const queryClient = useQueryClient();

  return useMutation<{ resolved: number }, ApiError, string>({
    mutationFn: (itemId) => service.resolveFlaggedItem(itemId),
    onSuccess: () => invalidateBank(queryClient),
  });
}
