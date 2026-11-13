import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb } from './_helpers.js';
import { validarKB, urlPubMed } from '../src/engine/kb.js';

test('KB sem erros de integridade referencial', () => {
  assert.deepEqual(validarKB(kb), []);
});

test('41 referências clínicas + metodológicas, todas com PMID numérico e link PubMed', () => {
  const refs = Object.values(kb.referencias);
  assert.equal(refs.filter((r) => r.tipo !== 'metodologia').length, 41);
  assert.ok(refs.some((r) => r.tipo === 'metodologia'));
  for (const r of refs) {
    assert.match(r.pmid, /^\d{6,9}$/);
    assert.equal(urlPubMed(r.pmid), `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`);
  }
});

test('ligações sem referência ficam a_validar', () => {
  for (const l of kb.ligacoes) if (!l.refs.length) assert.equal(l.a_validar, true, l.id);
});

test('ligações bidirecionais expandidas em dois arcos', () => {
  const ids = new Set(kb.ligacoes.map((l) => l.id));
  assert.ok(ids.has('obesidade->depressao') && ids.has('depressao->obesidade'));
  assert.ok(ids.has('hta->drc') && ids.has('drc->hta'));
});

test('todos os tipos de nó têm cor e forma', () => {
  for (const t of Object.values(kb.tipos)) assert.ok(t.cor && t.forma);
});

test('a KB não contém doses', () => {
  const txt = JSON.stringify([...kb.intervencoes.values()]);
  assert.doesNotMatch(txt, /\b\d+(?:[.,]\d+)?\s?(mg|mcg|µg|UI)\b|\b\d+\s?mL(?!\/min)/i);
});
