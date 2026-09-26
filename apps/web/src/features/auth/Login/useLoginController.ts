import { zodResolver } from '@hookform/resolvers/zod';
import {
  signinRequestSchema,
  useSignIn,
  type SigninRequest,
} from '@english-saas/api-client';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../stores/auth-store';
import { t } from '../../../messages/pt-BR';

export function useLoginController() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const signIn = useSignIn();

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
      setSession(session.user);
      navigate('/hoje', { replace: true });
    } catch {
      // erro exibido abaixo via signIn.isError / signIn.error
    }
  });

  return {
    register,
    errors,
    handleSubmit,
    isLoading: signIn.isPending,
    errorMessage: signIn.isError ? t('auth.login.genericError') : undefined,
  };
}
