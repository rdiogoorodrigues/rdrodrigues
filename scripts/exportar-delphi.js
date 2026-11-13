// Gera o questionário da 1.ª ronda Delphi (método RAND/UCLA) a partir da KB.
// Uso: node scripts/exportar-delphi.js [--so-a-validar]
// Saída: docs/validacao/delphi-ronda1.csv (UTF-8 com BOM, separador ';', abre diretamente no Excel PT).
import fs from 'node:fs';
import path from 'node:path';
import { kbBruta, configPorDefeito } from '../src/kb/index.js';
import { prepararKB } from '../src/engine/kb.js';

const soAValidar = process.argv.includes('--so-a-validar');
const kb = prepararKB(kbBruta);
const pmids = (refs = []) => refs.map((r) => kb.referencias[r]?.pmid).filter(Boolean).join(', ');
const rot = (id) => kb.nos.get(id)?.rotulo ?? id;
const linhas = [];
const add = (o) => { if (!soAValidar || o.a_validar) linhas.push(o); };

// 1. Ligações causais (uma por par; bidirecionais uma só vez)
let i = 0;
for (const l of kbBruta.edges.ligacoes) {
  const refs = l.refs ?? [];
  add({
    id: `L${String(++i).padStart(3, '0')}`, seccao: 'Ligação causal',
    item: `${rot(l.origem)} ${l.bi ? '↔' : '→'} ${rot(l.destino)}${l.subtipo_destino ? ` (${l.subtipo_destino})` : ''}${l.atenua ? ' [atenuante]' : ''}`,
    proposta: `força ${l.forca}`, evidencia: l.evidencia, pmids: pmids(refs),
    a_validar: !refs.length || !!l.a_validar, origem: l.origem_kb === 'acrescentada' ? 'acrescentada' : 'seed',
    pergunta: 'Existe relação causal clinicamente relevante? (1–9) · A força proposta é adequada?',
  });
}

// 2. Efeitos das intervenções
i = 0;
for (const iv of kbBruta.interventions.intervencoes) {
  const efs = [...(iv.efeitos ?? []), ...(iv.variantes ?? []).flatMap((v) => (v.efeitos_extra ?? []).map((e) => ({ ...e, variante: v.rotulo })))];
  for (const e of efs) {
    add({
      id: `E${String(++i).padStart(3, '0')}`, seccao: 'Efeito de intervenção',
      item: `${iv.rotulo}${e.variante ? ` (${e.variante})` : ''} → ${rot(e.alvo)}${e.subtipo ? ` (${e.subtipo})` : ''}${e.nota ? ` — ${e.nota}` : ''}`,
      proposta: `magnitude ${e.magnitude} · horizonte ${e.horizonte}`, evidencia: '', pmids: pmids(e.refs),
      a_validar: !(e.refs?.length), origem: e.acrescentado ? 'acrescentada' : 'seed',
      pergunta: 'A magnitude proposta é adequada? (1–9) · E o horizonte (S/M/A)?',
    });
  }
  for (const c of iv.custos ?? []) {
    add({
      id: `E${String(++i).padStart(3, '0')}`, seccao: 'Custo de intervenção',
      item: `${iv.rotulo} — ${c.rotulo}`,
      proposta: `custo ${c.categoria}${(c.amplificadores ?? []).length ? ` (amplificado por: ${c.amplificadores.map((a) => `${a.no ?? a.classe ?? a.parametro} ×${a.fator}`).join(', ')})` : ''}`,
      evidencia: '', pmids: pmids(c.refs), a_validar: true, origem: 'seed',
      pergunta: 'A categoria de custo é adequada? (1–9)',
    });
  }
}

// 3. Tabelas de gravidade
i = 0;
for (const t of kbBruta.severity.tabelas) {
  const pontos = t.pontos ? t.pontos.map(([x, y]) => `${x}→${y}`).join(' · ') : Object.entries(t.discreto).map(([x, y]) => `${x}→${y}`).join(' · ');
  add({
    id: `G${String(++i).padStart(3, '0')}`, seccao: 'Tabela de gravidade',
    item: `${rot(t.no)} — ${t.parametro}${t.unidade ? ` (${t.unidade})` : ''}${t.relativo_ao_alvo ? ' [relativa ao alvo individual]' : ''}`,
    proposta: pontos, evidencia: '', pmids: '', a_validar: true, origem: 'seed',
    pergunta: 'Os pontos de corte e gravidades são adequados? (1–9)',
  });
}

// 4. Coeficientes do motor
i = 0;
const cfg = configPorDefeito;
const coef = [
  ['Peso de força na centralidade (forte/moderada/fraca)', `${cfg.forca_peso.forte} / ${cfg.forca_peso.moderada} / ${cfg.forca_peso.fraca}`],
  ['Transmissão na propagação (forte/moderada/fraca)', `${cfg.transmissao.forte} / ${cfg.transmissao.moderada} / ${cfg.transmissao.fraca}`],
  ['Redução da gravidade por magnitude (+/++/+++)', `${cfg.magnitude['+']} / ${cfg.magnitude['++']} / ${cfg.magnitude['+++']}`],
  ['Desconto da centralidade por nível', `${cfg.centralidade.desconto_por_nivel} (máx. ${cfg.centralidade.niveis_max} níveis)`],
  ['Custos (menor/moderado/major)', `${cfg.custos.menor} / ${cfg.custos.moderado} / ${cfg.custos.major}`],
  ['Peso intrínseco dos desfechos duros', Object.entries(cfg.peso_desfecho).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${rot(k)} ${v}`).join(' · ')],
  ['Peso do bónus de objetivo (G)', String(cfg.objetivo.peso_G)],
  ['Peso de benefícios a anos se CFS ≥ 7 ou idade ≥ 85 (tempo até ao benefício)', String(cfg.horizonte_peso.tempo_ate_beneficio.A)],
  ['Preferência do utente (prefere/neutro/rejeita)', `${cfg.preferencia.prefere} / ${cfg.preferencia.neutro} / ${cfg.preferencia.rejeita}`],
  ['Sensibilidade da adesão por categoria', Object.entries(cfg.adesao.k).map(([k, v]) => `${k} ${v}`).join(' · ')],
];
for (const [item, proposta] of coef) {
  add({ id: `C${String(++i).padStart(3, '0')}`, seccao: 'Coeficiente do motor', item, proposta, evidencia: '', pmids: '', a_validar: true, origem: 'desenho', pergunta: 'O valor é plausível? (1–9) · Proposta alternativa' });
}

const colunas = ['id', 'seccao', 'item', 'proposta', 'evidencia', 'pmids', 'a_validar', 'origem', 'pergunta', 'pontuacao_1a9', 'proposta_alternativa', 'comentario'];
const esc = (v) => {
  const s = v === true ? 'sim' : v === false ? 'não' : String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = '﻿' + [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => esc(l[c])).join(';'))].join('\r\n') + '\r\n';
const destino = path.resolve('docs/validacao', soAValidar ? 'delphi-ronda1-a-validar.csv' : 'delphi-ronda1.csv');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, csv);
const porSeccao = linhas.reduce((m, l) => ({ ...m, [l.seccao]: (m[l.seccao] ?? 0) + 1 }), {});
console.log(`${linhas.length} itens → ${path.relative(process.cwd(), destino)}`, porSeccao);
