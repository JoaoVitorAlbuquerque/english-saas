import { Button, Card, ErrorState, Input } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { PasswordStrengthMeter } from '../shared/PasswordStrengthMeter';
import { useResetPasswordController } from './useResetPasswordController';

export function ResetPassword() {
  const {
    hasToken,
    register,
    errors,
    handleSubmit,
    password,
    isLoading,
    errorCode,
    errorMessage,
  } = useResetPasswordController();

  if (!hasToken) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
        <ErrorState
          title={t('auth.resetPassword.invalidLinkTitle')}
          description={t('auth.resetPassword.invalidLinkDescription')}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-ink">
          {t('auth.resetPassword.title')}
        </h1>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Input
              type="password"
              autoComplete="new-password"
              label={t('auth.resetPassword.password')}
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <Input
            type="password"
            autoComplete="new-password"
            label={t('auth.resetPassword.confirmPassword')}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {errorMessage ? (
            <p role="alert" className="text-sm text-error">
              {errorMessage}{' '}
              {errorCode === 'INVALID_TOKEN' ? (
                <Link to="/esqueci-senha" className="font-medium underline">
                  {t('auth.resetPassword.requestNewLink')}
                </Link>
              ) : null}
            </p>
          ) : null}

          <Button type="submit" isLoading={isLoading}>
            {t('auth.resetPassword.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
