import { zodResolver } from '@hookform/resolvers/zod';
import {
  signupRequestSchema,
  useSignUp,
  type SignupRequest,
} from '@english-saas/api-client';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../stores/auth-store';

export function useSignupController() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const signUp = useSignUp();

  const {
    register,
    control,
    watch,
    handleSubmit: hookFormSubmit,
    formState: { errors },
  } = useForm<SignupRequest>({
    resolver: zodResolver(signupRequestSchema),
    defaultValues: {
      acceptedTerms: false,
      acceptedPrivacyPolicy: false,
      acceptedDataPersonalization: false,
      acceptedMarketing: false,
    },
  });

  const handleSubmit = hookFormSubmit(async (data) => {
    try {
      const session = await signUp.mutateAsync(data);
      setSession(session.user);
      navigate('/', { replace: true });
    } catch {
      // erro exibido via signUp.error
    }
  });

  return {
    register,
    control,
    errors,
    handleSubmit,
    password: watch('password') ?? '',
    isLoading: signUp.isPending,
    errorCode: signUp.error?.code,
    errorMessage: signUp.error?.message,
  };
}
