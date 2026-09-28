import type { CefrLevel, Competency } from '@english-saas/shared';

/**
 * O que o aluno já consegue fazer em cada nível, por competência — em pt-BR
 * e em frases curtas, para o resultado do nivelamento. Não existe isso em
 * `packages/shared` nem no back-end; é conteúdo próprio do front, escrito
 * com base no que cada faixa do CEFR tipicamente cobre.
 *
 * Só as 4 competências que o nivelamento mede
 * (`PLACEMENT_COMPETENCIES` no back-end) — escrita e fala ficam de fora.
 */
export const PLACEMENT_CAN_DO_COMPETENCIES = [
  'GRAMMAR',
  'VOCABULARY',
  'READING',
  'LISTENING',
] as const;

export type PlacementCanDoCompetency =
  (typeof PLACEMENT_CAN_DO_COMPETENCIES)[number];

export const PLACEMENT_CAN_DO: Record<
  PlacementCanDoCompetency,
  Record<CefrLevel, string>
> = {
  GRAMMAR: {
    A1: 'Usa frases bem simples e memorizadas, como se apresentar e fazer perguntas básicas.',
    A2: 'Forma frases simples no presente e no passado sobre rotina e experiências do dia a dia.',
    B1: 'Conecta frases para contar uma história ou explicar um plano, mesmo com alguns erros que não atrapalham o entendimento.',
    B2: 'Usa estruturas mais elaboradas com confiança, incluindo tempos verbais variados e frases condicionais.',
    C1: 'Varia a estrutura das frases com naturalidade, quase sem erros perceptíveis mesmo em assuntos complexos.',
  },
  VOCABULARY: {
    A1: 'Conhece palavras e expressões do dia a dia: números, cores, família, objetos comuns.',
    A2: 'Tem vocabulário suficiente para tarefas rotineiras e situações previsíveis, como compras e viagens simples.',
    B1: 'Consegue falar sobre a maioria dos temas do cotidiano, mesmo sem saber a palavra exata às vezes.',
    B2: 'Tem vocabulário amplo, incluindo expressões comuns, e raramente precisa parar para procurar uma palavra.',
    C1: 'Domina um vocabulário rico e preciso, incluindo termos mais técnicos e nuances de registro.',
  },
  READING: {
    A1: 'Entende textos muito curtos e simples, como placas, formulários e mensagens básicas.',
    A2: 'Lê textos curtos sobre assuntos familiares e encontra uma informação específica em material do dia a dia.',
    B1: 'Entende textos claros sobre assuntos conhecidos, inclusive descrições de eventos e sentimentos.',
    B2: 'Lê artigos e relatos sobre temas atuais com boa compreensão, incluindo o ponto de vista de quem escreveu.',
    C1: 'Entende textos longos e complexos, inclusive os mais especializados fora da própria área.',
  },
  LISTENING: {
    A1: 'Entende palavras e expressões bem conhecidas, ditas devagar e com clareza.',
    A2: 'Entende frases e vocabulário frequente sobre temas pessoais e do dia a dia.',
    B1: 'Acompanha os pontos principais de uma fala clara sobre assuntos familiares, mesmo em ritmo normal.',
    B2: 'Entende palestras e discussões mais longas, mesmo com alguma complexidade de estrutura.',
    C1: 'Entende fala extensa mesmo quando não está claramente estruturada, incluindo sotaques variados.',
  },
};

/** Escrita e fala não passam pelo nivelamento, então não têm can-do aqui. */
export function canDoFor(
  competency: Competency,
  level: CefrLevel,
): string | undefined {
  return (
    PLACEMENT_CAN_DO as Partial<Record<Competency, Record<CefrLevel, string>>>
  )[competency]?.[level];
}
