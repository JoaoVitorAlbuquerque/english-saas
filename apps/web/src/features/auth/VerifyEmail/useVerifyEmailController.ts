import { zodResolver } from '@hookform/resolvers/zod';
import {
  resendVerificationRequestSchema,
  useResendVerification,
  useVerifyEmail,
  type ResendVerificationRequest,
} from '@english-saas/api-client';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';

export function useVerifyEmailController() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !token) {
      return;
    }

    attempted.current = true;
    verifyEmail.mutate({ token });
  }, [token, verifyEmail]);

  const {
    register,
    handleSubmit: hookFormSubmit,
    formState: { errors },
  } = useForm<ResendVerificationRequest>({
    resolver: zodResolver(resendVerificationRequestSchema),
  });

  const handleResendSubmit = hookFormSubmit((data) => {
    resendVerification.mutate(data);
  });

  return {
    hasToken: token !== null && token.length > 0,
    isLoading: verifyEmail.isPending,
    isSuccess: verifyEmail.isSuccess,
    isError: verifyEmail.isError || !token,
    register,
    errors,
    handleResendSubmit,
    isResending: resendVerification.isPending,
    resendSent: resendVerification.isSuccess,
  };
}
