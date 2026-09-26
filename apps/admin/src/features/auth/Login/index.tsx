import { Button, Card, Input } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useLoginController } from './useLoginController';

export function Login() {
  const { register, errors, handleSubmit, isLoading, errorMessage } =
    useLoginController();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm">
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
          <Input
            type="password"
            autoComplete="current-password"
            label={t('auth.login.password')}
            error={errors.password?.message}
            {...register('password')}
          />

          {errorMessage ? (
            <p role="alert" className="text-sm text-error">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" isLoading={isLoading}>
            {t('auth.login.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
