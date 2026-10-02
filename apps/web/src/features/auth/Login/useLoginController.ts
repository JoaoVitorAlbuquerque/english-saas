import { zodResolver } from '@hookform/resolvers/zod';
import {
  signinRequestSchema,
  useGoogleUrl,
  useSignIn,
  type SigninRequest,
} from '@english-saas/api-client';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useAuthStore } from '../../../stores/auth-store';
import { useSessionNoticeStore } from '../../../stores/session-notice-store';

export function useLoginController() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const accountDeleted = useSessionNoticeStore((state) => state.accountDeleted);
  const clearNotice = useSessionNoticeStore((state) => state.clear);
  const signIn = useSignIn();
  const googleUrl = useGoogleUrl();

  const {
    register,
    handleSubmit: hookFormSubmit,
    formState: { errors },
  } = useForm<SigninRequest>({
    resolver: zodResolver(signinRequestSchema),
  });

  const handleSubmit = hookFormSubmit(async (data) => {
    try {
      const session = await signIn.mutateAsync(data);
      clearNotice();
      setSession(session.user);
      navigate('/', { replace: true });
    } catch {
      // erro exibido abaixo via signIn.error
    }
  });

  const handleGoogleClick = async () => {
    try {
      const { url } = await googleUrl.mutateAsync();
      window.location.href = url;
    } catch {
      // erro exibido abaixo via googleUrl.error
    }
  };

  return {
    accountDeletedMessage:
      accountDeleted === null
        ? null
        : t('auth.login.accountDeleted', {
            days: accountDeleted.daysRemaining,
            date: new Date(accountDeleted.anonymizeAt).toLocaleDateString(
              'pt-BR',
            ),
          }),
    register,
    errors,
    handleSubmit,
    isLoading: signIn.isPending,
    errorMessage: signIn.error?.message,
    handleGoogleClick,
    isGoogleLoading: googleUrl.isPending,
    googleErrorMessage: googleUrl.error?.message,
  };
}
