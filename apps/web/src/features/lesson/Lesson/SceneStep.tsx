import type { CatalogLesson, ResolvedAsset } from '@english-saas/api-client';
import { SceneView } from '@english-saas/ui';
import type { SceneContent } from '@english-saas/shared';

export type SceneStepProps = {
  content: SceneContent;
  characters: CatalogLesson['characters'];
  assets: Record<string, ResolvedAsset>;
  onContinue: () => void;
};

/** A apresentação mora em `packages/ui` — o admin reaproveita no preview. */
export function SceneStep(props: SceneStepProps) {
  return <SceneView {...props} />;
}
