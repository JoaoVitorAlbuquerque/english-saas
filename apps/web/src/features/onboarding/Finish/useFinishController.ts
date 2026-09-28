import { useProfile } from '@english-saas/api-client';
import { useNavigate } from 'react-router-dom';

export function useFinishController() {
  const navigate = useNavigate();
  const { data } = useProfile();

  const isBeginner = data?.selfReportedLevel === 'NONE';

  return {
    isBeginner,
    goToToday: () => navigate('/hoje', { replace: true }),
    goToPlacement: () => navigate('/nivelamento', { replace: true }),
  };
}
