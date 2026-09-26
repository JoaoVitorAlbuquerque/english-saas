import { useAuthStore } from '../../../stores/auth-store';
import { t } from '../../../messages/pt-BR';

export function useProfileController() {
  const user = useAuthStore((state) => state.user);

  return {
    title: t('placeholder.profile.title'),
    description: t('placeholder.profile.description'),
    user,
  };
}
