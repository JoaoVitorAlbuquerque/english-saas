import { INGEST_MAX_CHARS, INGEST_MIN_CHARS } from '@english-saas/api-client';
import {
  Button,
  Card,
  cn,
  ErrorState,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { PlusSample } from '../components/PlusSample';
import { RequestProblemView } from '../components/RequestProblemView';
import {
  useIngestRequestController,
  type IngestTab,
  type LengthState,
} from './useIngestRequestController';

const NUMBER = new Intl.NumberFormat('pt-BR');

export function IngestRequest() {
  const {
    isGateLoading,
    isGateError,
    retryGate,
    isPlus,
    credits,
    timeZone,
    cost,
    tab,
    setTab,
    text,
    setText,
    url,
    setUrl,
    transcript,
    setTranscript,
    platform,
    typedLength,
    length,
    canSubmit,
    submit,
    isSubmitting,
    problem,
  } = useIngestRequestController();

  if (isGateLoading) {
    return <Skeleton className="h-48" />;
  }

  if (isGateError) {
    return <ErrorState title={t('tools.errorTitle')} onRetry={retryGate} />;
  }

  if (!isPlus) {
    return <PlusSample />;
  }

  const counter = <LengthCounter length={length} typedLength={typedLength} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl text-ink">{t('ingest.title')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as IngestTab)}>
        <TabsList>
          <TabsTrigger value="text">{t('ingest.tabText')}</TabsTrigger>
          <TabsTrigger value="link">{t('ingest.tabLink')}</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card className="flex flex-col gap-2">
            <Textarea
              label={t('ingest.textLabel')}
              hint={t('ingest.textHint')}
              value={text}
              rows={10}
              onChange={(event) => setText(event.target.value)}
            />
            {counter}
          </Card>
        </TabsContent>

        <TabsContent value="link">
          <Card className="flex flex-col gap-3">
            <Input
              type="url"
              inputMode="url"
              label={t('ingest.linkLabel')}
              hint={t('ingest.linkHint')}
              placeholder={t('ingest.linkPlaceholder')}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />

            {platform !== null ? (
              <div className="flex flex-col gap-2">
                <div
                  role="status"
                  className="rounded-xl border border-chunk bg-chunk-bg p-3"
                >
                  <p className="text-sm font-medium text-ink">
                    {t('ingest.socialTitle')}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {t('ingest.socialDescription', { platform })}
                  </p>
                </div>
                <Textarea
                  label={t('ingest.transcriptLabel')}
                  value={transcript}
                  rows={8}
                  onChange={(event) => setTranscript(event.target.value)}
                />
                {counter}
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      <RequestProblemView
        problem={problem}
        credits={credits}
        timeZone={timeZone}
      />

      <div className="flex flex-col gap-1">
        <Button
          className="w-full sm:w-auto sm:self-start"
          disabled={!canSubmit}
          isLoading={isSubmitting}
          onClick={submit}
        >
          {t('ingest.submit')}
        </Button>
        <span className="font-mono text-xs text-muted">
          {t('tools.cost', { cost })}
        </span>
      </div>
    </div>
  );
}

function LengthCounter({
  length,
  typedLength,
}: {
  length: LengthState;
  typedLength: number;
}) {
  const problem =
    length.kind === 'too-short'
      ? t('ingest.tooShort', { count: NUMBER.format(length.missing) })
      : length.kind === 'too-long'
        ? t('ingest.tooLong', { count: NUMBER.format(length.over) })
        : t('ingest.limits', {
            min: NUMBER.format(INGEST_MIN_CHARS),
            max: NUMBER.format(INGEST_MAX_CHARS),
          });

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span
        className={cn(length.kind === 'too-long' ? 'text-error' : 'text-muted')}
      >
        {problem}
      </span>
      <span
        aria-label="Tamanho do texto"
        className={cn(
          'font-mono',
          length.kind === 'too-long' ? 'text-error' : 'text-muted',
        )}
      >
        {t('ingest.counter', {
          count: NUMBER.format(typedLength),
          max: NUMBER.format(INGEST_MAX_CHARS),
        })}
      </span>
    </div>
  );
}
