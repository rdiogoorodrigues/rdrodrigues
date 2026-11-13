// Motor de priorização de INTERVENÇÕES.
//
// pontuação = U × M_adesão × M_preferência × ajuste_evidência × Σ_n [e_n × importância_n] + G − Σ custos
//   e_n          = magnitude × fator_subtipo × peso_horizonte, com retornos decrescentes face ao que já está
//                  em curso no mesmo nó: e_marginal = e × Π(1 − e_em_curso)
//   importância  = gravidade_n × (1 + max(C_residual_n, peso_desfecho_n)); a C residual exclui os outros alvos diretos da intervenção
//                  (evita contar o mesmo benefício a jusante duas vezes)
//   U            = 1 + k × max(alarme dos alvos, alertas resolvidos pela intervenção)
//   G            = peso_G × Σ_objetivos max_alvo [e_alvo × força do caminho alvo → objetivo]
// Todos os coeficientes estão em config.json (a_validar).
import { centralidade } from './centrality.js';
import { melhorForca } from './paths.js';
import { fatorAdesao } from './adherence.js';
import { alertasDaIntervencao } from './alerts.js';
import { adjacencia } from './graph.js';
import { combinar, limitar, arred } from './util.js';
import { eFragil } from './severity.js';

function pesoHorizonte(grafo, cfg) {
  const h = { ...cfg.horizonte_peso.padrao };
  const crit = cfg.horizonte_peso.criterio;
  const cfs = grafo.parametros?.cfs;
  if ((cfs != null && cfs >= crit.cfs_gte) || (grafo.utente?.idade ?? 0) >= crit.idade_gte) {
    Object.assign(h, cfg.horizonte_peso.tempo_ate_beneficio);
    h.reduzido = true;
  }
  return h;
}

function fatorSubtipoEfeito(efeito, no, cfg) {
  if (!efeito.subtipo) return 1;
  if (!no.subtipo) return cfg.subtipo_nao_especificado_fator;
  return no.subtipo === efeito.subtipo ? 1 : 0;
}

/** A intervenção está em curso? (classe já prescrita ou marcada manualmente) */
export function emCurso(iv, grafo, caso) {
  if ((caso.em_curso ?? []).includes(iv.id)) return { em_curso: true, motivo: 'Marcada como em curso' };
  const cl = (iv.classes_em_curso ?? []).filter((c) => grafo.classes.has(c));
  if (cl.length) {
    const f = grafo.medicacao.filter((m) => m.ativo && cl.includes(m.classe)).map((m) => m.dci);
    return { em_curso: true, motivo: `Já prescrito: ${f.join(', ')}` };
  }
  return { em_curso: false };
}

/** Elegibilidade: requisitos, contraindicações e existência de alvos presentes. */
export function elegibilidade(iv, grafo, caso) {
  const r = iv.requer ?? {};
  if (r.algum_no && !r.algum_no.some((id) => grafo.nos.has(id))) {
    return { elegivel: false, motivo: `Requer: ${r.algum_no.join(' / ')}` };
  }
  if (r.alguma_classe && !r.alguma_classe.some((c) => grafo.classes.has(c))) {
    return { elegivel: false, motivo: `Requer medicação: ${r.alguma_classe.join(' / ')}` };
  }
  if (r.sinal && !grafo.sinais.has(r.sinal)) return { elegivel: false, motivo: `Requer sinal: ${r.sinal}` };
  for (const ci of iv.contraindicacoes ?? []) {
    const v = caso.parametros?.[ci.parametro];
    if (v != null && ((ci.lt != null && v < ci.lt) || (ci.gt != null && v > ci.gt))) {
      return { elegivel: false, motivo: ci.mensagem, contraindicacao: true };
    }
  }
  const alvos = (iv.efeitos ?? []).filter((e) => grafo.nos.has(e.alvo) && fatorSubtipoEfeito(e, grafo.nos.get(e.alvo), { subtipo_nao_especificado_fator: 1 }) > 0);
  if (!alvos.length) return { elegivel: false, motivo: 'Nenhum alvo presente neste utente' };
  return { elegivel: true };
}

function amplificacao(custo, grafo) {
  let fator = 1;
  const motivos = [];
  for (const a of custo.amplificadores ?? []) {
    let ativo = false;
    if (a.no) ativo = grafo.nos.has(a.no);
    else if (a.classe) ativo = grafo.classes.has(a.classe);
    else if (a.parametro === 'idade') ativo = (grafo.utente?.idade ?? 0) >= a.gte;
    else if (a.parametro) ativo = (grafo.parametros?.[a.parametro] ?? -Infinity) >= a.gte;
    if (ativo) { fator *= a.fator; motivos.push(a.no ?? a.classe ?? `${a.parametro} ≥ ${a.gte}`); }
  }
  return { fator, motivos };
}

/** Efeito já em curso (de intervenções em curso) sobre cada nó: para retornos decrescentes. */
export function efeitosEmCurso(ivsEmCurso, grafo, cfg, ph) {
  const porNo = new Map();
  for (const iv of ivsEmCurso) {
    for (const e of iv.efeitos ?? []) {
      const n = grafo.nos.get(e.alvo);
      if (!n) continue;
      const v = cfg.magnitude[e.magnitude] * fatorSubtipoEfeito(e, n, cfg) * (ph[e.horizonte] ?? 1);
      if (!porNo.has(e.alvo)) porNo.set(e.alvo, []);
      porNo.get(e.alvo).push({ intervencao: iv.id, efeito: v });
    }
  }
  return porNo;
}

/**
 * Pontua uma intervenção. Devolve a pontuação e a decomposição completa.
 * @param ctx {grafo, kb, cfg, caso, C (Map), emCursoPorNo (Map), alertasGlobais, ph, adj}
 */
export function pontuarIntervencao(iv, ctx) {
  const { grafo, kb, cfg, caso } = ctx;
  const ph = ctx.ph;
  const alvosIds = new Set((iv.efeitos ?? []).filter((e) => grafo.nos.has(e.alvo)).map((e) => e.alvo));

  // 1. Benefícios diretos
  const beneficios = [];
  for (const e of iv.efeitos ?? []) {
    const n = grafo.nos.get(e.alvo);
    if (!n) continue;
    const fs = fatorSubtipoEfeito(e, n, cfg);
    if (fs === 0) continue;
    const bruto = cfg.magnitude[e.magnitude] * fs * (ph[e.horizonte] ?? 1);
    const existentes = (ctx.emCursoPorNo.get(e.alvo) ?? []).filter((x) => x.intervencao !== iv.id).map((x) => x.efeito);
    const marginal = combinar([...existentes, bruto]) - combinar(existentes);
    const excluir = new Set([...alvosIds].filter((id) => id !== e.alvo));
    const cr = centralidade(grafo, e.alvo, cfg, { excluir, adj: ctx.adj });
    const pesoDesfecho = cfg.peso_desfecho?.[e.alvo] ?? 0;
    const importancia = n.gravidade * (1 + Math.max(cr.C, pesoDesfecho));
    beneficios.push({
      no: e.alvo, rotulo: n.rotulo, magnitude: e.magnitude, horizonte: e.horizonte, subtipo: e.subtipo ?? null,
      fator_subtipo: fs, efeito: bruto, efeito_marginal: marginal, retorno_decrescente: existentes.length > 0,
      gravidade: n.gravidade, C_residual: cr.C, peso_desfecho: pesoDesfecho, C: ctx.C.get(e.alvo)?.C ?? 0, importancia,
      contribuicao: marginal * importancia, refs: e.refs ?? [], a_validar: !(e.refs?.length), nota: e.nota ?? null,
      acrescentado: !!e.acrescentado,
    });
  }
  const somaBeneficio = beneficios.reduce((s, b) => s + b.contribuicao, 0);

  // 2. Urgência
  const lim = cfg.urgencia.limiar_gravidade;
  let uAlvos = 0;
  for (const b of beneficios) {
    const n = grafo.nos.get(b.no);
    const u = n.alarme ? cfg.urgencia.alarme_manual : Math.max(0, (n.gravidade - lim) / (1 - lim));
    uAlvos = Math.max(uAlvos, u);
  }
  const alertasResolvidos = ctx.alertasGlobais.filter((a) => a.resolvido_por.includes(iv.id));
  const uAlertas = alertasResolvidos.reduce((m, a) => Math.max(m, a.gravidade === 'alta' ? cfg.urgencia.alerta_alta : cfg.urgencia.alerta_moderada), 0);
  const U = limitar(Math.max(uAlvos, uAlertas));
  const fatorU = 1 + cfg.urgencia.k * U;

  // 3. Modificabilidade: adesão × preferência
  const ad = fatorAdesao(grafo, iv.categoria, cfg);
  const prefChave = caso.preferencias?.[iv.id] ?? 'neutro';
  const fatorPref = cfg.preferencia[prefChave] ?? 1;
  const fatorEvid = iv.ajuste_evidencia?.fator ?? 1;

  // 4. Bónus G — caminho até aos objetivos
  const porObjetivo = [];
  for (const obj of grafo.objetivos) {
    let melhor = { valor: 0, no: null, forca: 0 };
    for (const b of beneficios) {
      const f = melhorForca(grafo, b.no, obj.id, cfg.objetivo.saltos_max, cfg, ctx.adjObj);
      const v = b.efeito_marginal * f;
      if (v > melhor.valor) melhor = { valor: v, no: b.no, forca: f };
    }
    porObjetivo.push({ objetivo: obj.id, texto: obj.texto, ...melhor });
  }
  const Gbruto = porObjetivo.reduce((s, o) => s + o.valor, 0);
  const bonusG = cfg.objetivo.peso_G * Gbruto;

  // 5. Custos
  const custos = [];
  for (const c of iv.custos ?? []) {
    const amp = amplificacao(c, grafo);
    custos.push({ id: c.id, rotulo: c.rotulo, categoria: c.categoria, base: cfg.custos[c.categoria], amplificacao: amp.fator, motivos_amplificacao: amp.motivos, valor: cfg.custos[c.categoria] * amp.fator, refs: c.refs ?? [] });
  }
  let ponte = null;
  if (iv.ponte) {
    // No ranking assume-se que a ponte É feita (custo menor) e emite-se aviso obrigatório; no simulador, sem ponte → custo major.
    const cp = iv.ponte.custo_com_ponte;
    custos.push({ id: cp.id, rotulo: cp.rotulo, categoria: cp.categoria, base: cfg.custos[cp.categoria], amplificacao: 1, motivos_amplificacao: [], valor: cfg.custos[cp.categoria], refs: [], assume_ponte: true });
    ponte = {
      obrigatoria: !!iv.ponte.obrigatoria,
      opcoes: iv.ponte.opcoes,
      aviso: `Exige ponte: ${iv.ponte.opcoes.map((o) => o.rotulo).join(' · ')}. Sem ponte: ${iv.ponte.custo_sem_ponte.rotulo.toLowerCase()}.`,
      custo_sem_ponte: iv.ponte.custo_sem_ponte,
    };
  }
  for (const cr of iv.cria ?? []) {
    if (cr.tipo === 'agrava') {
      const n = grafo.nos.get(cr.alvo);
      const g = n ? n.gravidade * (1 + Math.max(ctx.C.get(cr.alvo)?.C ?? 0, cfg.peso_desfecho?.[cr.alvo] ?? 0)) : 0.1;
      custos.push({ id: `cria:${cr.alvo}`, rotulo: `Agrava ${kb.nos.get(cr.alvo).rotulo.toLowerCase()}: ${cr.nota}`, categoria: 'cria', base: cfg.magnitude[cr.magnitude] * g, amplificacao: cfg.custo_agrava_fator, motivos_amplificacao: [], valor: cfg.magnitude[cr.magnitude] * g * cfg.custo_agrava_fator, cria: cr });
    } else if (cr.tipo === 'novo_no') {
      custos.push({ id: `cria:${cr.no}`, rotulo: `Pode causar ${kb.nos.get(cr.no).rotulo.toLowerCase()}: ${cr.nota}`, categoria: 'cria', base: cr.gravidade, amplificacao: cfg.custo_novo_no_fator, motivos_amplificacao: [], valor: cr.gravidade * cfg.custo_novo_no_fator, cria: cr });
    }
  }
  const somaCustos = custos.reduce((s, c) => s + c.valor, 0);

  const multiplicador = fatorU * ad.fator * fatorPref * fatorEvid;
  const beneficioAjustado = multiplicador * somaBeneficio;
  const pontuacao = beneficioAjustado + bonusG - somaCustos;

  // 6. Eixos 0–1 (espaço de prioridade)
  const pesoTot = beneficios.reduce((s, b) => s + b.efeito_marginal * b.gravidade, 0) || 1;
  const eixoC = beneficios.reduce((s, b) => s + b.C * b.efeito_marginal * b.gravidade, 0) / pesoTot;
  const maxEf = beneficios.reduce((m, b) => Math.max(m, b.efeito_marginal), 0);
  const eixoM = limitar((maxEf / cfg.magnitude['+++']) * ad.fator * Math.min(1, fatorPref) * fatorEvid);
  const eixoG = 1 - Math.exp(-Gbruto / cfg.objetivo.escala_eixo);

  const alertas = alertasDaIntervencao(grafo, kb, iv.id);
  const a_validar = !!iv.a_validar || beneficios.some((b) => b.a_validar);

  return {
    id: iv.id, rotulo: iv.rotulo, rotulo_utente: iv.rotulo_utente, categoria: iv.categoria,
    pontuacao,
    eixos: { C: eixoC, U, M: eixoM, G: eixoG },
    decomposicao: {
      beneficios: beneficios.sort((a, b) => b.contribuicao - a.contribuicao),
      soma_beneficio: somaBeneficio,
      fator_U: fatorU, U_alvos: uAlvos, U_alertas: uAlertas, alertas_resolvidos: alertasResolvidos.map((a) => a.id),
      fator_adesao: ad.fator, g_ma_adesao: ad.g_ma_adesao, k_adesao: ad.k,
      preferencia: prefChave, fator_preferencia: fatorPref,
      ajuste_evidencia: iv.ajuste_evidencia ?? null, fator_evidencia: fatorEvid,
      multiplicador, beneficio_ajustado: beneficioAjustado,
      G_bruto: Gbruto, bonus_G: bonusG, G_por_objetivo: porObjetivo,
      custos, soma_custos: somaCustos,
      horizonte_reduzido: !!ph.reduzido,
      total: pontuacao,
    },
    alertas, ponte,
    efeitos_nulos: iv.efeitos_nulos ?? [],
    variantes: iv.variantes ?? [],
    sinergias: iv.sinergias ?? [],
    beneficios_qualitativos: iv.beneficios_qualitativos ?? [],
    a_validar,
  };
}

/** Explicação textual curta ("porque está nesta posição"). */
export function explicar(item, posicao) {
  const d = item.decomposicao;
  const f = (v) => arred(v, 2).toLocaleString('pt-PT');
  const top = d.beneficios.slice(0, 3).map((b) => `${b.rotulo} (${b.magnitude}, contribui ${f(b.contribuicao)})`);
  const linhas = [`${posicao}.º lugar — pontuação ${f(item.pontuacao)}.`];
  if (top.length) linhas.push(`Maiores contributos: ${top.join('; ')}.`);
  if (d.fator_U > 1) linhas.push(`Urgência ×${f(d.fator_U)}${d.alertas_resolvidos.length ? ` (resolve: ${d.alertas_resolvidos.join(', ')})` : ''}.`);
  if (d.fator_adesao < 1) linhas.push(`Adesão prevista ×${f(d.fator_adesao)}.`);
  if (d.fator_preferencia !== 1) linhas.push(`Preferência do utente (${d.preferencia}) ×${f(d.fator_preferencia)}.`);
  if (d.fator_evidencia !== 1) linhas.push(`Ajuste de evidência ×${f(d.fator_evidencia)}: ${d.ajuste_evidencia.motivo}.`);
  if (d.bonus_G > 0) {
    const o = d.G_por_objetivo.filter((x) => x.valor > 0).map((x) => `«${x.texto}» via ${x.no}`);
    linhas.push(`Bónus de objetivo +${f(d.bonus_G)} (${o.join('; ')}).`);
  }
  if (d.custos.length) linhas.push(`Custos −${f(d.soma_custos)}: ${d.custos.map((c) => c.rotulo).join('; ')}.`);
  if (item.ponte) linhas.push(item.ponte.aviso);
  return linhas;
}

/** Ranking completo. */
export function priorizar(grafo, caso, kb, cfg, { C, alertasGlobais }) {
  const ph = pesoHorizonte(grafo, cfg);
  const adj = adjacencia(grafo, { incluirObjetivos: false });
  const adjObj = adjacencia(grafo, { incluirObjetivos: true });
  const ranking = [];
  const emCursoLista = [];
  const excluidas = [];
  const ivsEmCurso = [];
  for (const iv of kb.intervencoes.values()) {
    const ec = emCurso(iv, grafo, caso);
    if (ec.em_curso) { ivsEmCurso.push(iv); emCursoLista.push({ id: iv.id, rotulo: iv.rotulo, motivo: ec.motivo }); }
  }
  const emCursoPorNo = efeitosEmCurso(ivsEmCurso, grafo, cfg, ph);
  const ctx = { grafo, kb, cfg, caso, C, emCursoPorNo, alertasGlobais, ph, adj, adjObj };
  for (const iv of kb.intervencoes.values()) {
    if (ivsEmCurso.includes(iv)) continue;
    const el = elegibilidade(iv, grafo, caso);
    if (!el.elegivel) { excluidas.push({ id: iv.id, rotulo: iv.rotulo, motivo: el.motivo, contraindicacao: !!el.contraindicacao }); continue; }
    ranking.push(pontuarIntervencao(iv, ctx));
  }
  ranking.sort((a, b) => b.pontuacao - a.pontuacao);
  ranking.forEach((r, i) => { r.posicao = i + 1; r.explicacao = explicar(r, i + 1); });
  return { ranking, em_curso: emCursoLista, excluidas, peso_horizonte: ph, fragil: eFragil(caso, kb.severidade.alvos.criterio_fragil) };
}
