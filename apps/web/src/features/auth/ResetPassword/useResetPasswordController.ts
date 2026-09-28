import { zodResolver } from '@hookform/resolvers/zod';
import { useResetPassword } from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { t } from '../../../messages/pt-BR';

const formSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: t('auth.resetPassword.passwordMismatch'),
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

export function useResetPasswordController() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const resetPassword = useResetPassword();

  const {
    register,
    watch,
    handleSubmit: hookFormSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const handleSubmit = hookFormSubmit(async (data) => {
    if (!token) {
      return;
    }

    try {
      await resetPassword.mutateAsync({ token, password: data.password });
      toast.success({ title: t('auth.resetPassword.successToast') });
      navigate('/login', { replace: true });
    } catch {
      // erro exibido via resetPassword.error
    }
  });

  return {
    hasToken: token !== null && token.length > 0,
    register,
    errors,
    handleSubmit,
    password: watch('password') ?? '',
    isLoading: resetPassword.isPending,
    errorCode: resetPassword.error?.code,
    errorMessage: resetPassword.error?.message,
  };
}
