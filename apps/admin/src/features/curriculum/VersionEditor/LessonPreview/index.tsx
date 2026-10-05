import {
  LESSON_STEP_TYPE_LABELS,
  type LessonStepType,
} from '@english-saas/shared';
import {
  Card,
  ErrorState,
  ExplanationCardsView,
  FreeProductionView,
  RoleplayView,
  SceneView,
  Skeleton,
  SummaryView,
  cn,
  type LessonAssets,
  type LessonCharacter,
} from '@english-saas/ui';
import { Monitor, Smartphone } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { describePath } from '../../lib/validation';
import { PracticePreview } from './PracticePreview';
import {
  useLessonPreviewController,
  type PreviewStep,
} from './useLessonPreviewController';

const noop = () => undefined;

function InvalidStep({ step }: { step: Extract<PreviewStep, { ok: false }> }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card role="status" className="space-y-2">
        <h3 className="font-display text-lg text-ink">
          {t('preview.invalid.title')}
        </h3>
        <p className="text-sm text-muted">{t('preview.invalid.description')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {step.issues.slice(0, 4).map((issue, index) => (
            <li key={`${issue.path}-${String(index)}`}>
              {issue.path === ''
                ? issue.message
                : `${describePath(step.type as LessonStepType, issue.path)}: ${issue.message}`}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ValidStep({
  step,
  characters,
  assets,
  items,
  skillTitle,
  onContinue,
}: {
  step: Extract<PreviewStep, { ok: true }>['step'];
  characters: LessonCharacter[];
  assets: LessonAssets;
  items: Parameters<typeof PracticePreview>[0]['items'];
  skillTitle: (id: string) => string;
  onContinue: () => void;
}) {
  switch (step.type) {
    case 'SCENE':
      return (
        <SceneView
          content={step.content}
          characters={characters}
          assets={assets}
          onContinue={onContinue}
        />
      );

    case 'EXPLANATION_CARDS':
      return (
        <ExplanationCardsView content={step.content} onContinue={onContinue} />
      );

    case 'PRACTICE':
      return (
        <PracticePreview
          itemIds={step.content.itemIds}
          items={items}
          assets={assets}
          onContinue={onContinue}
        />
      );

    case 'FREE_PRODUCTION':
      return (
        <FreeProductionView
          prompt={step.content.prompt}
          helpers={step.content.helpers}
          minWords={step.content.minWords}
          submitted={false}
          isCorrecting={false}
          creditsExhausted={false}
          result={null}
          notice={null}
          onSubmit={noop}
          onContinue={onContinue}
          submitDisabled
          footer={
            <p className="rounded-lg bg-ground px-3 py-2 text-xs text-muted">
              {t('preview.aiNote')}
            </p>
          }
        />
      );

    case 'ROLEPLAY':
      return (
        <RoleplayView
          scenario={step.content.scenario}
          characterName={
            characters.find((entry) => entry.id === step.content.characterId)
              ?.name ?? ''
          }
          goals={step.content.goals.map((goal) => ({
            id: goal.id,
            description: goal.description,
            met: false,
          }))}
          turns={
            step.content.openingLine
              ? [
                  {
                    index: 0,
                    role: 'CHARACTER',
                    text: step.content.openingLine,
                    status: 'DONE',
                    feedback: null,
                  },
                ]
              : []
          }
          turnsLeft={step.content.maxTurns}
          finished={false}
          summary={null}
          skillTitle={skillTitle}
          onSend={noop}
          onFinish={noop}
          onContinue={onContinue}
          readOnly
          footer={
            <p className="rounded-lg bg-ground px-3 py-2 text-xs text-muted">
              {t('preview.roleplayNote')}
            </p>
          }
        />
      );

    case 'SUMMARY':
      return (
        <div>
          <SummaryView
            content={step.content}
            completed={false}
            onFinish={noop}
            isFinishing={false}
            xp={0}
            accuracy={null}
            nextLesson={null}
            onStartNextLesson={noop}
            onGoToPlan={noop}
            onRestart={noop}
            isRestarting={false}
            finishDisabled
          />
          <p className="mx-auto max-w-2xl px-4 text-xs text-muted">
            {t('preview.summaryNote')}
          </p>
        </div>
      );
  }
}

/**
 * A lição **exatamente como o aluno vê**, num quadro do tamanho de celular
 * (390 px) ou de desktop. Usa as mesmas telas do player (`packages/ui`), com
 * os dados do servidor: áudio assinado, personagens, questões sem gabarito.
 * Produção livre e conversa mostram o estado de entrada — a IA não é chamada.
 */
export function LessonPreview({
  versionId,
  savedAt,
}: {
  versionId: string;
  savedAt: number | null;
}) {
  const controller = useLessonPreviewController({ versionId, savedAt });
  const current = controller.steps[controller.position];

  return (
    <section aria-label={t('preview.title')} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-ink">{t('preview.title')}</h2>
        <div
          role="group"
          aria-label={t('preview.devices')}
          className="inline-flex rounded-lg border border-line p-0.5"
        >
          {(
            [
              ['phone', t('preview.device.phone'), Smartphone],
              ['desktop', t('preview.device.desktop'), Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={controller.device === value}
              onClick={() => controller.setDevice(value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium',
                controller.device === value
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-ground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {controller.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : controller.error || controller.data === null ? (
        <ErrorState
          title={t('preview.loadError')}
          description={controller.error?.message}
          onRetry={controller.retry}
        />
      ) : controller.steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {t('preview.empty')}
        </p>
      ) : (
        <>
          <nav
            aria-label={t('preview.steps')}
            className="flex flex-wrap items-center gap-1"
          >
            {controller.steps.map((step, index) => {
              const type = (
                step.ok ? step.step.type : step.type
              ) as LessonStepType;

              return (
                <button
                  key={step.order}
                  type="button"
                  aria-current={
                    index === controller.position ? 'step' : undefined
                  }
                  onClick={() => controller.select(index)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium',
                    index === controller.position
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:bg-ground',
                    !step.ok && 'border-error/40 text-error',
                  )}
                >
                  {t('preview.step', {
                    position: index + 1,
                    type: LESSON_STEP_TYPE_LABELS[type],
                  })}
                </button>
              );
            })}
            {controller.isRefreshing ? (
              <span role="status" className="ml-2 text-xs text-muted">
                {t('preview.refreshing')}
              </span>
            ) : null}
          </nav>

          <div
            data-testid="preview-frame"
            data-device={controller.device}
            className={cn(
              'mx-auto h-[640px] overflow-y-auto rounded-3xl border-4 border-line bg-ground',
              controller.device === 'phone' ? 'w-[390px] max-w-full' : 'w-full',
            )}
          >
            {current === undefined ? null : current.ok ? (
              <ValidStep
                key={`${current.order}-${controller.position}`}
                step={current.step}
                characters={controller.data.characters}
                assets={controller.data.assets}
                items={controller.data.items}
                skillTitle={(id) =>
                  controller.data?.targetSkills.find((skill) => skill.id === id)
                    ?.title ?? id
                }
                onContinue={controller.next}
              />
            ) : (
              <InvalidStep step={current} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
