import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  subscribeAccessToken,
} from './token-store';

afterEach(() => {
  clearAccessToken();
});

describe('token-store', () => {
  it('guarda e limpa o access token', () => {
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');

    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('avisa os inscritos quando o token muda', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessToken(listener);

    setAccessToken('xyz');
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    setAccessToken('other');
    expect(listener).toHaveBeenCalledOnce();
  });
});
