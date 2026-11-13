// Preparação e validação da base de conhecimento.
import { normalizar } from './util.js';

const TIPOS_VALIDOS = ['doenca', 'comportamento', 'determinante', 'funcionalidade', 'medicacao', 'objetivo_recurso', 'risco'];
const FORCAS = ['forte', 'moderada', 'fraca'];
const MAGNITUDES = ['+', '++', '+++'];
const HORIZONTES = ['S', 'M', 'A'];

/**
 * Converte a KB bruta (JSON) em estruturas indexadas.
 * Ligações bidirecionais são expandidas em dois arcos dirigidos.
 */
export function prepararKB(bruta) {
  const nos = new Map(bruta.nodes.nos.map((n) => [n.id, { ...n, a_validar: !!n.a_validar }]));
  const referencias = bruta.references.referencias;

  const ligacoes = [];
  for (const l of bruta.edges.ligacoes) {
    const base = {
      ...l,
      refs: l.refs ?? [],
      a_validar: !!l.a_validar || !(l.refs && l.refs.length),
      bi: !!l.bi,
      atenua: !!l.atenua,
    };
    ligacoes.push({ ...base, id: `${l.origem}->${l.destino}` });
    if (l.bi) {
      ligacoes.push({ ...base, id: `${l.destino}->${l.origem}`, origem: l.destino, destino: l.origem, subtipo_destino: undefined });
    }
  }

  const intervencoes = new Map(bruta.interventions.intervencoes.map((i) => [i.id, i]));

  const dci = {};
  for (const [k, v] of Object.entries(bruta.drugs.dci)) dci[normalizar(k)] = v;

  return {
    tipos: bruta.nodes.tipos,
    nos,
    ligacoes,
    intervencoes,
    categorias: bruta.interventions.categorias,
    referencias,
    severidade: bruta.severity,
    farmacos: { classes: bruta.drugs.classes, dci },
    alertas: bruta.alerts.alertas,
  };
}

/** Integridade referencial da KB. Devolve lista de erros (vazia = OK). */
export function validarKB(kb) {
  const erros = [];
  const refOk = (r, ctx) => {
    if (!kb.referencias[r]) erros.push(`${ctx}: referência desconhecida '${r}'`);
    else if (!/^\d{6,9}$/.test(kb.referencias[r].pmid)) erros.push(`${ctx}: PMID inválido para '${r}'`);
  };
  const noOk = (id, ctx) => { if (!kb.nos.has(id)) erros.push(`${ctx}: nó desconhecido '${id}'`); };

  for (const n of kb.nos.values()) {
    if (!TIPOS_VALIDOS.includes(n.tipo)) erros.push(`nó ${n.id}: tipo inválido '${n.tipo}'`);
    if (!kb.tipos[n.tipo]) erros.push(`nó ${n.id}: tipo sem definição visual`);
  }
  for (const l of kb.ligacoes) {
    noOk(l.origem, `ligação ${l.id}`);
    noOk(l.destino, `ligação ${l.id}`);
    if (!FORCAS.includes(l.forca)) erros.push(`ligação ${l.id}: força inválida`);
    l.refs.forEach((r) => refOk(r, `ligação ${l.id}`));
    if (l.subtipo_destino) {
      const d = kb.nos.get(l.destino);
      if (!d?.subtipos?.includes(l.subtipo_destino)) erros.push(`ligação ${l.id}: subtipo '${l.subtipo_destino}' inexistente`);
    }
  }
  for (const iv of kb.intervencoes.values()) {
    if (!kb.categorias[iv.categoria]) erros.push(`intervenção ${iv.id}: categoria inválida`);
    const efs = [...(iv.efeitos ?? []), ...(iv.variantes ?? []).flatMap((v) => v.efeitos_extra ?? [])];
    for (const e of efs) {
      noOk(e.alvo, `intervenção ${iv.id}`);
      if (!MAGNITUDES.includes(e.magnitude)) erros.push(`intervenção ${iv.id}: magnitude inválida em ${e.alvo}`);
      if (!HORIZONTES.includes(e.horizonte)) erros.push(`intervenção ${iv.id}: horizonte inválido em ${e.alvo}`);
      (e.refs ?? []).forEach((r) => refOk(r, `intervenção ${iv.id}/${e.alvo}`));
    }
    for (const c of [...(iv.cria ?? []), ...(iv.variantes ?? []).flatMap((v) => v.cria ?? [])]) {
      noOk(c.tipo === 'novo_no' ? c.no : c.alvo, `intervenção ${iv.id} (cria)`);
    }
    for (const id of iv.requer?.algum_no ?? []) noOk(id, `intervenção ${iv.id} (requer)`);
    for (const c of iv.requer?.alguma_classe ?? []) if (!kb.farmacos.classes[c]) erros.push(`intervenção ${iv.id}: classe '${c}' desconhecida`);
    for (const c of iv.classes_em_curso ?? []) if (!kb.farmacos.classes[c]) erros.push(`intervenção ${iv.id}: classe em curso '${c}' desconhecida`);
    (iv.refs ?? []).forEach((r) => refOk(r, `intervenção ${iv.id}`));
    (iv.ajuste_evidencia?.refs ?? []).forEach((r) => refOk(r, `intervenção ${iv.id} (ajuste)`));
    for (const o of iv.ponte?.opcoes ?? []) if (o.intervencao && !kb.intervencoes.has(o.intervencao)) erros.push(`intervenção ${iv.id}: ponte '${o.intervencao}' desconhecida`);
  }
  for (const [d, c] of Object.entries(kb.farmacos.dci)) if (!kb.farmacos.classes[c]) erros.push(`fármaco ${d}: classe '${c}' desconhecida`);
  for (const a of kb.alertas) {
    (a.resolvido_por ?? []).forEach((id) => { if (!kb.intervencoes.has(id)) erros.push(`alerta ${a.id}: intervenção '${id}' desconhecida`); });
    (a.refs ?? []).forEach((r) => refOk(r, `alerta ${a.id}`));
  }
  for (const t of kb.severidade.tabelas) noOk(t.no, `tabela ${t.id}`);
  return erros;
}

export function urlPubMed(pmid) {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}
