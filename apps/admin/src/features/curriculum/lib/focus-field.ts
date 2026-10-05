const FOCUSABLE = 'input, textarea, select, button';

/**
 * Leva o foco ao campo de um erro. O caminho é o do `validateSteps`
 * (`lines.2.spans.0`); cada campo do editor marca o próprio caminho em
 * `data-field`. Se o campo exato não existe na tela (a marcação 0 da fala 2
 * sumiu, por exemplo), sobe um nível por vez até achar o mais próximo.
 */
export function focusField(root: ParentNode, fieldPath: string): boolean {
  let current = fieldPath;

  for (;;) {
    const marked = root.querySelector<HTMLElement>(
      `[data-field="${CSS.escape(current)}"]`,
    );

    if (marked !== null) {
      const target = marked.matches(FOCUSABLE)
        ? marked
        : marked.querySelector<HTMLElement>(FOCUSABLE);

      (target ?? marked).focus();
      marked.scrollIntoView?.({ block: 'center' });

      return true;
    }

    const cut = current.lastIndexOf('.');

    if (cut === -1) {
      return false;
    }

    current = current.slice(0, cut);
  }
}
