import { diffFields } from './audit-details';

describe('diffFields', () => {
  const before = { priceCents: 1990, monthlyAiCredits: 100, active: true };

  it('devolve só o que mudou, com o antes e o depois', () => {
    expect(
      diffFields(before, { ...before, priceCents: 2490 }, [
        'priceCents',
        'monthlyAiCredits',
        'active',
      ]),
    ).toEqual({ priceCents: { from: 1990, to: 2490 } });
  });

  it('zero e false são valores, não ausência', () => {
    expect(
      diffFields(before, { ...before, monthlyAiCredits: 0, active: false }, [
        'monthlyAiCredits',
        'active',
      ]),
    ).toEqual({
      monthlyAiCredits: { from: 100, to: 0 },
      active: { from: true, to: false },
    });
  });

  it('sem mudança, objeto vazio — e campo fora da lista é ignorado', () => {
    expect(diffFields(before, { ...before }, ['priceCents'])).toEqual({});
    expect(
      diffFields(before, { ...before, active: false }, ['priceCents']),
    ).toEqual({});
  });
});
