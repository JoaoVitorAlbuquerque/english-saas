import type { WeaknessAction } from '@english-saas/api-client';

export type WeaknessLinkKind = 'lesson' | 'practice' | 'material';

export type WeaknessLink = { kind: WeaknessLinkKind; to: string };

/**
 * Para onde o botão do ponto fraco leva. O backend decide **o que** sugerir
 * (lição → revisão → material do Plus → refazer → prática); aqui só se traduz
 * em rota do app. Recomendação, nunca bloqueio.
 *
 * - `LESSON` abre a lição pelo slug (o catálogo, se o slug não veio).
 * - `REVIEW` vai para a sessão de revisão (não dá para abrir um card só).
 * - `PRACTICE` vai para a agenda de hoje, onde o planner já põe a fraqueza.
 * - `MATERIAL` só chega para quem é Plus; o generator já mira nas fraquezas.
 */
export function weaknessLink(action: WeaknessAction): WeaknessLink {
  switch (action.type) {
    case 'LESSON':
      return {
        kind: 'lesson',
        to:
          action.lessonSlug === null
            ? '/catalogo'
            : `/licoes/${action.lessonSlug}`,
      };
    case 'REVIEW':
      return { kind: 'practice', to: '/revisao' };
    case 'PRACTICE':
      return { kind: 'practice', to: '/hoje' };
    case 'MATERIAL':
      return { kind: 'material', to: '/ferramentas/tema' };
  }
}
