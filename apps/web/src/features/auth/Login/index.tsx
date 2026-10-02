import { Button, Card, Input } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useLoginController } from './useLoginController';

export function Login() {
  const {
    accountDeletedMessage,
    register,
    errors,
    handleSubmit,
    isLoading,
    errorMessage,
    handleGoogleClick,
    isGoogleLoading,
    googleErrorMessage,
  } = useLoginController();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm">
        {accountDeletedMessage !== null ? (
          <div
            role="status"
            className="mb-4 rounded-lg border border-line bg-ground p-3"
          >
            <p className="text-sm font-medium text-ink">
              {t('auth.login.accountDeletedTitle')}
            </p>
            <p className="mt-1 text-sm text-muted">{accountDeletedMessage}</p>
          </div>
        ) : null}
        <h1 className="font-display text-2xl text-ink">
          {t('auth.login.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('auth.login.subtitle')}</p>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
        >
          <Input
            type="email"
            autoComplete="email"
            label={t('auth.login.email')}
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="flex flex-col gap-1.5">
            <Input
              type="password"
              autoComplete="current-password"
              label={t('auth.login.password')}
              error={errors.password?.message}
              {...register('password')}
            />
            <Link
              to="/esqueci-senha"
              className="self-end text-sm font-medium text-accent"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-error">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" isLoading={isLoading}>
            {t('auth.login.submit')}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          {t('auth.login.or')}
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          isLoading={isGoogleLoading}
          onClick={() => void handleGoogleClick()}
        >
          {t('auth.login.googleButton')}
        </Button>
        {googleErrorMessage ? (
          <p role="alert" className="mt-2 text-center text-sm text-error">
            {googleErrorMessage}
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.login.noAccount')}{' '}
          <Link to="/cadastro" className="font-medium text-accent">
            {t('auth.login.createAccount')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
