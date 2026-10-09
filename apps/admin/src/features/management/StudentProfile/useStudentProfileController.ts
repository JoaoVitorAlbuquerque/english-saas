import {
  useAdminStudent,
  useAdminStudentAiUsage,
  useAdminStudentCreditHistory,
  useAdminStudentCredits,
  useAdminStudentHistory,
  useAdminStudentPlan,
  useAdminStudentProgress,
  useAdminStudentSubscription,
} from '@english-saas/api-client';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { toSection } from '../components/section-data';

/** Semanas do painel de progresso que a ficha mostra. */
const PROGRESS_WEEKS = 8;

/**
 * A ficha do aluno. A conta carrega primeiro; cada parte (nível, plano,
 * histórico, assinatura, créditos, uso de IA) é uma leitura própria, então a
 * que falha mostra o erro no lugar dela e as outras seguem.
 */
export function useStudentProfileController() {
  const { userId = '' } = useParams<{ userId: string }>();
  const [granting, setGranting] = useState(false);

  const overview = useAdminStudent(userId);
  const progress = useAdminStudentProgress(userId, PROGRESS_WEEKS);
  const plan = useAdminStudentPlan(userId);
  const history = useAdminStudentHistory(userId);
  const subscription = useAdminStudentSubscription(userId);
  const credits = useAdminStudentCredits(userId);
  const creditHistory = useAdminStudentCreditHistory(userId);
  const usage = useAdminStudentAiUsage(userId);

  const historyRows = useMemo(
    () => history.data?.pages.flatMap((page) => page.data) ?? [],
    [history.data],
  );
  const ledgerRows = useMemo(
    () => creditHistory.data?.pages.flatMap((page) => page.data) ?? [],
    [creditHistory.data],
  );

  return {
    userId,
    overview: toSection(overview),
    progress: toSection(progress),
    plan: toSection(plan),
    history: {
      ...toSection(history),
      rows: historyRows,
      hasMore: history.hasNextPage,
      isLoadingMore: history.isFetchingNextPage,
      loadMore: () => void history.fetchNextPage(),
    },
    subscription: toSection(subscription),
    credits: toSection(credits),
    ledger: {
      ...toSection(creditHistory),
      rows: ledgerRows,
      hasMore: creditHistory.hasNextPage,
      isLoadingMore: creditHistory.isFetchingNextPage,
      loadMore: () => void creditHistory.fetchNextPage(),
    },
    usage: toSection(usage),
    granting,
    openGrant: () => setGranting(true),
    closeGrant: () => setGranting(false),
  };
}

export type StudentProfileView = ReturnType<typeof useStudentProfileController>;
