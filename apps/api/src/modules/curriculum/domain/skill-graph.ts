/**
 * Grafo de pré-requisitos entre skills.
 *
 * Cada aresta é "esta skill exige aquela". O modelo do aluno (7) e o planner
 * (10) andam por ele para decidir o que ensinar antes do quê — um ciclo
 * ("A exige B, B exige A") não tem ordem possível e travaria os dois.
 */

/** Skill → pré-requisitos dela, como estão gravados hoje. */
export type PrerequisiteEdges = ReadonlyMap<string, readonly string[]>;

/**
 * Se trocar os pré-requisitos de `skillId` por `prerequisiteIds` fecha um
 * ciclo, devolve o caminho dele (`[A, B, ..., A]`); senão, `null`.
 *
 * Fecha ciclo quando alguma das novas exigências chega de volta em
 * `skillId` seguindo as arestas existentes. As arestas que saem de
 * `skillId` hoje não entram na conta: elas estão sendo substituídas.
 * Auto-referência é o ciclo mais curto (`[A, A]`).
 */
export function findPrerequisiteCycle(
  skillId: string,
  prerequisiteIds: readonly string[],
  edges: PrerequisiteEdges,
): string[] | null {
  for (const first of prerequisiteIds) {
    const path = pathBack(first, skillId, edges);

    if (path !== null) {
      return [skillId, ...path];
    }
  }

  return null;
}

/** Caminho de `from` até `target`, incluindo os dois, ou `null`. */
function pathBack(
  from: string,
  target: string,
  edges: PrerequisiteEdges,
): string[] | null {
  const visited = new Set<string>();

  const walk = (node: string, trail: string[]): string[] | null => {
    if (node === target) {
      return [...trail, node];
    }

    // Já passou por aqui e não achou o alvo: não refaz o caminho.
    if (visited.has(node)) {
      return null;
    }

    visited.add(node);

    for (const next of edges.get(node) ?? []) {
      const found = walk(next, [...trail, node]);

      if (found !== null) {
        return found;
      }
    }

    return null;
  };

  return walk(from, []);
}
