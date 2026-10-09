import { ErrorState, Skeleton } from '@english-saas/ui';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { GrantDialog } from './GrantDialog';
import { CreditsSection } from './sections/CreditsSection';
import { HistorySection } from './sections/HistorySection';
import { LevelSection } from './sections/LevelSection';
import { PlanSection } from './sections/PlanSection';
import { ProfileHeader } from './sections/ProfileHeader';
import { StrengthsSection } from './sections/StrengthsSection';
import { SubscriptionSection } from './sections/SubscriptionSection';
import { UsageSection } from './sections/UsageSection';
import { useStudentProfileController } from './useStudentProfileController';

export function StudentProfile() {
  const controller = useStudentProfileController();
  const overview = controller.overview.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        to="/alunos"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('student.back')}
      </Link>

      {controller.overview.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : controller.overview.error ? (
        <ErrorState
          title={t('student.loadError')}
          description={controller.overview.error.message}
          onRetry={controller.overview.retry}
        />
      ) : overview ? (
        <>
          <ProfileHeader overview={overview} />

          <div className="grid gap-6 lg:grid-cols-2">
            <LevelSection progress={controller.progress} />
            <div className="space-y-6">
              <StrengthsSection progress={controller.progress} />
              <PlanSection
                plan={controller.plan}
                progress={controller.progress}
              />
            </div>
          </div>

          <HistorySection history={controller.history} />

          <div className="grid gap-6 lg:grid-cols-2">
            <SubscriptionSection subscription={controller.subscription} />
            <UsageSection usage={controller.usage} />
          </div>

          <CreditsSection
            credits={controller.credits}
            ledger={controller.ledger}
            onGrant={controller.openGrant}
          />

          <GrantDialog
            open={controller.granting}
            userId={controller.userId}
            studentName={overview.user.name}
            balance={controller.credits.data?.balance}
            onClose={controller.closeGrant}
          />
        </>
      ) : null}
    </div>
  );
}
