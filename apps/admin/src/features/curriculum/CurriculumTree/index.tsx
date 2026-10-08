import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@english-saas/ui';
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Plus,
  Sparkles,
  Tags,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { LessonDialog } from './LessonDialog';
import { UnitDialog } from './UnitDialog';
import {
  useCurriculumTreeController,
  type LessonRow,
  type LevelRow,
  type UnitRow,
} from './useCurriculumTreeController';

function MoveButtons({
  upLabel,
  downLabel,
  canMoveUp,
  canMoveDown,
  disabled,
  onUp,
  onDown,
}: {
  upLabel: string;
  downLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-label={upLabel}
        disabled={!canMoveUp || disabled}
        onClick={onUp}
        className="flex size-6 items-center justify-center rounded text-muted hover:bg-ground disabled:opacity-30"
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={downLabel}
        disabled={!canMoveDown || disabled}
        onClick={onDown}
        className="flex size-6 items-center justify-center rounded text-muted hover:bg-ground disabled:opacity-30"
      >
        <ArrowDown className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function LessonItem({
  row,
  disabled,
  onMove,
}: {
  row: LessonRow;
  disabled: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-ground/40 px-3 py-2">
      <MoveButtons
        upLabel={t('tree.lesson.moveUp', { title: row.title })}
        downLabel={t('tree.lesson.moveDown', { title: row.title })}
        canMoveUp={row.canMoveUp}
        canMoveDown={row.canMoveDown}
        disabled={disabled}
        onUp={() => onMove(-1)}
        onDown={() => onMove(1)}
      />
      <div className="min-w-0 flex-1">
        <Link
          to={`/conteudo/licoes/${row.lesson.id}`}
          aria-label={t('tree.lesson.open', { title: row.title })}
          className="block truncate font-medium text-ink hover:text-accent"
        >
          {row.title}
        </Link>
        <p className="truncate font-mono text-xs text-muted">
          {row.lesson.slug}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {row.latest ? <StatusBadge status={row.latest.status} /> : null}
        {row.publishedVersion ? (
          <Badge tone="ok">
            {t('tree.lesson.published', {
              version: row.publishedVersion.version,
            })}
          </Badge>
        ) : (
          <span className="text-xs text-muted">
            {t('tree.lesson.notPublished')}
          </span>
        )}
        {row.latest && row.latest.id !== row.publishedVersion?.id ? (
          <span className="text-xs text-muted">
            {t('tree.lesson.latest', { version: row.latest.version })}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function UnitItem({
  level,
  row,
  disabled,
  onMoveUnit,
  onMoveLesson,
  onTransition,
  onNewLesson,
}: {
  level: LevelRow;
  row: UnitRow;
  disabled: boolean;
  onMoveUnit: (delta: -1 | 1) => void;
  onMoveLesson: (lessonId: string, delta: -1 | 1) => void;
  onTransition: (action: UnitRow['actions'][number]) => void;
  onNewLesson: (level: LevelRow) => void;
}) {
  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <MoveButtons
            upLabel={t('tree.unit.moveUp', { title: row.unit.title })}
            downLabel={t('tree.unit.moveDown', { title: row.unit.title })}
            canMoveUp={row.canMoveUp}
            canMoveDown={row.canMoveDown}
            disabled={disabled}
            onUp={() => onMoveUnit(-1)}
            onDown={() => onMoveUnit(1)}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg text-ink">
              {row.unit.title}
            </h3>
            <p className="truncate font-mono text-xs text-muted">
              {row.unit.slug}
            </p>
          </div>
          <StatusBadge status={row.unit.status} />
        </div>

        {row.actions.length > 0 ? (
          <div
            role="group"
            aria-label={t('tree.unit.actions', { title: row.unit.title })}
            className="flex flex-wrap gap-2"
          >
            {row.actions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant="ghost"
                onClick={() => onTransition(action)}
              >
                {t(`tree.unit.action.${action}`)}
              </Button>
            ))}
          </div>
        ) : null}

        {row.lessons.length === 0 ? (
          <p className="text-sm text-muted">{t('tree.lesson.empty')}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {row.lessons.map((lesson) => (
              <LessonItem
                key={lesson.lesson.id}
                row={lesson}
                disabled={disabled}
                onMove={(delta) => onMoveLesson(lesson.lesson.id, delta)}
              />
            ))}
          </ol>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => onNewLesson(level)}
        >
          {t('tree.lesson.new')}
        </Button>
      </Card>
    </li>
  );
}

export function CurriculumTree() {
  const controller = useCurriculumTreeController();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{t('tree.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('tree.subtitle')}</p>
        </div>
        <nav
          aria-label={t('tree.related')}
          className="flex flex-wrap items-center gap-2"
        >
          <Link
            to="/conteudo/questoes"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-base font-medium text-ink hover:bg-ground"
          >
            <ListChecks className="size-5" aria-hidden="true" />
            {t('tree.items')}
          </Link>
          <Link
            to="/conteudo/taxonomia/skills"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-base font-medium text-ink hover:bg-ground"
          >
            <Tags className="size-5" aria-hidden="true" />
            {t('tree.taxonomy')}
          </Link>
          <Link
            to="/estudio"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-base font-medium text-ink hover:bg-ground"
          >
            <Sparkles className="size-5" aria-hidden="true" />
            {t('tree.studio')}
          </Link>
          <Link
            to="/conteudo/personagens"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-base font-medium text-ink hover:bg-ground"
          >
            <Users className="size-5" aria-hidden="true" />
            {t('tree.characters')}
          </Link>
        </nav>
      </header>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.levels.length === 0 ? (
        <EmptyState
          title={t('tree.noCourse.title')}
          description={t('tree.noCourse.description')}
        />
      ) : (
        controller.levels.map((levelRow) => (
          <section
            key={levelRow.level.id}
            aria-labelledby={`level-${levelRow.level.id}`}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id={`level-${levelRow.level.id}`}
                  className="font-display text-xl text-ink"
                >
                  {t('tree.level.heading', {
                    level: levelRow.level.cefrLevel,
                  })}
                  <span className="ml-2 text-base text-muted">
                    {levelRow.level.title}
                  </span>
                </h2>
                <p className="text-sm text-muted">
                  {t('tree.level.unitCount', { count: levelRow.units.length })}
                </p>
              </div>
              <Button
                variant="ghost"
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => controller.openUnitDialog(levelRow)}
              >
                {t('tree.unit.new')}
              </Button>
            </div>

            {levelRow.units.length === 0 ? (
              <p className="text-sm text-muted">{t('tree.unit.empty')}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {levelRow.units.map((unitRow) => (
                  <UnitItem
                    key={unitRow.unit.id}
                    level={levelRow}
                    row={unitRow}
                    disabled={controller.isReordering}
                    onMoveUnit={(delta) =>
                      controller.moveUnit(levelRow, unitRow.unit.id, delta)
                    }
                    onMoveLesson={(lessonId, delta) =>
                      controller.moveLesson(unitRow, lessonId, delta)
                    }
                    onTransition={(action) =>
                      controller.requestTransition(unitRow.unit, action)
                    }
                    onNewLesson={(level) =>
                      controller.openLessonDialog(unitRow, level)
                    }
                  />
                ))}
              </ol>
            )}
          </section>
        ))
      )}

      <UnitDialog
        open={controller.unitDialogLevel !== null}
        levelId={controller.unitDialogLevel?.level.id ?? ''}
        levelLabel={controller.unitDialogLevel?.level.cefrLevel ?? ''}
        order={controller.unitDialogLevel?.nextUnitOrder ?? 0}
        onClose={controller.closeUnitDialog}
      />

      <LessonDialog
        open={controller.lessonDialogUnit !== null}
        unitId={controller.lessonDialogUnit?.unit.unit.id ?? ''}
        unitTitle={controller.lessonDialogUnit?.unit.unit.title ?? ''}
        order={controller.lessonDialogUnit?.unit.nextLessonOrder ?? 0}
        defaultLevel={
          controller.lessonDialogUnit?.level.level.cefrLevel ?? 'A1'
        }
        onClose={controller.closeLessonDialog}
        onCreated={(lessonId, versionId) => {
          controller.closeLessonDialog();
          controller.openEditor(lessonId, versionId);
        }}
      />

      <ConfirmDialog
        open={controller.confirming !== null}
        title={t(
          `tree.unit.confirm.${controller.confirming?.action === 'archive' ? 'archive' : 'publish'}.title`,
        )}
        description={t(
          `tree.unit.confirm.${controller.confirming?.action === 'archive' ? 'archive' : 'publish'}.description`,
          { title: controller.confirming?.unit.title ?? '' },
        )}
        confirmLabel={t(
          `tree.unit.action.${controller.confirming?.action === 'archive' ? 'archive' : 'publish'}`,
        )}
        danger={controller.confirming?.action === 'archive'}
        isLoading={controller.isTransitioning}
        onConfirm={controller.confirmTransition}
        onCancel={controller.cancelTransition}
      />
    </div>
  );
}
