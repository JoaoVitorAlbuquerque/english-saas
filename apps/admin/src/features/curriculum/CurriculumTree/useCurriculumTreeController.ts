import {
  type AdminCourse,
  type AdminLessonSummary,
  type AdminLevel,
  type AdminUnit,
  type AdminVersionSummary,
  type ApiError,
  type UnitAction,
  useAdminLessons,
  useAdminUnits,
  useCourses,
  useReorderLessons,
  useReorderUnits,
  useTransitionUnit,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { availableActions, type EditorialAction } from '../lib/editorial';
import { moveItem } from '../lib/list-ops';

export type LessonRow = {
  lesson: AdminLessonSummary;
  /** Título da versão mais recente. */
  title: string;
  latest: AdminVersionSummary | null;
  publishedVersion: AdminVersionSummary | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export type UnitRow = {
  unit: AdminUnit;
  lessons: LessonRow[];
  actions: UnitAction[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Posição da próxima lição criada: no fim. */
  nextLessonOrder: number;
};

export type LevelRow = {
  level: AdminLevel;
  courseTitle: string;
  units: UnitRow[];
  nextUnitOrder: number;
};

/** O fluxo da unidade usa `submit`, o da versão `submit-for-review`. */
function toUnitAction(action: EditorialAction): UnitAction {
  return action === 'submit-for-review' ? 'submit' : action;
}

function buildLevels(
  courses: AdminCourse[],
  units: AdminUnit[],
  lessons: AdminLessonSummary[],
): LevelRow[] {
  return courses.flatMap((course) =>
    [...course.levels]
      .sort((a, b) => a.order - b.order)
      .map((level): LevelRow => {
        const levelUnits = units
          .filter((unit) => unit.levelId === level.id)
          .sort((a, b) => a.order - b.order);

        return {
          level,
          courseTitle: course.title,
          nextUnitOrder:
            levelUnits.length === 0
              ? 0
              : Math.max(...levelUnits.map((unit) => unit.order)) + 1,
          units: levelUnits.map((unit, unitIndex): UnitRow => {
            const unitLessons = lessons
              .filter((lesson) => lesson.unitId === unit.id)
              .sort((a, b) => a.order - b.order);

            return {
              unit,
              actions: availableActions(unit.status).map(toUnitAction),
              canMoveUp: unitIndex > 0,
              canMoveDown: unitIndex < levelUnits.length - 1,
              nextLessonOrder:
                unitLessons.length === 0
                  ? 0
                  : Math.max(...unitLessons.map((lesson) => lesson.order)) + 1,
              lessons: unitLessons.map((lesson, lessonIndex): LessonRow => {
                const latest = lesson.versions[0] ?? null;

                return {
                  lesson,
                  title: latest?.title ?? lesson.slug,
                  latest,
                  publishedVersion:
                    lesson.versions.find(
                      (version) => version.id === lesson.publishedVersionId,
                    ) ?? null,
                  canMoveUp: lessonIndex > 0,
                  canMoveDown: lessonIndex < unitLessons.length - 1,
                };
              }),
            };
          }),
        };
      }),
  );
}

export type ConfirmTransition = { unit: AdminUnit; action: UnitAction } | null;

export function useCurriculumTreeController() {
  const navigate = useNavigate();
  const courses = useCourses();
  const units = useAdminUnits();
  const lessons = useAdminLessons();
  const reorderUnits = useReorderUnits();
  const reorderLessons = useReorderLessons();
  const transitionUnit = useTransitionUnit();

  const [unitDialogLevel, setUnitDialogLevel] = useState<LevelRow | null>(null);
  const [lessonDialogUnit, setLessonDialogUnit] = useState<{
    unit: UnitRow;
    level: LevelRow;
  } | null>(null);
  const [confirming, setConfirming] = useState<ConfirmTransition>(null);

  const isLoading = courses.isPending || units.isPending || lessons.isPending;
  const error = courses.error ?? units.error ?? lessons.error ?? null;

  const levels =
    courses.data && units.data && lessons.data
      ? buildLevels(courses.data, units.data, lessons.data)
      : [];

  function onReorderError(): void {
    toast.error({ title: t('tree.reorderError') });
  }

  function moveUnit(row: LevelRow, unitId: string, delta: -1 | 1): void {
    const ids = row.units.map((unitRow) => unitRow.unit.id);
    const index = ids.indexOf(unitId);

    reorderUnits.mutate(
      { levelId: row.level.id, ids: moveItem(ids, index, delta) },
      { onError: onReorderError },
    );
  }

  function moveLesson(unit: UnitRow, lessonId: string, delta: -1 | 1): void {
    const ids = unit.lessons.map((lessonRow) => lessonRow.lesson.id);
    const index = ids.indexOf(lessonId);

    reorderLessons.mutate(
      { unitId: unit.unit.id, ids: moveItem(ids, index, delta) },
      { onError: onReorderError },
    );
  }

  function runTransition(unit: AdminUnit, action: UnitAction): void {
    transitionUnit.mutate(
      { id: unit.id, action },
      {
        onSettled: () => setConfirming(null),
        onError: (failure: ApiError) =>
          toast.error({
            title: t('tree.unit.transitionError'),
            description: failure.message,
          }),
      },
    );
  }

  /** Publicar e arquivar pedem confirmação; o resto vai direto. */
  function requestTransition(unit: AdminUnit, action: UnitAction): void {
    if (action === 'publish' || action === 'archive') {
      setConfirming({ unit, action });
    } else {
      runTransition(unit, action);
    }
  }

  function retry(): void {
    void courses.refetch();
    void units.refetch();
    void lessons.refetch();
  }

  return {
    isLoading,
    error,
    levels,
    retry,
    moveUnit,
    moveLesson,
    isReordering: reorderUnits.isPending || reorderLessons.isPending,
    requestTransition,
    confirming,
    confirmTransition: () => {
      if (confirming !== null) {
        runTransition(confirming.unit, confirming.action);
      }
    },
    cancelTransition: () => setConfirming(null),
    isTransitioning: transitionUnit.isPending,
    unitDialogLevel,
    openUnitDialog: setUnitDialogLevel,
    closeUnitDialog: () => setUnitDialogLevel(null),
    lessonDialogUnit,
    openLessonDialog: (unit: UnitRow, level: LevelRow) =>
      setLessonDialogUnit({ unit, level }),
    closeLessonDialog: () => setLessonDialogUnit(null),
    openEditor: (lessonId: string, versionId: string | null) =>
      navigate(
        versionId === null
          ? `/conteudo/licoes/${lessonId}`
          : `/conteudo/versoes/${versionId}`,
      ),
  };
}
