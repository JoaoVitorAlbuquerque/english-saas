import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from '@english-saas/ui';
import {
  Bell,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UserAvatar } from '../components/UserAvatar';
import { useProfileController } from './useProfileController';

const LINKS: {
  to: string;
  icon: LucideIcon;
  title: Parameters<typeof t>[0];
  description: Parameters<typeof t>[0];
}[] = [
  {
    to: '/perfil/estudo',
    icon: Target,
    title: 'profile.links.study',
    description: 'profile.links.studyDescription',
  },
  {
    to: '/perfil/notificacoes',
    icon: Bell,
    title: 'profile.links.notifications',
    description: 'profile.links.notificationsDescription',
  },
  {
    to: '/perfil/privacidade',
    icon: ShieldCheck,
    title: 'profile.links.privacy',
    description: 'profile.links.privacyDescription',
  },
  {
    to: '/minha-assinatura',
    icon: CreditCard,
    title: 'subscription.title',
    description: 'profile.links.subscriptionDescription',
  },
];

export function Profile() {
  const {
    isLoading,
    isError,
    retry,
    user,
    name,
    setName,
    nameError,
    timezone,
    setTimezone,
    timezoneOptions,
    canSave,
    isSaving,
    save,
    saveError,
    sessionError,
    isLoggingOut,
    handleLogout,
    isLogoutAllOpen,
    openLogoutAll,
    closeLogoutAll,
    isLoggingOutAll,
    confirmLogoutAll,
  } = useProfileController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || user === null) {
    return <ErrorState title={t('profile.errorTitle')} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl text-ink">{t('profile.title')}</h1>

      <Card className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-ink">
              {user.name}
            </p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <Badge
              tone={user.emailVerifiedAt === null ? 'muted' : 'ok'}
              className="mt-1"
            >
              {user.emailVerifiedAt === null
                ? t('profile.account.emailUnverified')
                : t('profile.account.emailVerified')}
            </Badge>
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          noValidate
        >
          <Input
            label={t('profile.account.name')}
            autoComplete="name"
            value={name}
            error={nameError}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label={t('profile.account.email')}
            type="email"
            value={user.email}
            readOnly
            hint={t('profile.account.emailHint')}
          />
          <div className="flex flex-col gap-1.5">
            <Select
              label={t('profile.account.timezone')}
              value={timezone}
              options={timezoneOptions}
              onChange={(event) => setTimezone(event.target.value)}
            />
            <p className="text-sm text-muted">
              {t('profile.account.timezoneHint')}
            </p>
          </div>

          {saveError ? (
            <p role="alert" className="text-sm text-error">
              {saveError}
            </p>
          ) : null}

          <Button
            type="submit"
            className="self-start"
            disabled={!canSave}
            isLoading={isSaving}
          >
            {t('profile.account.save')}
          </Button>
        </form>
      </Card>

      <section aria-labelledby="profile-links" className="flex flex-col gap-2">
        <h2 id="profile-links" className="text-sm font-medium text-muted">
          {t('profile.links.title')}
        </h2>
        {LINKS.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to}>
            <Card className="flex items-center gap-3 hover:bg-ground">
              <Icon
                className="size-5 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {t(title)}
                </span>
                <span className="block text-sm text-muted">
                  {t(description)}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted"
                aria-hidden="true"
              />
            </Card>
          </Link>
        ))}
      </section>

      <section
        aria-labelledby="profile-session"
        className="flex flex-col gap-3"
      >
        <h2 id="profile-session" className="text-sm font-medium text-muted">
          {t('profile.session.title')}
        </h2>
        {sessionError ? (
          <p role="alert" className="text-sm text-error">
            {sessionError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={handleLogout}
            isLoading={isLoggingOut}
          >
            {t('profile.session.logout')}
          </Button>
          <Button variant="ghost" onClick={openLogoutAll}>
            {t('profile.session.logoutAll')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={isLogoutAllOpen}
        title={t('profile.session.logoutAllTitle')}
        description={t('profile.session.logoutAllDescription')}
        confirmLabel={t('profile.session.logoutAllConfirm')}
        isLoading={isLoggingOutAll}
        onConfirm={confirmLogoutAll}
        onClose={closeLogoutAll}
      />
    </div>
  );
}
