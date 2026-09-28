import { create } from 'zustand';

import {
  initialLessonState,
  reduceLesson,
  type LessonAction,
  type LessonState,
} from './lesson-reducer';

type LessonStore = LessonState & { dispatch: (action: LessonAction) => void };

/** Zustand por cima do reducer puro — a lógica de transição mora só nele. */
export const useLessonStore = create<LessonStore>((set) => ({
  ...initialLessonState,
  dispatch: (action) => set((state) => reduceLesson(state, action)),
}));

export function resetLessonStore(): void {
  useLessonStore.setState({ ...initialLessonState });
}
