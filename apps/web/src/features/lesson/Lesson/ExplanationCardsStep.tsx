import { ExplanationCardsView } from '@english-saas/ui';
import type { ExplanationCardsContent } from '@english-saas/shared';

export type ExplanationCardsStepProps = {
  content: ExplanationCardsContent;
  onContinue: () => void;
};

/** A apresentação mora em `packages/ui` — o admin reaproveita no preview. */
export function ExplanationCardsStep(props: ExplanationCardsStepProps) {
  return <ExplanationCardsView {...props} />;
}
