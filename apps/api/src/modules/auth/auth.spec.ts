import { checkPassword, normalizeEmail } from './domain/password';
import {
  decideRefresh,
  isSingleUseTokenUsable,
  refreshTokenExpiresAt,
  type StoredRefreshToken,
} from './domain/refresh-token';
import { expiresIn, hashToken, tokenMatches } from './domain/tokens';

describe('checkPassword', () => {
  it('aceita uma senha razoável', () => {
    expect(checkPassword('minhasenha7').valid).toBe(true);
  });

  it('recusa senha curta e diz o porquê em pt-BR', () => {
    const result = checkPassword('abc1');

    expect(result.valid).toBe(false);
    expect(result.problems).toContain('TOO_SHORT');
    expect(result.messages[0]).toContain('8 caracteres');
  });

  it('exige letra e número', () => {
    expect(checkPassword('12345678').problems).toContain('NO_LETTER');
    expect(checkPassword('abcdefgh').problems).toContain('NO_NUMBER');
  });

  it('recusa senha óbvia demais', () => {
    expect(checkPassword('senha123').problems).toContain('TOO_COMMON');
  });

  it('recusa senha que contém o e-mail', () => {
    expect(
      checkPassword('joaovitor123', { email: 'joaovitor@exemplo.com' })
        .problems,
    ).toContain('CONTAINS_EMAIL');
  });

  it('ignora parte local curta demais para ser pista', () => {
    expect(
      checkPassword('abmeusegredo1', { email: 'ab@exemplo.com' }).problems,
    ).not.toContain('CONTAINS_EMAIL');
  });

  it('aceita letra acentuada como letra', () => {
    expect(checkPassword('avião123').problems).not.toContain('NO_LETTER');
  });

  it('acumula todos os problemas de uma vez', () => {
    expect(checkPassword('abc').problems).toEqual(
      expect.arrayContaining(['TOO_SHORT', 'NO_NUMBER']),
    );
  });
});

describe('normalizeEmail', () => {
  it('apara espaços e baixa a caixa', () => {
    expect(normalizeEmail('  Joao@Exemplo.COM ')).toBe('joao@exemplo.com');
  });
});

describe('decideRefresh', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  function token(overrides: Partial<StoredRefreshToken> = {}) {
    return {
      id: 'token-1',
      userId: 'user-1',
      family: 'family-1',
      expiresAt: new Date('2026-07-01T12:00:00.000Z'),
      revokedAt: null,
      replacedById: null,
      ...overrides,
    };
  }

  it('rotaciona um token válido', () => {
    expect(decideRefresh(token(), now)).toEqual({
      action: 'rotate',
      tokenId: 'token-1',
      userId: 'user-1',
      family: 'family-1',
    });
  });

  it('rejeita token inexistente', () => {
    expect(decideRefresh(null, now)).toEqual({
      action: 'reject',
      reason: 'NOT_FOUND',
    });
  });

  it('rejeita token vencido', () => {
    const decision = decideRefresh(
      token({ expiresAt: new Date('2026-05-31T12:00:00.000Z') }),
      now,
    );

    expect(decision).toMatchObject({ action: 'reject', reason: 'EXPIRED' });
  });

  it('rejeita token revogado', () => {
    const decision = decideRefresh(token({ revokedAt: now }), now);

    expect(decision).toMatchObject({ action: 'reject', reason: 'REVOKED' });
  });

  it('trata reuso de token já rotacionado como roubo, não como revogação', () => {
    // Um token rotacionado fica revogado E com replacedById; queremos o
    // motivo que dispara a revogação da família.
    const decision = decideRefresh(
      token({ revokedAt: now, replacedById: 'token-2' }),
      now,
    );

    expect(decision).toEqual({
      action: 'reject',
      reason: 'REUSED',
      family: 'family-1',
    });
  });

  it('rejeita no instante exato do vencimento', () => {
    const decision = decideRefresh(token({ expiresAt: now }), now);

    expect(decision).toMatchObject({ reason: 'EXPIRED' });
  });
});

describe('refreshTokenExpiresAt', () => {
  it('soma os dias pedidos', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');

    expect(refreshTokenExpiresAt(now, 30).toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );
  });
});

describe('isSingleUseTokenUsable', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('aceita token novo e dentro do prazo', () => {
    expect(
      isSingleUseTokenUsable(
        { expiresAt: expiresIn(now, 30), usedAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('recusa token já usado', () => {
    expect(
      isSingleUseTokenUsable(
        { expiresAt: expiresIn(now, 30), usedAt: now },
        now,
      ),
    ).toBe(false);
  });

  it('recusa token vencido', () => {
    expect(
      isSingleUseTokenUsable(
        { expiresAt: expiresIn(now, -1), usedAt: null },
        now,
      ),
    ).toBe(false);
  });

  it('recusa token inexistente', () => {
    expect(isSingleUseTokenUsable(null, now)).toBe(false);
  });
});

describe('hashToken', () => {
  it('é determinístico', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('não guarda o valor original', () => {
    expect(hashToken('meu-token-secreto')).not.toContain('meu-token-secreto');
  });

  it('confere o token contra o hash guardado', () => {
    expect(tokenMatches('abc', hashToken('abc'))).toBe(true);
    expect(tokenMatches('abd', hashToken('abc'))).toBe(false);
  });

  it('não estoura quando o hash guardado tem tamanho errado', () => {
    expect(tokenMatches('abc', 'ff')).toBe(false);
  });
});
