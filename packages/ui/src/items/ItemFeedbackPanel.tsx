import type { RegisterNote } from '@english-saas/shared';
import { Check, CircleAlert, X } from 'lucide-react';

import { Badge } from '../components/Badge/Badge';
import { Card } from '../components/Card/Card';
import { SpokenStandardToggle } from '../components/SpokenStandardToggle/SpokenStandardToggle';
import type { ItemFeedback } from './types';

export type ItemFeedbackPanelProps = {
  feedback: ItemFeedback;
  /** Só para REGISTER_SWAP — a nota de registro do item, resolvida pela tela. */
  registerNote?: RegisterNote;
};

const VERDICT_CONTENT = {
  CORRECT: { tone: 'ok' as const, label: 'Certo', Icon: Check },
  PARTIAL: { tone: 'accent' as const, label: 'Quase', Icon: CircleAlert },
  INCORRECT: { tone: 'error' as const, label: 'Errou', Icon: X },
};

function CorrectAnswerLine({
  correctAnswer,
}: Pick<ItemFeedback, 'correctAnswer'>) {
  if ('pairs' in correctAnswer) {
    return (
      <ul className="mt-1 flex flex-col gap-0.5 text-ink">
        {correctAnswer.pairs.map((pair) => (
          <li key={`${pair.left}-${pair.right}`}>
            {pair.left} → {pair.right}
          </li>
        ))}
      </ul>
    );
  }

  const text =
    'texts' in correctAnswer
      ? correctAnswer.texts.join(' / ')
      : correctAnswer.text;

  return <p className="mt-1 font-medium text-ink">{text}</p>;
}

/** Banner de correção — usado após responder (practice) e sempre em preview. */
export function ItemFeedbackPanel({
  feedback,
  registerNote,
}: ItemFeedbackPanelProps) {
  const { tone, label, Icon } = VERDICT_CONTENT[feedback.verdict];

  return (
    <Card className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <Badge tone={tone} className="gap-1">
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </Badge>
        <p className="text-sm text-ink">{feedback.feedback}</p>
      </div>

      {feedback.verdict !== 'CORRECT' ? (
        <div className="text-sm">
          <p className="text-muted">Resposta certa</p>
          <CorrectAnswerLine correctAnswer={feedback.correctAnswer} />
        </div>
      ) : null}

      <p className="text-sm text-muted">{feedback.explanation}</p>

      {registerNote ? (
        <SpokenStandardToggle
          spoken={registerNote.spokenForm}
          standard={registerNote.standardForm}
        />
      ) : null}

      {feedback.errorPatterns && feedback.errorPatterns.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-line pt-3">
          {feedback.errorPatterns.map((pattern) => (
            <li key={pattern.id} className="text-sm">
              <p className="text-ink">{pattern.description}</p>
              <p className="text-muted">{pattern.explanation}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
