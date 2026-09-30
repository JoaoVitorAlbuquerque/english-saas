import {
  useLessonHistory,
  usePlan,
  useUnit,
  useWorkbookFile,
  useWorkbooks,
  type CatalogWorkbook,
  type UnitLesson,
} from '@english-saas/api-client';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { openPaywall } from '../../../components/Paywall/open-paywall';
import { computeLessonMarks } from './lesson-marks';

export function useUnitController() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const unit = useUnit(slug);
  const plan = usePlan();
  const history = useLessonHistory();
  const workbooks = useWorkbooks(unit.data?.level.cefrLevel);
  const workbookFile = useWorkbookFile();
  const [isCheckpointOpen, setCheckpointOpen] = useState(false);

  const planLessonIds = new Set(
    plan.data?.path.map((entry) => entry.lessonId) ?? [],
  );
  const lessonMarks = computeLessonMarks(history.data ?? []);

  const workbook: CatalogWorkbook | undefined = (workbooks.data ?? []).find(
    (candidate) => candidate.unit.slug === slug,
  );

  function openLesson(lesson: UnitLesson) {
    if (lesson.locked) {
      if (lesson.requiredPlan !== null) {
        openPaywall(lesson.requiredPlan);
      }
      return;
    }

    navigate(`/licoes/${lesson.slug}`);
  }

  function downloadWorkbook() {
    if (workbook === undefined) {
      return;
    }

    if (workbook.locked) {
      if (workbook.requiredPlan !== null) {
        openPaywall(workbook.requiredPlan);
      }
      return;
    }

    workbookFile.mutate(workbook.id, {
      onSuccess: (result) => {
        window.open(result.file.url, '_blank', 'noopener,noreferrer');
      },
    });
  }

  return {
    unit: unit.data,
    isLoading: unit.isLoading,
    isError: unit.isError,
    retry: () => void unit.refetch(),
    planLessonIds,
    lessonMarks,
    openLesson,
    workbook,
    downloadWorkbook,
    isDownloadingWorkbook: workbookFile.isPending,
    isCheckpointOpen,
    openCheckpoint: () => setCheckpointOpen(true),
    closeCheckpoint: () => setCheckpointOpen(false),
  };
}
