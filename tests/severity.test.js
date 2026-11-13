import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb } from './_helpers.js';
import { gravidadesPorModificador, calcularAlvos, kdigo } from '../src/engine/severity.js';
import { interpolar } from '../src/engine/util.js';

const sev = kb.severidade;
const g = (caso, no) => gravidadesPorModificador(caso, sev).porNo.get(no)?.gravidade;
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test('interpolação linear limitada aos extremos', () => {
  const p = [[30, 0.3], [35, 0.5], [40, 0.7]];
  perto(interpolar(p, 20), 0.3); perto(interpolar(p, 36), 0.54); perto(interpolar(p, 99), 0.7);
});

test('IMC → gravidade da obesidade (tabela da especificação)', () => {
  const u = { utente: { idade: 50, sexo: 'M' } };
  for (const [imc, esp] of [[30, 0.3], [35, 0.5], [40, 0.7], [45, 0.9], [50, 0.9]]) perto(g({ ...u, parametros: { imc } }, 'obesidade'), esp);
});

test('HbA1c → gravidade, relativa ao alvo individual', () => {
  perto(g({ utente: { idade: 60, sexo: 'M' }, parametros: { hba1c: 8 } }, 'dm2'), 0.5); // alvo 7
  perto(g({ utente: { idade: 60, sexo: 'M' }, parametros: { hba1c: 10 } }, 'dm2'), 0.9);
  // idosa ≥ 80 anos → alvo 8: HbA1c 8 lê-se como 7
  perto(g({ utente: { idade: 82, sexo: 'F' }, parametros: { hba1c: 8 } }, 'dm2'), 0.3);
  // alvo definido pelo médico
  perto(g({ utente: { idade: 60, sexo: 'M' }, alvos: { hba1c: 6.5 }, parametros: { hba1c: 7.5 } }, 'dm2'), 0.5);
});

test('alvos: frágil se CFS ≥ 5 ou idade ≥ 80', () => {
  assert.equal(calcularAlvos({ utente: { idade: 70 }, parametros: { cfs: 5 } }, sev).hba1c, 8);
  assert.equal(calcularAlvos({ utente: { idade: 70 }, parametros: { cfs: 3 } }, sev).hba1c, 7);
  assert.equal(calcularAlvos({ utente: { idade: 81 }, parametros: {} }, sev).pas, 140);
});

test('PA: aplica-se o máximo de PAS e PAD', () => {
  perto(g({ utente: { idade: 60 }, parametros: { pas: 150, pad: 100 } }, 'hta'), 0.6);
});

test('CFS: ≥ 4 instancia fragilidade; 1–3 não', () => {
  perto(g({ utente: { idade: 81 }, parametros: { cfs: 6 } }, 'fragilidade'), 0.6);
  assert.equal(g({ utente: { idade: 81 }, parametros: { cfs: 3 } }, 'fragilidade'), undefined);
});

test('KDIGO: G × A → categoria de risco', () => {
  let k = kdigo({ parametros: { tfg: 38 } }, sev);
  assert.equal(k.G, 'G3b'); assert.equal(k.A, 'A1'); assert.equal(k.risco, 'alto'); assert.equal(k.albuminuriaEmFalta, true);
  k = kdigo({ parametros: { tfg: 38, albuminuria: 350 } }, sev);
  assert.equal(k.risco, 'muito_alto'); perto(k.gravidade, 0.8);
  k = kdigo({ parametros: { tfg: 75, albuminuria: 10 } }, sev);
  assert.equal(k.risco, 'baixo');
  assert.equal(kdigo({ parametros: {} }, sev, 'G4').G, 'G4');
});

test('AUDIT-C: limiar feminino ajustado (+1)', () => {
  perto(g({ utente: { sexo: 'F' }, parametros: { auditc: 3 } }, 'alcool'), 0.3);
  perto(g({ utente: { sexo: 'M' }, parametros: { auditc: 4 } }, 'alcool'), 0.3);
});

test('NYHA discreto', () => {
  perto(g({ utente: {}, parametros: { nyha: 3 } }, 'ic'), 0.65);
});
