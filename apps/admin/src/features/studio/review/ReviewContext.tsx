/* O contexto exporta o provedor e o hook de propósito: vivem juntos. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

/** Sobre o que é um comentário da revisão. */
export type CommentAbout = {
  target: 'VERSION' | 'STEP' | 'ITEM';
  /** A ordem da etapa, o id da questão, ou nada para a lição inteira. */
  ref: string | null;
  /** Em palavras: "Etapa 2 · Cena", "Questão 1 da prática". */
  label: string;
};

export type ReviewContextValue = {
  /** Comentários abertos por ordem da etapa. */
  openByStep: Readonly<Record<string, number>>;
  /** Comentários abertos por id de questão. */
  openByItem: Readonly<Record<string, number>>;
  /** Abre a aba de comentários já com o alvo escolhido. */
  comment: (about: CommentAbout) => void;
};

const ReviewContext = createContext<ReviewContextValue | null>(null);

/**
 * Liga os editores de etapa (que não sabem de revisão) à aba de comentários:
 * quantos comentários abertos há e o botão "Comentar". Fora do editor da
 * versão, o valor é `null` e nada disso aparece.
 */
export function ReviewProvider({
  value,
  children,
}: {
  value: ReviewContextValue;
  children: ReactNode;
}) {
  return (
    <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextValue | null {
  return useContext(ReviewContext);
}
