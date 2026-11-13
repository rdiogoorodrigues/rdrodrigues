import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caso, correr, posicao } from './_helpers.js';

const r = correr(caso('caso-b'));

test('Caso B: alerta «triple whammy» dispara', () => {
  assert.ok(r.alertas.some((a) => a.id === 'triple_whammy' && a.gravidade === 'alta'));
});

test('Caso B: suspender_aine em 1.º e desprescricao_bzd no top 3', () => {
  assert.equal(posicao(r, 'suspender_aine'), 1);
  const p = posicao(r, 'desprescricao_bzd');
  assert.ok(p >= 1 && p <= 3, `posição: ${p}`);
});

test('Caso B: alerta de fragilidade ao considerar isglt2 (e glp1_gip)', () => {
  const iv = r.ranking.find((x) => x.id === 'isglt2');
  assert.ok(iv.alertas.some((a) => a.id === 'isglt2_fragilidade'));
  assert.ok(iv.decomposicao.custos.find((c) => c.id === 'volume').amplificacao > 1);
});

test('Caso B: IECA em curso; KDIGO G3b; fragilidade CFS 6 instanciada', () => {
  assert.ok(r.em_curso.some((e) => e.id === 'ieca_ara'));
  assert.equal(r.grafo.nos.get('drc').subtipo, 'G3b');
  assert.ok(Math.abs(r.grafo.nos.get('fragilidade').gravidade - 0.6) < 1e-9);
});

test('Caso B: aviso de albuminúria em falta', () => {
  assert.ok(r.avisos.some((a) => /albuminúria/.test(a.mensagem)));
});
