import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordRequestSchema,
  useForgotPassword,
  type ForgotPasswordRequest,
} from '@english-saas/api-client';
import { useForm } from 'react-hook-form';

export function useForgotPasswordController() {
  const forgotPassword = useForgotPassword();

  const {
    register,
    handleSubmit: hookFormSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
  });

  const handleSubmit = hookFormSubmit((data) => {
    forgotPassword.mutate(data);
  });

  return {
    register,
    errors,
    handleSubmit,
    isLoading: forgotPassword.isPending,
    isSent: forgotPassword.isSuccess,
    errorMessage: forgotPassword.error?.message,
  };
}
