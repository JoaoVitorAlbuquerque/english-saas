import { toStudentItem } from '@english-saas/shared';
import {
  Button,
  ItemRenderer,
  toItemView,
  type RawStudentItem,
} from '@english-saas/ui';
import { useMemo, useState } from 'react';

import { t } from '../../../../messages/pt-BR';
import { buildPreviewFeedback } from '../../../curriculum/lib/preview-feedback';
import {
  cleanContent,
  snapshotOf,
  type ItemFormState,
} from '../../lib/item-form';
import { contentIsRenderable } from '../../lib/item-validation';

const SPEAKING_TYPES = ['LISTEN_CHOOSE', 'DICTATION'];

/**
 * O item como o aluno o vê, desenhado pelo mesmo `ItemRenderer` do app.
 *
 * Roda **no navegador**, em cima do que está no formulário — não vai ao
 * servidor, então acompanha cada tecla. A visão do aluno sai de
 * `toStudentItem` (a mesma função da API): o gabarito nunca entra nela, e só o
 * "Ver gabarito" o mostra, montado do próprio formulário.
 *
 * Responder não corrige nada: o preview não manda resposta a lugar nenhum.
 * Enquanto o conteúdo não passa no schema do tipo, mostra o aviso em vez de
 * tentar desenhar um item pela metade.
 */
export function ItemPreview({
  state,
  audioUrl,
}: {
  state: ItemFormState;
  /** URL do áudio já gerado, se o item tem um. */
  audioUrl: string | null;
}) {
  const [showKey, setShowKey] = useState(false);
  const renderable = contentIsRenderable(state);
  const cleaned = useMemo(
    () => cleanContent(state.type, state.content),
    [state.type, state.content],
  );
  // O que muda o desenho reinicia a questão (resposta já dada, ordem sorteada).
  const stamp = snapshotOf(state);

  if (!renderable) {
    return (
      <p className="rounded-lg bg-ground px-3 py-4 text-sm text-muted">
        {t('items.preview.incomplete')}
      </p>
    );
  }

  const student = toStudentItem({
    id: 'preview',
    type: state.type,
    prompt: state.prompt,
    content: cleaned,
    cefrLevel: state.cefrLevel,
    skillIds: state.skillIds,
  });
  const raw: RawStudentItem = {
    id: student.id,
    type: student.type,
    prompt: student.prompt,
    content: student.content,
  };
  const assetId = cleaned.audioAssetId;
  const assets =
    typeof assetId === 'string' ? { [assetId]: { url: audioUrl ?? '' } } : {};
  const view = toItemView(raw, assets);
  const needsAudio =
    SPEAKING_TYPES.includes(state.type) && typeof assetId !== 'string';

  return (
    <div className="space-y-3">
      <div
        data-testid="item-preview"
        className="mx-auto w-full max-w-md rounded-2xl border border-line bg-ground p-4"
      >
        {showKey ? (
          <ItemRenderer
            key={`key-${stamp}`}
            item={view}
            mode="preview"
            feedback={buildPreviewFeedback({
              type: state.type,
              content: cleaned,
              acceptedAnswers: state.acceptedAnswers,
              explanation: state.explanation,
            })}
          />
        ) : (
          <ItemRenderer
            key={`practice-${stamp}`}
            item={view}
            mode="practice"
            onAnswer={() => undefined}
          />
        )}
      </div>

      {needsAudio ? (
        <p className="rounded-lg bg-ground px-3 py-2 text-xs text-muted">
          {t('items.preview.noAudio')}
        </p>
      ) : null}
      <p className="rounded-lg bg-ground px-3 py-2 text-xs text-muted">
        {t('items.preview.note')}
      </p>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowKey((current) => !current)}
      >
        {showKey ? t('items.preview.hideKey') : t('items.preview.showKey')}
      </Button>
    </div>
  );
}
