import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb, cfg, caso, clone, posicao } from './_helpers.js';
import { analisar } from '../src/engine/index.js';
import { dwParaGravidade, nivelGBD } from '../src/engine/severity.js';
import { analisarSensibilidade } from '../src/engine/sensitivity.js';

const cfgGBD = clone(cfg); cfgGBD.gravidade.fonte_sintomatica = 'gbd2013';
const perto = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const mapa = (no) => kb.dw.porNo.get(no);

test('transcrição da Tabela 2 (Salomon 2015): verificação pontual', () => {
  const e = kb.dw.estados;
  assert.deepEqual([e.ic_moderada.dw, ...e.ic_moderada.ui], [0.072, 0.047, 0.103]);
  assert.deepEqual([e.depressao_ligeira.dw, ...e.depressao_ligeira.ui], [0.145, 0.099, 0.209]);
  assert.deepEqual([e.mme_pernas_moderado.dw, ...e.mme_pernas_moderado.ui], [0.079, 0.054, 0.110]);
  assert.deepEqual([e.dpoc_grave.dw, ...e.dpoc_grave.ui], [0.408, 0.273, 0.556]);
  assert.deepEqual([e.audicao_profunda.dw, ...e.audicao_profunda.ui], [0.204, 0.134, 0.288]);
  assert.deepEqual([e.anemia_grave.dw, ...e.anemia_grave.ui], [0.149, 0.101, 0.209]);
});

test('transformação DW → gravidade: ancorada na mediana (0,128 → 0,5) e monótona', () => {
  perto(dwParaGravidade(0.128, kb.dw), 0.5);
  const dws = Object.values(kb.dw.estados).map((e) => e.dw).sort((a, b) => a - b);
  const gs = dws.map((d) => dwParaGravidade(d, kb.dw));
  for (let i = 1; i < gs.length; i++) assert.ok(gs[i] >= gs[i - 1]);
  assert.ok(gs[0] > 0 && gs.at(-1) < 1);
});

test('nível GBD: parâmetro, manual e defeito', () => {
  assert.equal(nivelGBD(mapa('ic'), {}, { nyha: 3 }).nivel, 'moderado');
  assert.equal(nivelGBD(mapa('ic'), {}, { nyha: 2 }).nivel, 'ligeiro');
  assert.equal(nivelGBD(mapa('ic'), {}, { nyha: 4 }).nivel, 'grave');
  assert.equal(nivelGBD(mapa('depressao'), {}, { phq9: 7 }).nivel, 'ligeiro');
  assert.equal(nivelGBD(mapa('depressao'), {}, { phq9: 22 }).nivel, 'grave');
  assert.equal(nivelGBD(mapa('anemia'), {}, { hb: 9.5 }).nivel, 'moderado');
  assert.equal(nivelGBD(mapa('asma'), {}, { act: 25 }).nivel, 'controlada');
  assert.equal(nivelGBD(mapa('asma'), {}, { act: 18 }).nivel, 'nao_controlada');
  assert.deepEqual(nivelGBD(mapa('ic'), { nivel: 'grave' }, { nyha: 2 }), { nivel: 'grave', origem: 'manual' });
  assert.equal(nivelGBD(mapa('ic'), {}, {}).origem, 'defeito');
});

test('modo por defeito = tabelas; modo GBD só altera nós sintomáticos', () => {
  const a = analisar(caso('caso-b'), kb, cfg);
  const b = analisar(caso('caso-b'), kb, cfgGBD);
  assert.equal(a.grafo.nos.get('ic').origem_gravidade, 'defeito');
  assert.equal(b.grafo.nos.get('ic').origem_gravidade, 'gbd_nivel_defeito');
  for (const id of ['drc', 'hta', 'fragilidade']) perto(a.grafo.nos.get(id).gravidade, b.grafo.nos.get(id).gravidade);
  const c = caso('caso-b'); c.parametros.nyha = 3;
  const n = analisar(c, kb, cfgGBD).grafo.nos.get('ic');
  assert.equal(n.origem_gravidade, 'gbd');
  perto(n.gravidade, dwParaGravidade(0.072, kb.dw));
});

test('gravidade manual prevalece sobre o GBD', () => {
  const c = caso('caso-a'); c.problemas.find((p) => p.id === 'depressao').gravidade = 0.9;
  assert.equal(analisar(c, kb, cfgGBD).grafo.nos.get('depressao').gravidade, 0.9);
});

test('critérios clínicos dos casos A e B mantêm-se no modo GBD', () => {
  const a = analisar(caso('caso-a'), kb, cfgGBD);
  assert.ok(Math.min(posicao(a, 'glp1_gip') || 99, posicao(a, 'perda_ponderal_estruturada') || 99) <= 3);
  assert.ok(posicao(a, 'suspender_aine') <= 5);
  const b = analisar(caso('caso-b'), kb, cfgGBD);
  assert.equal(posicao(b, 'suspender_aine'), 1);
  assert.ok(posicao(b, 'desprescricao_bzd') <= 3);
});

test('sensibilidade no modo GBD usa o IC 95 % do GBD como incerteza empírica', () => {
  const s = analisarSensibilidade(caso('caso-a'), kb, cfgGBD, { n: 20 });
  const dep = s.incertezas_gravidade.find((x) => x.id === 'depressao');
  assert.equal(dep.tipo, 'gbd_ic');
  perto(dep.lo, dwParaGravidade(0.099, kb.dw)); perto(dep.hi, dwParaGravidade(0.209, kb.dw));
  assert.equal(s.incertezas_gravidade.find((x) => x.id === 'gonartrose').tipo, 'gbd_nivel_defeito');
  assert.ok(s.tornado.some((l) => l.tipo === 'incerteza_gbd'));
});
