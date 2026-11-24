/**
 * Leroy Merlin has no public catalogue API and its site refuses automated
 * requests, so nothing here fetches from it. What the app can do honestly:
 * open the shop's own search in the user's browser for whatever is selected,
 * and remember the product (name, link, price) the user settles on.
 */

const SEARCH = 'https://www.leroymerlin.pl/szukaj.html?q=';

export const leroySearchUrl = (query: string): string => SEARCH + encodeURIComponent(query);

/** Polish search phrases for each finish in the material library. */
export const FINISH_SEARCH: Record<string, string> = {
  paint: 'farba do ścian i sufitów',
  plaster: 'tynk dekoracyjny',
  concrete: 'beton architektoniczny płyty',
  'brick-red': 'cegła dekoracyjna czerwona',
  'brick-white': 'cegła dekoracyjna biała',
  subway: 'płytki ścienne cegiełka biała',
  'tile-beige': 'płytki ścienne beżowe 30x60',
  slats: 'lamele ścienne dąb',
  pinstripe: 'tapeta w paski',
  oak: 'panele podłogowe dąb',
  walnut: 'panele podłogowe orzech',
  ash: 'panele podłogowe jasne',
  parquet: 'parkiet dębowy',
  'tile-grey': 'gres szary 60x60',
  marble: 'gres marmur biały 60x60',
  checker: 'płytki podłogowe szachownica',
  terrazzo: 'gres lastryko',
  carpet: 'wykładzina dywanowa',
  decking: 'deska tarasowa',
};
