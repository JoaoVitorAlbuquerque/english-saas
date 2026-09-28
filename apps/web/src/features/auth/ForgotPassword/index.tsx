import { Button, Card, EmptyState, Input } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useForgotPasswordController } from './useForgotPasswordController';

export function ForgotPassword() {
  const { register, errors, handleSubmit, isLoading, isSent, errorMessage } =
    useForgotPasswordController();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm">
        {isSent ? (
          <EmptyState
            title={t('auth.forgotPassword.sentTitle')}
            description={t('auth.forgotPassword.sentDescription')}
            action={
              <Link to="/login" className="text-sm font-medium text-accent">
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            }
          />
        ) : (
          <>
            <h1 className="font-display text-2xl text-ink">
              {t('auth.forgotPassword.title')}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t('auth.forgotPassword.subtitle')}
            </p>

            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={handleSubmit}
              noValidate
            >
              <Input
                type="email"
                autoComplete="email"
                label={t('auth.forgotPassword.email')}
                error={errors.email?.message}
                {...register('email')}
              />

              {errorMessage ? (
                <p role="alert" className="text-sm text-error">
                  {errorMessage}
                </p>
              ) : null}

              <Button type="submit" isLoading={isLoading}>
                {t('auth.forgotPassword.submit')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              <Link to="/login" className="font-medium text-accent">
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
