import type { AnswerResponse } from '@english-saas/shared';
import type { ItemView } from '@english-saas/ui';

/**
 * "Não sei" não existe no back-end do nivelamento — não há campo de pular
 * em `AssessmentAnswerDto`. Toda resposta precisa ter o formato válido da
 * família do item, então cada família ganha uma resposta que ou é
 * garantidamente errada, ou é a única opção neutra disponível sem conhecer
 * o gabarito (que o aluno nunca vê antes de responder):
 *
 * - **Escolha**: manda todas as alternativas. `evaluateChoice` exige o
 *   conjunto exatamente igual ao gabarito — como nenhum item autorado tem
 *   todas as alternativas certas, isso erra sempre, sem chute.
 * - **Digitado**: `{text: ''}`. `matchesAnswer` trata string vazia como
 *   errada sempre, de propósito (`answer-normalization.ts` do back-end).
 * - **ORDER_WORDS**: os tokens na ordem em que a questão os entregou, sem
 *   reorganizar — só bateria com o gabarito se a ordem embaralhada da
 *   autoria já fosse por acaso a frase certa, o que não acontece nas
 *   questões reais (a autoria embaralha de propósito).
 * - **MATCH**: liga pela posição. Sem o gabarito não tem como garantir
 *   erro aqui — é a única opção neutra disponível.
 */
export function buildDontKnowResponse(item: ItemView): AnswerResponse {
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
    case 'LISTEN_CHOOSE':
    case 'READING_COMPREHENSION':
      return { optionIds: item.content.options.map((option) => option.id) };
    case 'FILL_BLANK':
    case 'TYPE_ANSWER':
    case 'DICTATION':
    case 'REGISTER_SWAP':
      return { text: '' };
    case 'ORDER_WORDS':
      return { tokens: item.content.tokens };
    case 'MATCH':
      return {
        pairs: item.content.lefts.map((left, index) => ({
          left,
          right: item.content.rights[index] ?? left,
        })),
      };
  }
}
