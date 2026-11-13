import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caso, correr, posicao } from './_helpers.js';
import { combinar } from '../src/engine/util.js';

const perto = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('retornos decrescentes: 1 − Π(1 − eᵢ)', () => {
  perto(combinar([0.5, 0.5]), 0.75);
  perto(combinar([0.3]), 0.3);
  perto(combinar([]), 0);
});

test('decomposição: as parcelas somam a pontuação (todos os itens, ambos os casos)', () => {
  for (const id of ['caso-a', 'caso-b']) {
    for (const it of correr(caso(id)).ranking) {
      const d = it.decomposicao;
      const soma = d.beneficios.reduce((s, b) => s + b.contribuicao, 0);
      perto(soma, d.soma_beneficio);
      perto(d.multiplicador * d.soma_beneficio + d.bonus_G - d.soma_custos, it.pontuacao);
      perto(d.custos.reduce((s, c) => s + c.valor, 0), d.soma_custos);
      assert.ok(it.explicacao.length >= 2);
    }
  }
});

test('eixos C, U, M, G entre 0 e 1', () => {
  for (const it of correr(caso('caso-b')).ranking) for (const v of Object.values(it.eixos)) assert.ok(v >= 0 && v <= 1, `${it.id}: ${v}`);
});

test('metformina em curso → retornos decrescentes no efeito do GLP-1 sobre a DM2', () => {
  const r = correr(caso('caso-a'));
  assert.ok(r.em_curso.some((e) => e.id === 'metformina'));
  const b = r.ranking.find((x) => x.id === 'glp1_gip').decomposicao.beneficios.find((x) => x.no === 'dm2');
  assert.equal(b.retorno_decrescente, true);
  assert.ok(b.efeito_marginal < b.efeito);
});

test('preferência do utente: rejeição baixa a pontuação; preferência sobe', () => {
  const base = correr(caso('caso-a')).ranking.find((x) => x.id === 'glp1_gip').pontuacao;
  const c1 = caso('caso-a'); c1.preferencias.glp1_gip = 'rejeita';
  const c2 = caso('caso-a'); c2.preferencias.glp1_gip = 'prefere';
  assert.ok(correr(c1).ranking.find((x) => x.id === 'glp1_gip').pontuacao < base);
  assert.ok(correr(c2).ranking.find((x) => x.id === 'glp1_gip').pontuacao > base);
});

test('custos amplificados pela fragilidade (GLP-1: massa magra)', () => {
  const c = caso('caso-a');
  const semF = correr(c).ranking.find((x) => x.id === 'glp1_gip').decomposicao.custos.find((k) => k.id === 'massa_magra').valor;
  c.parametros.cfs = 6;
  const comF = correr(c).ranking.find((x) => x.id === 'glp1_gip').decomposicao.custos.find((k) => k.id === 'massa_magra').valor;
  perto(comF, semF * 2);
});

test('contraindicação exclui com motivo (metformina com TFG < 30)', () => {
  const c = caso('caso-a');
  c.medicacao = c.medicacao.filter((m) => m.dci !== 'metformina');
  c.parametros.tfg = 25;
  const r = correr(c);
  assert.equal(posicao(r, 'metformina'), 0);
  assert.ok(r.excluidas.find((e) => e.id === 'metformina').contraindicacao);
});

test('override clínico: sem justificação é ignorado; "desligar" remove a ligação', () => {
  const c = caso('caso-a');
  c.overrides = [{ origem: 'obesidade', destino: 'gonartrose', acao: 'desligar', justificacao: '' }];
  let r = correr(c);
  assert.ok(r.grafo.ligacoes.find((l) => l.id === 'obesidade->gonartrose' && !l.desligada));
  assert.ok(r.avisos.some((a) => a.tipo === 'override_invalido'));
  c.overrides[0].justificacao = 'Gonartrose pós-traumática documentada';
  r = correr(c);
  const l = r.grafo.ligacoes.find((x) => x.id === 'obesidade->gonartrose');
  assert.equal(l.desligada, true);
  assert.equal(l.override.justificacao, 'Gonartrose pós-traumática documentada');
});

test('override "reforçar" sobe a força um nível', () => {
  const c = caso('caso-a');
  c.overrides = [{ origem: 'obesidade', destino: 'drc', acao: 'reforcar', justificacao: 'Proteinúria' }];
  c.problemas.push({ id: 'drc' });
  const l = correr(c).grafo.ligacoes.find((x) => x.id === 'obesidade->drc');
  assert.equal(l.forca, 'forte'); assert.equal(l.forca_original, 'moderada');
});

test('ligação dependente de subtipo: obesidade → IC só para FEp (50 % se não especificado)', () => {
  const c = caso('caso-a');
  c.problemas.push({ id: 'ic', subtipo: 'FEr' });
  assert.ok(!correr(c).grafo.ligacoes.some((l) => l.id === 'obesidade->ic'));
  c.problemas.at(-1).subtipo = undefined;
  assert.equal(correr(c).grafo.ligacoes.find((l) => l.id === 'obesidade->ic').fator, 0.5);
});

test('suspensão com ponte obrigatória devolve ponte sugerida', () => {
  const it = correr(caso('caso-a')).ranking.find((x) => x.id === 'suspender_aine');
  assert.ok(it.ponte.obrigatoria);
  assert.ok(it.ponte.opcoes.some((o) => o.intervencao === 'exercicio'));
  assert.match(it.ponte.aviso, /ponte/i);
});

test('tempo até ao benefício: efeitos a anos ponderados a 50 % se CFS ≥ 7', () => {
  const c = caso('caso-b');
  const b = (r) => r.ranking.find((x) => x.id === 'isglt2').decomposicao.beneficios.find((x) => x.no === 'drc').efeito;
  const antes = b(correr(c));
  c.parametros.cfs = 7;
  perto(b(correr(c)), antes * 0.5);
});

test('intervenção sem alvos presentes é excluída', () => {
  const r = correr(caso('caso-a'));
  assert.ok(r.excluidas.some((e) => e.id === 'proteses_auditivas'));
});
