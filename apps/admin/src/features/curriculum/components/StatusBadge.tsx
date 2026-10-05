import type { ContentStatus } from '@english-saas/shared';
import { Badge, type BadgeTone } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

const TONES: Record<ContentStatus, BadgeTone> = {
  DRAFT: 'muted',
  IN_REVIEW: 'accent',
  APPROVED: 'accent',
  PUBLISHED: 'ok',
  ARCHIVED: 'muted',
};

/** O status sempre vem escrito — a cor sozinha não basta. */
export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge tone={TONES[status]}>{t(`content.status.${status}`)}</Badge>;
}
