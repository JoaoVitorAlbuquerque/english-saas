import type { Span } from '@english-saas/shared';
import { Badge, Card, MarkedText } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LINK_BUTTON_CLASS } from './link-button';

/**
 * Pedaço de um material de verdade, fixo no front — o que quem não é Plus vê
 * no lugar das ferramentas. Nada aqui chama a API.
 */
const SAMPLE_TEXT =
  "In 1519, Ferdinand Magellan left Spain with five ships. He wanted to find a new route to the Spice Islands. The trip was very hard, and many sailors didn't come back.";

/** Marcação pelo trecho, com o índice calculado — igual ao que o back faz. */
function mark(
  phrase: string,
  kind: Span['kind'],
  explanation: string,
): Span & { explanation: string } {
  const start = SAMPLE_TEXT.indexOf(phrase);
  return { start, end: start + phrase.length, kind, explanation };
}

const SAMPLE_SPANS = [
  mark(
    'Ferdinand Magellan left Spain',
    'GRAMMAR',
    'Passado simples irregular: "leave" vira "left". Fato que começou e terminou no passado.',
  ),
  mark(
    'Spice Islands',
    'VOCAB',
    'Spice Islands: as Ilhas das Especiarias (Molucas).',
  ),
  mark(
    "didn't come back",
    'REGISTER',
    `"didn't come back" é o jeito natural; num texto formal, "did not return".`,
  ),
];

export function PlusSample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl text-ink">
          {t('tools.sample.title')}
        </h1>
        <p className="text-sm text-muted">{t('tools.sample.description')}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ink">
            Magellan and the first trip around the world
          </h2>
          <Badge tone="accent">{t('tools.sample.badge')} · A2</Badge>
        </div>
        <MarkedText
          text={SAMPLE_TEXT}
          spans={SAMPLE_SPANS}
          describeSpan={(span) =>
            SAMPLE_SPANS.find((entry) => entry.start === span.start)
              ?.explanation ?? null
          }
          className="text-base leading-relaxed text-ink"
        />
        <p className="text-xs text-muted">
          {t('material.basedOn')} Wikipedia — Ferdinand Magellan, CC BY-SA
        </p>
        <div className="rounded-xl bg-ground p-3">
          <p className="text-sm font-medium text-ink">
            {t('material.spotlightTitle')}: Past simple (irregular)
          </p>
          <p className="mt-1 text-sm text-muted">
            &ldquo;Magellan left Spain&rdquo; · &ldquo;many sailors didn&apos;t
            come back&rdquo;
          </p>
        </div>
      </Card>

      <Link to="/planos" className={LINK_BUTTON_CLASS}>
        {t('tools.sample.cta')}
      </Link>
    </div>
  );
}
