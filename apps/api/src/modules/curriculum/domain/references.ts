import type { LessonStepInput, Span } from '@english-saas/shared';

/**
 * Referências que o conteúdo faz para fora dele.
 *
 * Span aponta para Skill, fala aponta para Character, prática aponta para
 * Item. Nada disso é chave estrangeira — tudo vive dentro de JSON, e o
 * Postgres não tem como conferir. Então a gente junta as referências aqui e
 * o serviço confere a existência antes de deixar publicar.
 *
 * Função pura: entra conteúdo, sai lista de id.
 */

export type ContentReferences = {
  skillIds: string[];
  registerNoteIds: string[];
  errorPatternIds: string[];
  characterIds: string[];
  assetIds: string[];
  itemIds: string[];
};

type Collector = { [K in keyof ContentReferences]: Set<string> };

function emptyCollector(): Collector {
  return {
    skillIds: new Set(),
    registerNoteIds: new Set(),
    errorPatternIds: new Set(),
    characterIds: new Set(),
    assetIds: new Set(),
    itemIds: new Set(),
  };
}

function collectSpans(into: Collector, spans: readonly Span[]): void {
  for (const span of spans) {
    if (span.skillId !== undefined) {
      into.skillIds.add(span.skillId);
    }

    if (span.registerNoteId !== undefined) {
      into.registerNoteIds.add(span.registerNoteId);
    }
  }
}

function collectStep(into: Collector, step: LessonStepInput): void {
  switch (step.type) {
    case 'SCENE': {
      for (const characterId of step.content.characterIds) {
        into.characterIds.add(characterId);
      }

      if (step.content.audioAssetId !== undefined) {
        into.assetIds.add(step.content.audioAssetId);
      }

      for (const line of step.content.lines) {
        into.characterIds.add(line.characterId);

        if (line.audioAssetId !== undefined) {
          into.assetIds.add(line.audioAssetId);
        }

        collectSpans(into, line.spans);
      }

      return;
    }

    case 'EXPLANATION_CARDS': {
      for (const card of step.content.cards) {
        for (const example of card.examples) {
          collectSpans(into, example.spans);
        }
      }

      return;
    }

    case 'PRACTICE': {
      for (const itemId of step.content.itemIds) {
        into.itemIds.add(itemId);
      }

      return;
    }

    case 'FREE_PRODUCTION': {
      for (const skillId of step.content.targetSkillIds) {
        into.skillIds.add(skillId);
      }

      for (const criterion of step.content.rubric) {
        if (criterion.skillId !== undefined) {
          into.skillIds.add(criterion.skillId);
        }

        if (criterion.errorPatternId !== undefined) {
          into.errorPatternIds.add(criterion.errorPatternId);
        }
      }

      return;
    }

    case 'ROLEPLAY': {
      into.characterIds.add(step.content.characterId);

      for (const goal of step.content.goals) {
        for (const skillId of goal.skillIds) {
          into.skillIds.add(skillId);
        }
      }

      return;
    }

    case 'SUMMARY': {
      for (const skillId of step.content.skillIds) {
        into.skillIds.add(skillId);
      }

      for (const registerNoteId of step.content.registerNoteIds) {
        into.registerNoteIds.add(registerNoteId);
      }

      return;
    }
  }
}

/** Junta tudo que as etapas referenciam, sem repetição e em ordem estável. */
export function collectStepReferences(
  steps: readonly LessonStepInput[],
): ContentReferences {
  const collector = emptyCollector();

  for (const step of steps) {
    collectStep(collector, step);
  }

  return {
    skillIds: [...collector.skillIds].sort(),
    registerNoteIds: [...collector.registerNoteIds].sort(),
    errorPatternIds: [...collector.errorPatternIds].sort(),
    characterIds: [...collector.characterIds].sort(),
    assetIds: [...collector.assetIds].sort(),
    itemIds: [...collector.itemIds].sort(),
  };
}

/** O que foi referenciado mas não existe. Lista vazia = pode publicar. */
export function missingReferences(
  referenced: readonly string[],
  existing: readonly string[],
): string[] {
  const found = new Set(existing);

  return referenced.filter((id) => !found.has(id));
}
