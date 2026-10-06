import type { ItemCalibrationFlag } from '@english-saas/shared';

/**
 * Itens problemáticos.
 *
 * A calibração semanal grava uma linha por item e por rodada. Quem revisa
 * quer **uma linha por item** (o estado de agora) e, na ficha, a história
 * inteira — inclusive o ponto de partida da dificuldade, que a calibração
 * sobrescreve em `Item.difficulty`.
 */

export type CalibrationRow = {
  itemId: string;
  calibratedAt: Date;
  flags: readonly ItemCalibrationFlag[];
  previousDifficulty: number;
};

/**
 * Uma linha por item: a calibração mais recente. Entre as de mesmo
 * instante, a que vier por último na lista. Ordem de saída: mais recente
 * primeiro, `itemId` desempata — estável para paginar.
 */
export function latestPerItem<T extends CalibrationRow>(
  rows: readonly T[],
): T[] {
  const latest = new Map<string, T>();

  for (const row of rows) {
    const current = latest.get(row.itemId);

    if (
      current === undefined ||
      row.calibratedAt.getTime() >= current.calibratedAt.getTime()
    ) {
      latest.set(row.itemId, row);
    }
  }

  return [...latest.values()].sort(
    (a, b) =>
      b.calibratedAt.getTime() - a.calibratedAt.getTime() ||
      a.itemId.localeCompare(b.itemId),
  );
}

/**
 * Dificuldade com que o item começou: o valor anterior à **primeira**
 * calibração. `Item.difficulty` é sobrescrita a cada rodada, então só
 * `previousDifficulty` guarda a origem. Sem calibração, a atual é a inicial.
 */
export function initialDifficultyOf(
  current: number,
  calibrations: readonly Pick<
    CalibrationRow,
    'calibratedAt' | 'previousDifficulty'
  >[],
): number {
  const first = [...calibrations].sort(
    (a, b) => a.calibratedAt.getTime() - b.calibratedAt.getTime(),
  )[0];

  return first === undefined ? current : first.previousDifficulty;
}
