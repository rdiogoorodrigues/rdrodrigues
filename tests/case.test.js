import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb, caso, correr } from './_helpers.js';
import { validarCaso, exportarCaso, importarCaso, casoVazio } from '../src/engine/case.js';

test('casos de exemplo cumprem o conjunto mínimo', () => {
  for (const id of ['caso-a', 'caso-b']) assert.deepEqual(validarCaso(caso(id), kb).erros, []);
});

test('caso vazio: erros do conjunto mínimo, mas o motor não falha', () => {
  const v = validarCaso(casoVazio(), kb);
  assert.ok(v.erros.some((e) => /idade/i.test(e)));
  assert.ok(v.erros.some((e) => /objetivo/i.test(e)));
  assert.doesNotThrow(() => correr(casoVazio()));
});

test('grafo funciona só com o conjunto mínimo', () => {
  const c = { ...casoVazio(), utente: { idade: 55, sexo: 'F' }, problemas: [{ id: 'hta' }], objetivos: [{ texto: 'Sentir-me bem', nos: ['hta'] }] };
  const r = correr(c);
  assert.deepEqual(r.validacao.erros, []);
  assert.ok(r.grafo.nos.has('hta') && r.grafo.nos.has('eventos_cv'));
  assert.ok(r.ranking.length > 0);
});

test('identificadores pessoais: detetados na validação e removidos na exportação/importação', () => {
  const c = caso('caso-a');
  c.utente.nome = 'Fulano';
  c.nif = '123';
  assert.ok(validarCaso(c, kb).erros.some((e) => /identificação/i.test(e)));
  const txt = exportarCaso(c);
  assert.doesNotMatch(txt, /Fulano|"nif"/);
  const imp = importarCaso(JSON.stringify(c));
  assert.equal(imp.utente.nome, undefined);
});

test('exportar → importar preserva o caso', () => {
  const c = caso('caso-b');
  assert.deepEqual(importarCaso(exportarCaso(c)), { ...casoVazio(), ...c });
});

test('importação de JSON inválido falha com mensagem clara', () => {
  assert.throws(() => importarCaso('{x'), /JSON válido/);
  assert.throws(() => importarCaso('{"a":1}'), /formato/);
});
