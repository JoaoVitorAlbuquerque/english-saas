import { useState, type ReactNode } from 'react';

import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { CharacterAvatar } from '../components/CharacterAvatar/CharacterAvatar';
import { Chip } from '../components/Chip/Chip';
import { Input } from '../components/Input/Input';

export type RoleplayCorrection = {
  original: string;
  suggestion: string;
  explanationPtBr: string;
};

export type RoleplayTurn = {
  index: number;
  role: 'STUDENT' | 'CHARACTER';
  text: string;
  status: 'DONE' | 'PENDING' | 'FAILED';
  feedback: {
    helpPhrase: string | null;
    inlineCorrection: { original: string; suggestion: string } | null;
  } | null;
};

export type RoleplaySummaryData = {
  goals: readonly { id: string; description: string; met: boolean }[];
  topCorrections: readonly RoleplayCorrection[];
  expressionSkillIds: readonly string[];
};

export type RoleplayViewProps = {
  /** Cenário da etapa, em pt-BR. */
  scenario: string;
  characterName: string;
  goals: readonly { id: string; description: string; met: boolean }[];
  turns: readonly RoleplayTurn[];
  turnsLeft: number;
  finished: boolean;
  summary: RoleplaySummaryData | null;
  /** Título da skill para a lista de expressões do resumo. */
  skillTitle: (skillId: string) => string;
  onSend: (text: string) => void;
  onFinish: () => void;
  onContinue: () => void;
  /** Preview do editor: a conversa não anda. */
  readOnly?: boolean;
  /** Nota fixa sob o campo de resposta. */
  footer?: ReactNode;
};

/** Etapa de roleplay: cenário, metas, conversa e o resumo do fim. */
export function RoleplayView({
  scenario,
  characterName,
  goals,
  turns,
  turnsLeft,
  finished,
  summary,
  skillTitle,
  onSend,
  onFinish,
  onContinue,
  readOnly = false,
  footer,
}: RoleplayViewProps) {
  const [text, setText] = useState('');

  const lastCharacterTurn = [...turns]
    .reverse()
    .find((turn) => turn.role === 'CHARACTER' && turn.feedback);
  const helpPhrase = lastCharacterTurn?.feedback?.helpPhrase ?? null;
  const hasPendingTurn = turns.some((turn) => turn.status === 'PENDING');
  const inputBlocked = readOnly || hasPendingTurn || turnsLeft <= 0;

  function handleSend(): void {
    if (inputBlocked || text.trim().length === 0) {
      return;
    }

    onSend(text.trim());
    setText('');
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <p className="text-sm text-ink">{scenario}</p>

      <div className="flex flex-wrap gap-2">
        {goals.map((goal) => (
          <Badge key={goal.id} tone={goal.met ? 'ok' : 'muted'}>
            {goal.description}
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {turns.map((turn) => (
          <div
            key={turn.index}
            className={`flex items-start gap-2 ${turn.role === 'STUDENT' ? 'flex-row-reverse' : ''}`}
          >
            {turn.role === 'CHARACTER' ? (
              <CharacterAvatar name={characterName} size="sm" />
            ) : null}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                turn.role === 'STUDENT'
                  ? 'bg-accent text-white'
                  : 'border border-line bg-surface text-ink'
              }`}
            >
              {turn.status === 'PENDING' ? '…' : turn.text}
              {turn.feedback?.inlineCorrection ? (
                <p className="mt-1 text-xs text-muted">
                  {turn.feedback.inlineCorrection.original} →{' '}
                  {turn.feedback.inlineCorrection.suggestion}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!finished ? (
        <div className="flex flex-col gap-2">
          {helpPhrase ? (
            <Chip
              type="button"
              onClick={() => setText(helpPhrase)}
              disabled={readOnly}
            >
              Ajuda: {helpPhrase}
            </Chip>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escreva sua resposta"
              aria-label="Escreva sua resposta"
              disabled={inputBlocked}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={inputBlocked || text.trim().length === 0}
            >
              Enviar
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onFinish}
            disabled={readOnly}
            className="self-end"
          >
            Encerrar conversa
          </Button>
          {footer}
        </div>
      ) : null}

      {finished && summary ? (
        <Card className="flex flex-col gap-3">
          <h3 className="font-display text-lg text-ink">Como foi a conversa</h3>

          <div className="flex flex-col gap-1">
            {summary.goals.map((goal) => (
              <div key={goal.id} className="flex items-center gap-2 text-sm">
                <Badge tone={goal.met ? 'ok' : 'error'}>
                  {goal.met ? 'Cumpriu' : 'Não cumpriu'}
                </Badge>
                <p className="text-ink">{goal.description}</p>
              </div>
            ))}
          </div>

          {summary.topCorrections.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              {summary.topCorrections.map((correction, index) => (
                <div key={index} className="text-sm">
                  <p>
                    <s className="text-muted">{correction.original}</s>{' '}
                    <span className="text-ink">{correction.suggestion}</span>
                  </p>
                  <p className="text-muted">{correction.explanationPtBr}</p>
                </div>
              ))}
            </div>
          ) : null}

          {summary.expressionSkillIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {summary.expressionSkillIds.map((skillId) => (
                <Badge key={skillId} tone="accent">
                  {skillTitle(skillId)}
                </Badge>
              ))}
            </div>
          ) : null}

          <Button onClick={onContinue} className="self-end">
            Continuar
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
