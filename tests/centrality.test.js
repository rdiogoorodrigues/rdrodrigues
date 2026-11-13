import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfg } from './_helpers.js';
import { centralidade } from '../src/engine/centrality.js';
import { caminhos } from '../src/engine/paths.js';

// Grafo sintético: cada nó com gravidade 1, todas as ligações fortes (peso 3)
function grafo(arcos) {
  const nos = new Map();
  const ligacoes = arcos.map(([o, d, forca = 'forte']) => {
    for (const id of [o, d]) if (!nos.has(id)) nos.set(id, { id, gravidade: 1 });
    return { id: `${o}->${d}`, origem: o, destino: d, forca, fator: 1 };
  });
  return { nos, ligacoes };
}
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('cadeia: desconto de 50 % por nível e máximo de 3 níveis', () => {
  const r = centralidade(grafo([['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']]), 'a', cfg);
  perto(r.bruto, 3 + 1.5 + 0.75); // e (nível 4) não conta
  assert.ok(!r.contribuicoes.some((c) => c.no === 'e'));
  perto(r.C, 1 - Math.exp(-5.25 / cfg.centralidade.escala));
});

test('ciclo e bidirecional: termina e não conta a origem', () => {
  const r = centralidade(grafo([['a', 'b'], ['b', 'a'], ['b', 'c'], ['c', 'a']]), 'a', cfg);
  perto(r.bruto, 3 + 1.5);
});

test('vários caminhos para o mesmo nó: conta uma vez (o melhor)', () => {
  const r = centralidade(grafo([['a', 'b'], ['a', 'c'], ['b', 'c']]), 'a', cfg);
  perto(r.bruto, 3 + 3);
});

test('força e gravidade ponderam a contribuição', () => {
  const G = grafo([['a', 'b', 'moderada'], ['a', 'c', 'fraca']]);
  G.nos.get('b').gravidade = 0.5;
  perto(centralidade(G, 'a', cfg).bruto, 2 * 0.5 + 1);
});

test('exclusão: nós excluídos não são contados nem atravessados', () => {
  const r = centralidade(grafo([['a', 'b'], ['b', 'c'], ['a', 'd']]), 'a', cfg, { excluir: new Set(['b']) });
  perto(r.bruto, 3);
});

test('caminhos simples com limite de saltos', () => {
  const G = grafo([['a', 'b'], ['b', 'c'], ['a', 'c'], ['c', 'a']]);
  const cs = caminhos(G, 'a', 'c', 3, cfg);
  assert.equal(cs.length, 2);
  assert.deepEqual(cs[0].nos, ['a', 'c']); // mais forte primeiro
});
