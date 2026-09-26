import type { WikipediaPage } from './wikipedia-client';

/**
 * Páginas da Wikipedia de mentira, para o `FakeWikipediaClient` — o teste
 * nunca sai para a internet. O texto foi escrito para o teste (não é cópia
 * da Wikipedia) e só tem frases curtas no passado: é com ele que a fixture
 * da IA monta um material A2 sobre um fato real.
 */
export const COLUMBUS_EXTRACT = [
  'Christopher Columbus was an explorer from Genoa.',
  'He wanted to reach Asia by sailing west across the Atlantic Ocean.',
  'The King and Queen of Spain paid for his first voyage.',
  'Columbus left the port of Palos in Spain on 3 August 1492.',
  'He sailed with three ships.',
  'The ships were called the Santa Maria, the Pinta and the Nina.',
  'About ninety men sailed with him.',
  'First the ships stopped in the Canary Islands.',
  'They stayed there for about a month.',
  'Then they sailed west into the open ocean.',
  'The trip was long and the sailors were afraid.',
  'Many of them wanted to go back to Spain.',
  'On 12 October 1492 a sailor on the Pinta saw land.',
  'The land was an island in the Bahamas.',
  'Columbus called the island San Salvador.',
  'The people who lived on the island were the Taino.',
  'Columbus believed that he was near India.',
  'For this reason he called the local people Indians.',
  'After that the ships visited Cuba and the island of Hispaniola.',
  'On Christmas Day the Santa Maria hit a reef near Hispaniola.',
  'The ship was lost, but the men survived.',
  'Columbus left about forty men on the island.',
  'They built a small fort with wood from the ship.',
  'In January 1493 Columbus started the trip back to Spain.',
  'He took gold, plants, parrots and some Taino people with him.',
  'On the way home a big storm separated the two ships.',
  'Columbus arrived in Lisbon first and then went on to Spain.',
  'He reached Palos on 15 March 1493.',
  'The King and Queen received him in Barcelona.',
  'They gave him the title of Admiral of the Ocean Sea.',
  'Columbus made three more voyages to the Americas.',
  'He never accepted that he had found a new continent.',
  'He died in Valladolid in Spain in 1506.',
].join(' ');

export const FAKE_WIKIPEDIA_PAGES: WikipediaPage[] = [
  {
    pageId: 7_701,
    title: 'Voyages of Christopher Columbus',
    url: 'https://en.wikipedia.org/wiki/Voyages_of_Christopher_Columbus',
    revisionId: '1234567890',
    extract: COLUMBUS_EXTRACT,
    summary:
      'Christopher Columbus made four voyages across the Atlantic Ocean from Spain, the first in 1492.',
  },
  {
    // Página curta demais: o cliente precisa pular para o próximo resultado.
    pageId: 7_702,
    title: 'Columbus (disambiguation)',
    url: 'https://en.wikipedia.org/wiki/Columbus_(disambiguation)',
    revisionId: '1111',
    extract: 'Columbus may refer to several people and places.',
    summary: 'Columbus may refer to several people and places.',
  },
];

/** Busca de mentira: palavra da consulta → páginas, na ordem do resultado. */
export const FAKE_WIKIPEDIA_SEARCH: Record<string, string[]> = {
  columbus: ['Columbus (disambiguation)', 'Voyages of Christopher Columbus'],
  navigation: ['Voyages of Christopher Columbus'],
};
