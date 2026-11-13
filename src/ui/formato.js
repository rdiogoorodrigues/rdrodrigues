// Formatação e rótulos da interface (PT-PT). Sem lógica clínica.
const f2 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
const fdw = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const num = (v) => (v == null || Number.isNaN(v) ? '—' : f2.format(v));
export const dw = (v) => fdw.format(v);
export const pct = (v) => (v == null ? '—' : `${f0.format(v * 100)} %`);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const MAGNITUDE = { '+': 'pequeno', '++': 'moderado', '+++': 'grande' };
export const HORIZONTE = { S: 'semanas', M: 'meses', A: 'anos' };
export const FORCA = { forte: 'forte', moderada: 'moderada', fraca: 'fraca' };
export const CAMADAS = [
  'Determinantes e recursos',
  'Comportamentos e medicação',
  'Doenças de base',
  'Doenças de órgão-alvo',
  'Complicações, riscos e funcionalidade',
  'Objetivos do utente',
];

export function categoriaGravidade(g) {
  if (g == null) return '—';
  if (g < 0.34) return 'ligeira';
  if (g < 0.67) return 'moderada';
  return 'grave';
}

const ORIGEM = {
  manual: 'introduzida pelo médico',
  modificador: 'calculada a partir de parâmetros clínicos',
  defeito: 'valor por defeito (dado não medido)',
  derivada: 'derivada dos problemas a montante',
  gbd: 'disability weight do GBD 2013',
  gbd_nivel_defeito: 'GBD 2013 — nível não determinado (por defeito)',
  dcv_estabelecida: 'doença CV estabelecida (risco muito alto)',
  objetivo: 'objetivo do utente',
};
export function origemGravidade(o) {
  if (!o) return '—';
  if (o.startsWith('alerta:')) return `elevada pelo alerta «${o.slice(7)}»`;
  return ORIGEM[o] ?? o;
}

export const PREFERENCIA = { prefere: 'Prefere', neutro: 'Neutro', rejeita: 'Rejeita' };
export const ESTADO_MED = { novo: 'novo', alterado: 'alterado', manter: 'manter', suspenso: 'suspenso' };

/** Link PubMed — abre só com clique, sem referrer. */
export function linkPubMed(pmid) {
  return `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/" target="_blank" rel="noopener noreferrer">PMID ${esc(pmid)}</a>`;
}
export function refsHTML(kb, refs) {
  if (!refs?.length) return '<span class="etq validar">sem referência — a validar</span>';
  return refs.map((k) => {
    const r = kb.referencias[k];
    if (!r) return `<span class="etq validar">${esc(k)} (desconhecida)</span>`;
    return `<span class="citacao" title="${esc(r.titulo)}">${esc(r.citacao)} · ${linkPubMed(r.pmid)}</span>`;
  }).join('<br>');
}

export const etqValidar = '<span class="etq validar" title="Entrada sem validação clínica ou sem referência verificada">a validar</span>';
