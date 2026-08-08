import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '../../src/wikipedia/index.js';
describe('fallback Wikipedia', () => {
  it('pontua nome, UF, tipo, Commons e Wikidata', () =>
    expect(
      scoreCandidate(
        { title: 'Brasão de Capim PB.svg', commons: true, wikidataMatch: true },
        'Capim',
        'PB',
        'brasao',
      ),
    ).toBe(90));
  it('mantém candidatos ambíguos com pontuação comparável', () =>
    expect(
      scoreCandidate({ title: 'Brasão municipal.svg', commons: true }, 'Capim', 'PB', 'brasao'),
    ).toBe(30));
  it('reconhece Coat como indicação de brasão', () =>
    expect(
      scoreCandidate(
        { title: 'Cutias do Araguari Coat.jpg', commons: true },
        'Cutias',
        'AP',
        'brasao',
      ),
    ).toBe(65));
});
