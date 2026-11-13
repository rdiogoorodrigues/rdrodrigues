import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb, cfg, caso, correr } from './_helpers.js';
import { construirGrafo } from '../src/engine/graph.js';
import { alertasDaIntervencao } from '../src/engine/alerts.js';

const ids = (r) => r.alertas.map((a) => a.id);

test('triple whammy: IECA + diurético + AINE', () => {
  const c = caso('caso-b');
  assert.ok(ids(correr(c)).includes('triple_whammy'));
  c.medicacao = c.medicacao.filter((m) => m.dci !== 'naproxeno');
  assert.ok(!ids(correr(c)).includes('triple_whammy'));
});

test('triple whammy eleva o risco de lesão renal aguda', () => {
  const r = correr(caso('caso-b'));
  const n = r.grafo.nos.get('lesao_renal');
  assert.ok(n.gravidade >= 0.7);
  assert.equal(n.origem_gravidade, 'alerta:triple_whammy');
});

test('BZD + opioide', () => {
  const c = caso('caso-b');
  c.medicacao.push({ dci: 'tramadol', estado: 'manter' });
  assert.ok(ids(correr(c)).includes('bzd_opioide'));
});

test('medicação suspensa não dispara alertas', () => {
  const c = caso('caso-b');
  c.medicacao.find((m) => m.dci === 'naproxeno').estado = 'suspenso';
  assert.ok(!ids(correr(c)).includes('triple_whammy'));
});

test('iSGLT2 e GLP-1 em utente frágil: alerta ao considerar a intervenção', () => {
  const g = construirGrafo(caso('caso-b'), kb, cfg);
  assert.deepEqual(alertasDaIntervencao(g, kb, 'isglt2').map((a) => a.id), ['isglt2_fragilidade']);
  assert.deepEqual(alertasDaIntervencao(g, kb, 'glp1_gip').map((a) => a.id), ['glp1_fragilidade']);
  const gA = construirGrafo(caso('caso-a'), kb, cfg);
  assert.deepEqual(alertasDaIntervencao(gA, kb, 'glp1_gip'), []);
});

test('caso A: sem alertas de combinação', () => {
  assert.deepEqual(ids(correr(caso('caso-a'))), []);
});

test('sobretratamento glicémico em idoso frágil com insulina', () => {
  const c = caso('caso-b');
  c.problemas.push({ id: 'dm2' });
  c.parametros.hba1c = 6.2;
  c.medicacao.push({ dci: 'insulina glargina', estado: 'manter' });
  const r = correr(c);
  assert.ok(ids(r).includes('sobretratamento_glicemico'));
  assert.ok(r.ranking.some((x) => x.id === 'desintensificacao_hipoglicemiantes'));
});
