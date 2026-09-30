import type { UnitLesson } from '@english-saas/api-client';
import {
  Badge,
  Button,
  Card,
  CharacterAvatar,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@english-saas/ui';
import { CheckCircle2, Download, Lock, PlayCircle } from 'lucide-react';

import { Checkpoint } from '../../checkpoint/Checkpoint';
import { t } from '../../../messages/pt-BR';
import { useUnitController } from './useUnitController';

const REQUIRED_PLAN_LABELS: Record<string, string> = {
  BASE: 'Base',
  PLUS: 'Plus',
};

function LessonRow({
  lesson,
  inPlan,
  completed,
  inProgress,
  onOpen,
}: {
  lesson: UnitLesson;
  inPlan: boolean;
  completed: boolean;
  inProgress: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:bg-ground"
    >
      <span className="text-muted" aria-hidden="true">
        {lesson.locked ? (
          <Lock className="size-5" />
        ) : completed ? (
          <CheckCircle2 className="size-5 text-ok" />
        ) : (
          <PlayCircle className="size-5" />
        )}
      </span>
      <div className="flex flex-1 flex-col">
        <span className="font-medium text-ink">
          {lesson.publishedVersion.title}
        </span>
        <span className="text-xs text-muted">
          {lesson.publishedVersion.estimatedMinutes} min
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {lesson.locked ? (
          <Badge tone="muted">
            {lesson.requiredPlan
              ? (REQUIRED_PLAN_LABELS[lesson.requiredPlan] ??
                lesson.requiredPlan)
              : t('catalog.locked')}
          </Badge>
        ) : (
          <>
            {inPlan ? (
              <Badge tone="accent">{t('unit.lesson.inPlan')}</Badge>
            ) : null}
            {completed ? (
              <Badge tone="ok">{t('unit.lesson.completed')}</Badge>
            ) : inProgress ? (
              <Badge tone="muted">{t('unit.lesson.inProgress')}</Badge>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}

export function Unit() {
  const {
    unit,
    isLoading,
    isError,
    retry,
    planLessonIds,
    lessonMarks,
    openLesson,
    workbook,
    downloadWorkbook,
    isDownloadingWorkbook,
    isCheckpointOpen,
    openCheckpoint,
    closeCheckpoint,
  } = useUnitController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-10" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (isError || unit === undefined) {
    return <ErrorState title={t('unit.errorTitle')} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex aspect-[21/9] items-center justify-center overflow-hidden rounded-2xl bg-ground">
        {unit.cover ? (
          <img src={unit.cover.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="font-display text-3xl text-muted">
            {unit.level.cefrLevel}
          </span>
        )}
      </div>

      <div>
        <h1 className="font-display text-xl text-ink">{unit.title}</h1>
        {unit.synopsis ? (
          <p className="mt-1 text-sm text-muted">{unit.synopsis}</p>
        ) : null}
      </div>

      {unit.cast.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">{t('unit.cast')}</h2>
          <div className="flex flex-wrap gap-3">
            {unit.cast.map((character) => (
              <div
                key={character.id}
                className="flex flex-col items-center gap-1"
              >
                <CharacterAvatar
                  name={character.name}
                  imageUrl={character.avatar?.url}
                />
                <span className="text-xs text-muted">{character.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink">{t('unit.lessons')}</h2>
        {unit.lessons.length === 0 ? (
          <EmptyState
            title={t('unit.noLessonsTitle')}
            description={t('unit.noLessonsDescription')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {unit.lessons.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                inPlan={planLessonIds.has(lesson.id)}
                completed={lessonMarks.get(lesson.id)?.completed ?? false}
                inProgress={lessonMarks.get(lesson.id)?.inProgress ?? false}
                onOpen={() => openLesson(lesson)}
              />
            ))}
          </div>
        )}
      </div>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">
            {t('unit.checkpoint.title')}
          </h2>
          <p className="text-xs text-muted">{t('unit.checkpoint.subtitle')}</p>
        </div>
        <Button variant="ghost" onClick={openCheckpoint}>
          {t('unit.checkpoint.action')}
        </Button>
      </Card>

      {workbook ? (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink">{workbook.title}</h2>
            <p className="text-xs text-muted">{t('unit.workbook.subtitle')}</p>
          </div>
          <Button
            variant="ghost"
            onClick={downloadWorkbook}
            disabled={isDownloadingWorkbook}
          >
            {workbook.locked ? (
              <Lock className="size-4" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {t('unit.workbook.action')}
          </Button>
        </Card>
      ) : null}

      {isCheckpointOpen ? (
        <Checkpoint unitId={unit.id} onClose={closeCheckpoint} />
      ) : null}
    </div>
  );
}
