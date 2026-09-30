import {
  useCancelSubscription,
  useCredits,
  useCreditsHistory,
  useSubscription,
} from '@english-saas/api-client';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function useSubscriptionController() {
  const subscription = useSubscription();
  const credits = useCredits();
  const history = useCreditsHistory();
  const cancel = useCancelSubscription();
  const navigate = useNavigate();
  const [isCancelDialogOpen, setCancelDialogOpen] = useState(false);

  async function confirmCancel() {
    await cancel.mutateAsync();
    setCancelDialogOpen(false);
  }

  return {
    isLoading: subscription.isLoading,
    isError: subscription.isError,
    retry: () => void subscription.refetch(),
    overview: subscription.data,
    credits: credits.data,
    history: history.data?.data ?? [],
    goToPlans: () => navigate('/planos'),
    isCancelDialogOpen,
    openCancelDialog: () => setCancelDialogOpen(true),
    closeCancelDialog: () => setCancelDialogOpen(false),
    confirmCancel: () => void confirmCancel(),
    isCanceling: cancel.isPending,
    cancelError: cancel.error,
  };
}
