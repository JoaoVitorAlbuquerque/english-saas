import { Button } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import type { QaJumps } from './QaPanel';
import type { AudioController } from './useAudioController';
import type { QaController } from './useQaController';

/**
 * Por que "Aprovar" está desabilitado: a lista do que falta (os bloqueadores
 * do último relatório, cada um com o caminho até o trecho) e o caminho para
 * resolver — corrigir e rodar a revisão de novo.
 */
export function ApproveBlockedNote({
  qa,
  jumps,
}: {
  qa: QaController;
  jumps: QaJumps;
}) {
  return (
    <div
      role="status"
      className="space-y-2 rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-ink"
    >
      <p className="font-medium text-error">
        {t('studio.guard.approve.title', { count: qa.blockers.length })}
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {qa.blockers.map((blocker, index) => {
          const location = blocker.location;

          return (
            <li key={`${blocker.code}-${blocker.path ?? ''}-${String(index)}`}>
              <span>{blocker.message}</span>{' '}
              <span className="text-xs text-muted">({location.label})</span>{' '}
              {location.kind === 'step' ? (
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() =>
                    jumps.onJumpStep(location.stepOrder, location.fieldPath)
                  }
                >
                  {t('studio.qa.goToText')}
                </button>
              ) : location.kind === 'item' && location.itemId !== null ? (
                <Link
                  to={`/conteudo/questoes/${location.itemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {t('studio.qa.openItem')}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        {qa.stale
          ? t('studio.guard.approve.stale')
          : t('studio.guard.approve.hint')}
      </p>
      <Button
        size="sm"
        variant="ghost"
        isLoading={qa.isRunning}
        onClick={qa.run}
      >
        {qa.isRunning ? t('studio.qa.running') : t('studio.qa.run')}
      </Button>
      {qa.runError ? (
        <p role="alert" className="text-sm text-error">
          {qa.runError.message}
        </p>
      ) : null}
    </div>
  );
}

/** Por que "Publicar" está desabilitado: falta áudio — quantos e onde ver. */
export function PublishBlockedNote({
  audio,
  onOpenAudio,
}: {
  audio: AudioController;
  onOpenAudio: () => void;
}) {
  const missing = audio.targets.filter((target) => target.audio === null);

  return (
    <div
      role="status"
      className="space-y-2 rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-ink"
    >
      <p className="font-medium text-error">
        {t('studio.guard.publish.title', { count: audio.pending })}
      </p>
      {missing.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {missing.slice(0, 5).map((target) => (
            <li key={target.key}>
              {target.label === null ? '' : `${target.label}: `}
              <span lang="en">{target.text}</span>
            </li>
          ))}
          {missing.length > 5 ? (
            <li>
              {t('studio.guard.publish.more', { count: missing.length - 5 })}
            </li>
          ) : null}
        </ul>
      ) : null}
      <p className="text-xs text-muted">{t('studio.guard.publish.hint')}</p>
      <Button size="sm" variant="ghost" onClick={onOpenAudio}>
        {t('studio.guard.publish.open')}
      </Button>
    </div>
  );
}
