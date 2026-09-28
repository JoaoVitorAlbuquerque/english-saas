import { Button, EmptyState, ErrorState, Input } from '@english-saas/ui';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useVerifyEmailController } from './useVerifyEmailController';

export function VerifyEmail() {
  const {
    isLoading,
    isSuccess,
    isError,
    register,
    errors,
    handleResendSubmit,
    isResending,
    resendSent,
  } = useVerifyEmailController();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <p>{t('auth.verifyEmail.loading')}</p>
        </div>
      ) : isSuccess ? (
        <EmptyState
          title={t('auth.verifyEmail.successTitle')}
          description={t('auth.verifyEmail.successDescription')}
          action={
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 font-medium text-white hover:opacity-90"
            >
              {t('auth.verifyEmail.continue')}
            </Link>
          }
        />
      ) : isError ? (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <ErrorState title={t('auth.verifyEmail.errorTitle')} />

          {resendSent ? (
            <p className="text-center text-sm text-ok">
              {t('auth.verifyEmail.resendSuccess')}
            </p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={handleResendSubmit}
              noValidate
            >
              <Input
                type="email"
                autoComplete="email"
                label={t('auth.verifyEmail.resendEmail')}
                error={errors.email?.message}
                {...register('email')}
              />
              <Button type="submit" isLoading={isResending}>
                {t('auth.verifyEmail.resendSubmit')}
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
