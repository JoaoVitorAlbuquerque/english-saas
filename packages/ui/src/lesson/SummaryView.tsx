import type { SummaryContent } from '@english-saas/shared';

import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';

export type SummaryViewProps = {
  content: SummaryContent;
  /** `COMPLETED`: a lição já foi concluída e a tela mostra o resultado. */
  completed: boolean;
  onFinish: () => void;
  isFinishing: boolean;
  /** Só com `completed`. */
  xp: number;
  /** Percentual de acerto de 0 a 100; `null` quando não houve resposta. */
  accuracy: number | null;
  nextLesson: { title: string } | null;
  onStartNextLesson: () => void;
  onGoToPlan: () => void;
  onRestart: () => void;
  isRestarting: boolean;
  /** Preview do editor: concluir fica desligado. */
  finishDisabled?: boolean;
};

/** Etapa final: o que o aluno leva, e o resultado depois de concluir. */
export function SummaryView({
  content,
  completed,
  onFinish,
  isFinishing,
  xp,
  accuracy,
  nextLesson,
  onStartNextLesson,
  onGoToPlan,
  onRestart,
  isRestarting,
  finishDisabled = false,
}: SummaryViewProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">O que você aprendeu</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {content.takeaways.map((takeaway, index) => (
            <li key={index}>{takeaway}</li>
          ))}
        </ul>
      </Card>

      {!completed ? (
        <Button
          onClick={onFinish}
          isLoading={isFinishing}
          disabled={finishDisabled}
          className="self-end"
        >
          Concluir lição
        </Button>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Badge tone="accent">{xp} XP</Badge>
              {accuracy !== null ? (
                <Badge tone="ok">{accuracy}% de acerto</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted">
              O que você praticou aqui entra na sua revisão espaçada nos
              próximos dias.
            </p>
          </Card>

          {nextLesson !== null ? (
            <Card className="flex flex-col gap-2">
              <p className="text-sm text-muted">Próxima lição do seu plano</p>
              <p className="text-ink">{nextLesson.title}</p>
              <div className="flex gap-2">
                <Button onClick={onStartNextLesson} className="self-start">
                  Fazer agora
                </Button>
                <Button
                  variant="ghost"
                  onClick={onGoToPlan}
                  className="self-start"
                >
                  Ver meu plano
                </Button>
              </div>
            </Card>
          ) : null}

          <Button
            variant="ghost"
            onClick={onRestart}
            isLoading={isRestarting}
            className="self-end"
          >
            Refazer
          </Button>
        </>
      )}
    </div>
  );
}
