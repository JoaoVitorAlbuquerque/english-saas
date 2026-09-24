import {
  buildPage,
  decodeCursor,
  encodeCursor,
  toPrismaCursorArgs,
} from './cursor';

describe('encodeCursor / decodeCursor', () => {
  it('faz ida e volta sem perder o valor', () => {
    expect(decodeCursor(encodeCursor('abc-123'))).toBe('abc-123');
  });

  it('não vaza o valor original na forma legível', () => {
    expect(encodeCursor('abc-123')).not.toContain('abc-123');
  });

  it('sobrevive a caractere não-ASCII', () => {
    expect(decodeCursor(encodeCursor('lição-ç'))).toBe('lição-ç');
  });

  it('recusa cursor vazio', () => {
    expect(() => decodeCursor('')).toThrow('Cursor inválido.');
  });
});

describe('buildPage', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const getId = (row: { id: string }) => row.id;

  it('corta a linha extra e aponta o próximo cursor', () => {
    const page = buildPage(rows, 2, getId);

    expect(page.data).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeCursor('b'));
  });

  it('fecha a paginação quando não há linha extra', () => {
    const page = buildPage(rows, 3, getId);

    expect(page.data).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('lida com lista vazia', () => {
    const page = buildPage([], 20, getId);

    expect(page).toEqual({ data: [], hasMore: false, nextCursor: null });
  });
});

describe('toPrismaCursorArgs', () => {
  it('pede uma linha a mais para saber se existe próxima página', () => {
    expect(toPrismaCursorArgs({ limit: 20 })).toEqual({ take: 21 });
  });

  it('pula o item do cursor na página seguinte', () => {
    expect(
      toPrismaCursorArgs({ limit: 10, cursor: encodeCursor('xyz') }),
    ).toEqual({ take: 11, cursor: { id: 'xyz' }, skip: 1 });
  });
});
