import { Button, Card, Checkbox, Input } from '@english-saas/ui';
import { Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useSignupController } from './useSignupController';

export function Signup() {
  const { register, control, errors, handleSubmit, isLoading, errorMessage } =
    useSignupController();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-ink">
          {t('auth.signup.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('auth.signup.subtitle')}</p>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
        >
          <Input
            autoComplete="name"
            label={t('auth.signup.name')}
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            type="email"
            autoComplete="email"
            label={t('auth.signup.email')}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            type="password"
            autoComplete="new-password"
            label={t('auth.signup.password')}
            error={errors.password?.message}
            {...register('password')}
          />
          <Controller
            control={control}
            name="acceptedTerms"
            render={({ field }) => (
              <Checkbox
                label={t('auth.signup.acceptedTerms')}
                error={errors.acceptedTerms?.message}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="acceptedPrivacyPolicy"
            render={({ field }) => (
              <Checkbox
                label={t('auth.signup.acceptedPrivacyPolicy')}
                error={errors.acceptedPrivacyPolicy?.message}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          {errorMessage ? (
            <p role="alert" className="text-sm text-error">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" isLoading={isLoading}>
            {t('auth.signup.submit')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.signup.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-accent">
            {t('auth.signup.login')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
