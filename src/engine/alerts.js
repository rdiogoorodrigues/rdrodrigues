// Alertas de combinação e de contexto, a partir de regras declarativas (kb/alerts.json).

export function avaliarCondicao(c, ctx) {
  if (c.todas) return c.todas.every((x) => avaliarCondicao(x, ctx));
  if (c.qualquer) return c.qualquer.some((x) => avaliarCondicao(x, ctx));
  if (c.classes) return c.classes.some((k) => ctx.classes.has(k));
  if (c.no) {
    const n = ctx.grafo.nos.get(c.no);
    return !!n && (c.gravidade_min == null || n.gravidade >= c.gravidade_min);
  }
  if (c.idade_gte != null) return (ctx.grafo.utente?.idade ?? 0) >= c.idade_gte;
  if (c.intervencao) return ctx.intervencoes.has(c.intervencao);
  if (c.sinal) return ctx.grafo.sinais.has(c.sinal);
  return false;
}

export function refereIntervencao(c) {
  if (c.intervencao) return true;
  return [...(c.todas ?? []), ...(c.qualquer ?? [])].some(refereIntervencao);
}

/**
 * @param intervencoes Set de ids de intervenções consideradas (para alertas do tipo "ao considerar X").
 * @param classesExtra classes de fármacos acrescentadas pelo cenário (simulador).
 */
export function avaliarAlertas(grafo, kb, { intervencoes = new Set(), classes = null, apenasGlobais = false } = {}) {
  const ctx = { grafo, classes: classes ?? grafo.classes, intervencoes };
  const out = [];
  for (const a of kb.alertas) {
    const porIntervencao = refereIntervencao(a.condicao);
    if (apenasGlobais && porIntervencao) continue;
    if (avaliarCondicao(a.condicao, ctx)) {
      out.push({
        id: a.id, gravidade: a.gravidade, titulo: a.titulo, mensagem: a.mensagem,
        resolvido_por: a.resolvido_por ?? [], refs: a.refs ?? [], a_validar: !!a.a_validar || !(a.refs?.length),
        contexto: porIntervencao ? 'intervencao' : 'situacao_atual',
      });
    }
  }
  return out;
}

/** Alertas que só disparam quando se considera a intervenção `id`. */
export function alertasDaIntervencao(grafo, kb, id) {
  return avaliarAlertas(grafo, kb, { intervencoes: new Set([id]) }).filter((a) => a.contexto === 'intervencao');
}
