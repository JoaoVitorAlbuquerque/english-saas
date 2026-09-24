/**
 * Estatística de exposição de um item.
 *
 * Só a **primeira tentativa** de cada aluno conta: a segunda resposta de
 * quem acabou de ver o gabarito diz muito pouco sobre a dificuldade da
 * questão.
 *
 * `correctRate` fica nulo até um mínimo de exposições. Com 3 respostas, uma
 * taxa de 100% é ruído — e o assessment (8) calibraria dificuldade em cima
 * dele.
 */

export const MIN_EXPOSURE_FOR_RATE = 10;

export type ItemStats = {
  exposureCount: number;
  correctRate: number | null;
};

export function computeItemStats(input: {
  firstTries: number;
  correctFirstTries: number;
}): ItemStats {
  const exposureCount = Math.max(0, input.firstTries);

  if (exposureCount < MIN_EXPOSURE_FOR_RATE) {
    return { exposureCount, correctRate: null };
  }

  const correct = Math.min(Math.max(0, input.correctFirstTries), exposureCount);

  return {
    exposureCount,
    correctRate: Math.round((correct / exposureCount) * 10_000) / 10_000,
  };
}
