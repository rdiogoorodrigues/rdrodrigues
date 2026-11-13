import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caso, correr, posicao } from './_helpers.js';

const r = correr(caso('caso-a'));

test('Caso A: glp1_gip ou perda_ponderal_estruturada no top 3', () => {
  const p = Math.min(...['glp1_gip', 'perda_ponderal_estruturada'].map((id) => posicao(r, id) || 99));
  assert.ok(p <= 3, `melhor posição: ${p}`);
});

test('Caso A: suspender_aine no top 5, com ponte sugerida', () => {
  const p = posicao(r, 'suspender_aine');
  assert.ok(p >= 1 && p <= 5, `posição: ${p}`);
  const it = r.ranking[p - 1];
  assert.ok(it.ponte?.obrigatoria && it.ponte.opcoes.length >= 2);
});

test('Caso A: caminho obesidade → gonartrose → mobilidade → objetivo existe e é devolvido para destaque', () => {
  const cs = r.caminhos_objetivo[0].caminhos.map((c) => c.nos.join('>'));
  assert.ok(cs.includes('obesidade>gonartrose>mobilidade_reduzida>objetivo:obj1'), cs.slice(0, 8).join(' | '));
});

test('Caso A: cessacao_tabagica não aparece (não fuma)', () => {
  assert.equal(posicao(r, 'cessacao_tabagica'), 0);
});

test('Caso A: metformina reconhecida como em curso; mobilidade reduzida derivada', () => {
  assert.ok(r.em_curso.some((e) => e.id === 'metformina'));
  const m = r.grafo.nos.get('mobilidade_reduzida');
  assert.ok(m && m.derivado);
});

test('Caso A: gravidades dos modificadores (IMC 36 → 0,54; HbA1c 8,4 → 0,58)', () => {
  assert.ok(Math.abs(r.grafo.nos.get('obesidade').gravidade - 0.54) < 1e-9);
  assert.ok(Math.abs(r.grafo.nos.get('dm2').gravidade - 0.58) < 1e-9);
});
