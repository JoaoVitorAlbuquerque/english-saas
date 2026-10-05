import type {
  AnswerResult,
  LessonItem,
  ResolvedAsset,
} from '@english-saas/api-client';
import { PracticeView } from '@english-saas/ui';
import type { ItemAnswerPayload } from '@english-saas/ui';
import type { PracticeContent } from '@english-saas/shared';

export type PracticeStepProps = {
  content: PracticeContent;
  items: LessonItem[];
  assets: Record<string, ResolvedAsset>;
  answeredItemIds: string[];
  answers: Record<string, AnswerResult>;
  onAnswer: (itemId: string, payload: ItemAnswerPayload) => void;
  /** Resposta a caminho — trava a questão contra um segundo clique. */
  isSubmitting: boolean;
  onContinue: () => void;
};

/** A apresentação mora em `packages/ui` — o admin reaproveita no preview. */
export function PracticeStep(props: PracticeStepProps) {
  return <PracticeView {...props} />;
}
