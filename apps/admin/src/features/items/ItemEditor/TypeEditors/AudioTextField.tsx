import { AudioButton, Textarea } from '@english-saas/ui';
import type { ReactNode } from 'react';

import { t } from '../../../../messages/pt-BR';
import { issuesAt } from '../../../curriculum/lib/validation';
import type { TypeEditorProps } from './types';

/**
 * O texto que a voz fala (escuta e ditado) e o estado do áudio. Não há botão
 * de gerar: o áudio nasce quando a lição que usa o item é aprovada. Mudar o
 * texto solta o áudio que já existia (o reducer faz isso), e o aviso aqui
 * deixa claro que ele será refeito.
 */
export function AudioTextField({
  content,
  onChange,
  issues,
  readOnly,
  audioUrl,
  children,
}: TypeEditorProps & { children?: ReactNode }) {
  const audioText = (content.audioText as string | undefined) ?? '';
  const hasAsset = typeof content.audioAssetId === 'string';

  return (
    <section className="space-y-3" aria-label={t('items.audio.title')}>
      <h3 className="font-display text-lg text-ink">
        {t('items.audio.title')}
      </h3>
      <Textarea
        label={t('items.audio.text')}
        hint={t('items.audio.textHint')}
        value={audioText}
        readOnly={readOnly}
        rows={2}
        onChange={(event) =>
          onChange({ ...content, audioText: event.target.value })
        }
        error={issuesAt(issues, 'content.audioText')[0]}
        data-field="content.audioText"
      />
      <div className="flex items-center gap-3 rounded-lg bg-ground px-3 py-2">
        {hasAsset && audioUrl ? (
          <>
            <AudioButton
              src={audioUrl}
              label={t('items.audio.listen')}
              className="size-8"
            />
            <span className="text-xs text-muted">{t('items.audio.has')}</span>
          </>
        ) : (
          <span className="text-xs text-muted">{t('items.audio.none')}</span>
        )}
      </div>
      {children}
    </section>
  );
}
