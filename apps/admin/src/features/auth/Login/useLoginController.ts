import { zodResolver } from '@hookform/resolvers/zod';
import {
  authService,
  signinRequestSchema,
  useSignIn,
  type SigninRequest,
} from '@english-saas/api-client';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { hasAdminAccess, useAuthStore } from '../../../stores/auth-store';

export function useLoginController() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
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

      if (!hasAdminAccess(session.user)) {
        // Conta válida, mas sem papel de editor/admin: não fica logada aqui.
        await authService.logout();
        clearSession();
        navigate('/403', { replace: true });
        return;
      }

      setSession(session.user);
      navigate('/', { replace: true });
    } catch {
      // erro exibido abaixo via signIn.error
    }
  });

  return {
    register,
    errors,
    handleSubmit,
    isLoading: signIn.isPending,
    errorMessage: signIn.error?.message,
  };
}
