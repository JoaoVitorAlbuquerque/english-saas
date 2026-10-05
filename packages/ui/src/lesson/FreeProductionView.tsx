import { Loader2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { Chip } from '../components/Chip/Chip';
import { SpokenStandardToggle } from '../components/SpokenStandardToggle/SpokenStandardToggle';
import { Textarea } from '../components/Textarea/Textarea';

/** O que a correção devolve — só o que a tela mostra. */
export type FreeProductionResult = {
  corrected: string;
  encouragement: string;
  fixes: readonly {
    original: string;
    suggestion: string;
    explanationPtBr: string;
  }[];
  rubric: readonly { goalId: string; met: boolean; comment: string }[];
  registerTips: readonly { naturalSpokenForm: string; standardForm: string }[];
};

export type FreeProductionViewProps = {
  prompt: string;
  helpers: readonly string[];
  minWords?: number | undefined;
  /** O texto já foi enviado: trava a escrita e mostra o que vem depois. */
  submitted: boolean;
  /** A correção está a caminho. */
  isCorrecting: boolean;
  creditsExhausted: boolean;
  result: FreeProductionResult | null;
  /** Aviso quando a correção terminou sem resultado (recusada, falhou). */
  notice: string | null;
  onSubmit: (text: string) => void;
  /** Conclui a etapa com o texto do aluno — só depois de ele ver a correção. */
  onContinue: (text: string) => void;
  /** Preview do editor: o envio fica desligado. */
  submitDisabled?: boolean;
  /** Nota fixa sob o enunciado (ex.: "a correção por IA não roda aqui"). */
  footer?: ReactNode;
};

/** Etapa de produção livre: enunciado, ajudas, texto e a correção. */
export function FreeProductionView({
  prompt,
  helpers,
  minWords,
  submitted,
  isCorrecting,
  creditsExhausted,
  result,
  notice,
  onSubmit,
  onContinue,
  submitDisabled = false,
  footer,
}: FreeProductionViewProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount =
    text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

  function insertHelper(helper: string): void {
    setText((current) =>
      current.length === 0 ? helper : `${current} ${helper}`,
    );
    textareaRef.current?.focus();
  }

  function handleSubmit(): void {
    if (text.trim().length === 0 || submitted || submitDisabled) {
      return;
    }

    onSubmit(text.trim());
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <Card className="flex flex-col gap-3">
        <p className="text-ink">{prompt}</p>

        {helpers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {helpers.map((helper) => (
              <Chip
                key={helper}
                type="button"
                onClick={() => insertHelper(helper)}
                disabled={submitted}
              >
                {helper}
              </Chip>
            ))}
          </div>
        ) : null}

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={submitted}
          rows={5}
          aria-label="Sua resposta"
        />
        {minWords ? (
          <p className="text-xs text-muted">
            {wordCount} de {minWords} palavras
          </p>
        ) : null}

        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={text.trim().length === 0 || submitDisabled}
          >
            Enviar
          </Button>
        ) : null}

        {footer}
      </Card>

      {isCorrecting ? (
        <Card
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="size-4 animate-spin text-muted"
            aria-hidden="true"
          />
          <p className="text-sm text-muted">Corrigindo a sua resposta…</p>
        </Card>
      ) : null}

      {creditsExhausted ? (
        <Card role="alert" className="text-sm text-error">
          Você não tem créditos de IA agora. Sua resposta foi salva, mas não deu
          para corrigir desta vez.
        </Card>
      ) : null}

      {notice !== null && result === null ? (
        <Card role="status" className="text-sm text-muted">
          {notice}
        </Card>
      ) : null}

      {result ? (
        <Card className="flex flex-col gap-4">
          {result.fixes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {result.fixes.map((fix, index) => (
                <div key={index} className="text-sm">
                  <p>
                    <s className="text-muted">{fix.original}</s>{' '}
                    <span className="font-medium text-ink">
                      {fix.suggestion}
                    </span>
                  </p>
                  <p className="text-muted">{fix.explanationPtBr}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ok">Nenhum erro encontrado.</p>
          )}

          {result.rubric.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-line pt-3">
              {result.rubric.map((item) => (
                <div
                  key={item.goalId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Badge tone={item.met ? 'ok' : 'error'}>
                    {item.met ? 'Cumpriu' : 'Não cumpriu'}
                  </Badge>
                  <p className="text-ink">{item.comment}</p>
                </div>
              ))}
            </div>
          ) : null}

          {result.registerTips.map((tip, index) => (
            <SpokenStandardToggle
              key={index}
              spoken={tip.naturalSpokenForm}
              standard={tip.standardForm}
              className="border-t border-line pt-3"
            />
          ))}

          <div className="border-t border-line pt-3 text-sm">
            <p className="text-muted">Versão corrigida</p>
            <p className="text-ink">{result.corrected}</p>
          </div>

          <p className="text-sm text-muted">{result.encouragement}</p>
        </Card>
      ) : null}

      {submitted ? (
        <Button onClick={() => onContinue(text.trim())} className="self-end">
          Continuar
        </Button>
      ) : null}
    </div>
  );
}
