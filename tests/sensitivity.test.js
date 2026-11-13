import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb, cfg, caso, clone } from './_helpers.js';
import { analisarSensibilidade, kendallTau, perturbarGrupo, GRUPOS, prng } from '../src/engine/sensitivity.js';

const N = 200;

test('τ de Kendall: idêntico = 1, invertido = −1', () => {
  assert.equal(kendallTau(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
  assert.equal(kendallTau(['a', 'b', 'c'], ['c', 'b', 'a']), -1);
});

test('PRNG determinístico', () => {
  const a = prng(7), b = prng(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('perturbação preserva a ordem forte > moderada > fraca e + < ++ < +++', () => {
  const r = prng(1);
  for (let i = 0; i < 200; i++) {
    const c = clone(cfg);
    for (const g of Object.keys(GRUPOS)) perturbarGrupo(c, g, () => 0.3 + 1.4 * r());
    assert.ok(c.forca_peso.forte >= c.forca_peso.moderada && c.forca_peso.moderada >= c.forca_peso.fraca);
    assert.ok(c.transmissao.forte >= c.transmissao.moderada && c.transmissao.forte <= 0.95);
    assert.ok(c.magnitude['+++'] >= c.magnitude['++'] && c.magnitude['++'] >= c.magnitude['+']);
    assert.ok(c.custos.major >= c.custos.moderado && c.custos.moderado >= c.custos.menor);
    assert.ok(c.centralidade.desconto_por_nivel <= 1);
  }
});

test('reprodutível com a mesma semente', () => {
  const a = analisarSensibilidade(caso('caso-a'), kb, cfg, { n: 30, tornado: false });
  const b = analisarSensibilidade(caso('caso-a'), kb, cfg, { n: 30, tornado: false });
  assert.deepEqual(a.intervencoes, b.intervencoes);
});

test('amplitude zero → ranking idêntico ao base (τ = 1)', () => {
  const zeros = Object.fromEntries(Object.keys(GRUPOS).map((k) => [k, 0]));
  const s = analisarSensibilidade(caso('caso-b'), kb, cfg, { n: 10, modo: 'coeficientes', amplitudes: zeros, tornado: false });
  assert.equal(s.kendall_tau.media, 1);
  for (const i of s.intervencoes) assert.equal(i.posicao_p5, i.posicao_base);
});

test('gravidades por defeito são identificadas e entram no tornado', () => {
  const s = analisarSensibilidade(caso('caso-b'), kb, cfg, { n: 10 });
  assert.ok(s.nos_gravidade_por_defeito.includes('ic'));
  assert.ok(s.tornado.some((l) => l.tipo === 'gravidade_por_defeito' && l.fator === 'ic'));
  assert.ok(s.tornado.every((l, i, a) => i === 0 || a[i - 1].influencia >= l.influencia));
});

// Robustez dos critérios clínicos face à incerteza dos coeficientes e das gravidades por defeito
test('Caso A (robustez): GLP-1/GIP no top 3 em ≥ 90 % das simulações; suspender AINE no top 5 em ≥ 90 %', () => {
  const s = analisarSensibilidade(caso('caso-a'), kb, cfg, { n: N, tornado: false });
  const p = (id) => s.intervencoes.find((x) => x.id === id);
  assert.ok(p('glp1_gip').p_top3 >= 0.9, `glp1 top3: ${p('glp1_gip').p_top3}`);
  assert.ok(p('suspender_aine').p_top5 >= 0.9, `aine top5: ${p('suspender_aine').p_top5}`);
});

test('Caso B (robustez): suspender AINE e desprescrição de BZD no top 3 em ≥ 90 % das simulações', () => {
  const s = analisarSensibilidade(caso('caso-b'), kb, cfg, { n: N, tornado: false });
  const p = (id) => s.intervencoes.find((x) => x.id === id);
  assert.ok(p('suspender_aine').p_top3 >= 0.9);
  assert.ok(p('desprescricao_bzd').p_top3 >= 0.9, `bzd top3: ${p('desprescricao_bzd').p_top3}`);
});
