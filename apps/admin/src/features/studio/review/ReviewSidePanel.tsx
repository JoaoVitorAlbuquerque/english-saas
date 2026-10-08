import type { ContentStatus } from '@english-saas/shared';
import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { LessonPreview } from '../../curriculum/VersionEditor/LessonPreview';
import type { QaStep } from '../lib/qa-path';
import { AudioPanel } from './AudioPanel';
import { CommentsPanel } from './CommentsPanel';
import { QaPanel, type QaJumps } from './QaPanel';
import { useCommentsController } from './useCommentsController';
import {
  REVIEW_TABS,
  type ReviewTab,
  type ReviewWorkspace,
} from './useReviewWorkspace';

function CommentsTab({
  workspace,
  versionId,
  steps,
}: {
  workspace: ReviewWorkspace;
  versionId: string;
  steps: readonly QaStep[];
}) {
  const controller = useCommentsController({
    versionId,
    steps,
    about: workspace.about,
    setAbout: workspace.setAbout,
  });

  return <CommentsPanel controller={controller} steps={steps} />;
}

function Count({ value, tone }: { value: number; tone: 'error' | 'muted' }) {
  return value > 0 ? (
    <Badge tone={tone} className="ml-1.5">
      {value}
    </Badge>
  ) : null;
}

/**
 * A coluna da direita do editor: preview, revisão automática, comentários e
 * áudio, cada um numa aba com o contador do que pede atenção.
 */
export function ReviewSidePanel({
  workspace,
  versionId,
  status,
  level,
  steps,
  savedAt,
  jumps,
}: {
  workspace: ReviewWorkspace;
  versionId: string;
  status: ContentStatus;
  level: string;
  steps: readonly QaStep[];
  savedAt: number | null;
  jumps: QaJumps;
}) {
  const editable =
    status === 'DRAFT' || status === 'IN_REVIEW' || status === 'APPROVED';

  return (
    <Tabs
      value={workspace.tab}
      onValueChange={(value) => workspace.setTab(value as ReviewTab)}
    >
      <TabsList aria-label={t('studio.panel.tabs')} className="flex-wrap">
        {REVIEW_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {t(`studio.panel.tab.${tab}`)}
            {tab === 'revisao' ? (
              <>
                <Count value={workspace.qa.blockers.length} tone="error" />
                {workspace.qa.blockers.length > 0 ? (
                  <span className="sr-only">
                    {t('studio.panel.blockersSr')}
                  </span>
                ) : null}
              </>
            ) : null}
            {tab === 'comentarios' ? (
              <Count value={workspace.openComments} tone="muted" />
            ) : null}
            {tab === 'audio' ? (
              <Count
                value={workspace.audio.pending + workspace.audio.openIssues}
                tone="error"
              />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="preview">
        <LessonPreview versionId={versionId} savedAt={savedAt} />
      </TabsContent>
      <TabsContent value="revisao">
        <QaPanel
          controller={workspace.qa}
          level={level}
          jumps={jumps}
          canRun={editable}
        />
      </TabsContent>
      <TabsContent value="comentarios">
        <CommentsTab
          workspace={workspace}
          versionId={versionId}
          steps={steps}
        />
      </TabsContent>
      <TabsContent value="audio">
        <AudioPanel controller={workspace.audio} status={status} />
      </TabsContent>
    </Tabs>
  );
}
