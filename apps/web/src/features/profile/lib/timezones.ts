/** Os fusos do Brasil vêm primeiro: é para onde está quase todo mundo. */
const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Fortaleza',
  'America/Bahia',
  'America/Belem',
  'America/Recife',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'America/Noronha',
];

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

/** O fuso que o navegador está usando agora. */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Fusos para o Select. `current` entra sempre na lista, mesmo que o
 * navegador não o conheça — senão o campo mostraria outro valor.
 */
export function timezoneOptions(
  current: string,
): { value: string; label: string }[] {
  const supported =
    (Intl as IntlWithSupportedValues).supportedValuesOf?.('timeZone') ?? [];
  const rest = supported.filter((zone) => !BRAZIL_TIMEZONES.includes(zone));
  const all = [...BRAZIL_TIMEZONES, ...rest];

  if (!all.includes(current)) {
    all.unshift(current);
  }

  return all.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }));
}
