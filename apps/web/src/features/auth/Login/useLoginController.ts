import { zodResolver } from '@hookform/resolvers/zod';
import {
  signinRequestSchema,
  useGoogleUrl,
  useSignIn,
  type SigninRequest,
} from '@english-saas/api-client';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../stores/auth-store';

export function useLoginController() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
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
