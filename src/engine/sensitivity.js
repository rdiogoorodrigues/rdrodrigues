// Análise de sensibilidade do ranking.
//
// Pergunta: "a ordem das intervenções mantém-se se os coeficientes (não validados) e as gravidades
// por defeito (não medidas) forem outros valores plausíveis?"
//
// 1. Monte Carlo: N análises com coeficientes perturbados (1 ± amplitude, ordem preservada) e
//    gravidades por defeito amostradas no intervalo. Por intervenção: posição mediana, intervalo
//    P5–P95, probabilidade de top 1/3/5. Global: τ de Kendall face ao ranking base.
// 2. Tornado (um fator de cada vez): cada grupo de coeficientes no limite inferior e superior, e cada
//    gravidade por defeito nos extremos. Identifica o que mais muda a ordem — inclusive QUE DADO
//    CLÍNICO vale a pena medir (valor da informação).
import { analisar } from './index.js';
import { dwParaGravidade } from './severity.js';

/** PRNG determinístico (mulberry32). */
export function prng(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Grupos de coeficientes perturbáveis: caminho no config e se a ordem entre chaves tem de ser preservada.
 * 'ordem' lista as chaves por ordem crescente de valor esperado.
 */
export const GRUPOS = {
  forca_peso:    { obj: 'forca_peso', ordem: ['fraca', 'moderada', 'forte'] },
  transmissao:   { obj: 'transmissao', ordem: ['fraca', 'moderada', 'forte'], max: 0.95 },
  magnitude:     { obj: 'magnitude', ordem: ['+', '++', '+++'], max: 0.95 },
  custos:        { obj: 'custos', ordem: ['menor', 'moderado', 'major'] },
  peso_desfecho: { obj: 'peso_desfecho' },
  urgencia:      { escalares: ['urgencia.k'] },
  objetivo:      { escalares: ['objetivo.peso_G'] },
  adesao:        { obj: 'adesao.k', max: 0.95 },
  centralidade:  { escalares: ['centralidade.escala', 'centralidade.desconto_por_nivel'], max: { 'centralidade.desconto_por_nivel': 1 } },
  subtipo:       { escalares: ['subtipo_nao_especificado_fator'], max: 1 },
};

const obter = (o, caminho) => caminho.split('.').reduce((x, k) => x?.[k], o);
function definir(o, caminho, v) {
  const ks = caminho.split('.');
  const ult = ks.pop();
  ks.reduce((x, k) => x[k], o)[ult] = v;
}
const numericas = (obj) => Object.keys(obj).filter((k) => typeof obj[k] === 'number');

/**
 * Aplica multiplicadores a um grupo. `mult(chave)` devolve o multiplicador para cada coeficiente.
 * Grupos com ordem: os valores perturbados são reordenados para preservar a monotonia.
 */
export function perturbarGrupo(cfg, nome, mult) {
  const g = GRUPOS[nome];
  if (g.escalares) {
    for (const c of g.escalares) {
      const max = typeof g.max === 'object' ? g.max[c] : g.max;
      let v = obter(cfg, c) * mult(c);
      if (max != null) v = Math.min(max, v);
      definir(cfg, c, v);
    }
    return;
  }
  const alvo = obter(cfg, g.obj);
  const chaves = g.ordem ?? numericas(alvo);
  let vals = chaves.map((k) => {
    let v = alvo[k] * mult(k);
    if (g.max != null) v = Math.min(g.max, v);
    return v;
  });
  if (g.ordem) vals = [...vals].sort((a, b) => a - b);
  chaves.forEach((k, i) => { alvo[k] = vals[i]; });
}

/** τ de Kendall entre duas ordenações (listas de ids com o mesmo conjunto). */
export function kendallTau(a, b) {
  const pos = new Map(b.map((id, i) => [id, i]));
  const ids = a.filter((id) => pos.has(id));
  const n = ids.length;
  if (n < 2) return 1;
  let conc = 0, disc = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const s = pos.get(ids[i]) - pos.get(ids[j]);
    if (s < 0) conc++; else if (s > 0) disc++;
  }
  return (conc - disc) / (n * (n - 1) / 2);
}

function percentil(ordenado, p) {
  if (!ordenado.length) return null;
  const i = (p / 100) * (ordenado.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo);
}

/** Nós cuja gravidade veio do valor por defeito (dado clínico não medido). */
export function nosComGravidadePorDefeito(base) {
  return [...base.grafo.nos.values()].filter((n) => ['defeito', 'gbd_nivel_defeito'].includes(n.origem_gravidade) && n.declarado && !n.recurso).map((n) => n.id);
}

/** Amostra triangular (mín, moda, máx). */
function triangular(rnd, a, m, b) {
  const u = rnd();
  const c = (m - a) / (b - a || 1);
  return u < c ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m));
}

/**
 * Fontes de incerteza nas gravidades, por nó:
 *  - 'defeito'            gravidade por defeito (dado não medido) ~ U(intervalo do config)
 *  - 'gbd_nivel_defeito'  nível GBD não determinado → nível ~ uniforme entre níveis; DW ~ triangular no IC 95 %
 *  - 'gbd_ic'             nível GBD conhecido → DW ~ triangular no IC 95 % (incerteza empírica do GBD)
 */
export function incertezasGravidade(base, kb, cfg) {
  const [glo, ghi] = cfg.sensibilidade.gravidade_defeito_intervalo;
  const out = [];
  for (const n of base.grafo.nos.values()) {
    if (!n.declarado || n.recurso) continue;
    if (n.origem_gravidade === 'defeito') {
      out.push({ id: n.id, tipo: 'defeito', lo: glo, hi: ghi, amostrar: (r) => glo + (ghi - glo) * r() });
    } else if (n.origem_gravidade === 'gbd_nivel_defeito' || n.origem_gravidade === 'gbd') {
      const mapa = kb.dw.porNo.get(n.id);
      const estados = n.origem_gravidade === 'gbd' ? [n.gbd.estado] : [...new Set(Object.values(mapa.niveis))];
      const es = estados.map((e) => kb.dw.estados[e]);
      const g = (x) => dwParaGravidade(x, kb.dw);
      out.push({
        id: n.id, tipo: n.origem_gravidade === 'gbd' ? 'gbd_ic' : 'gbd_nivel_defeito',
        lo: g(Math.min(...es.map((e) => e.ui[0]))), hi: g(Math.max(...es.map((e) => e.ui[1]))),
        amostrar: (r) => { const e = es[Math.floor(r() * es.length)]; return g(triangular(r, e.ui[0], e.dw, e.ui[1])); },
      });
    }
  }
  return out;
}

function casoComGravidades(caso, gravs) {
  const c = structuredClone(caso);
  for (const [id, g] of Object.entries(gravs)) {
    const p = c.problemas.find((x) => x.id === id);
    if (p) p.gravidade = g; else c.problemas.push({ id, gravidade: g });
  }
  return c;
}

/**
 * @param opcoes { n, semente, modo: 'ambos'|'coeficientes'|'gravidades', tornado: bool, amplitudes }
 */
export function analisarSensibilidade(caso, kb, config, opcoes = {}) {
  const sc = config.sensibilidade;
  const n = opcoes.n ?? sc.n;
  const semente = opcoes.semente ?? sc.semente;
  const modo = opcoes.modo ?? 'ambos';
  const amplitudes = { ...sc.amplitudes, ...(opcoes.amplitudes ?? {}) };
  const [glo, ghi] = sc.gravidade_defeito_intervalo;
  const [p5, p95] = sc.percentis;
  const rnd = prng(semente);

  const base = analisar(caso, kb, config);
  const ordemBase = base.ranking.map((r) => r.id);
  const incertos = nosComGravidadePorDefeito(base);
  const incertezas = incertezasGravidade(base, kb, config);

  const posicoes = new Map(ordemBase.map((id) => [id, []]));
  const pontuacoes = new Map(ordemBase.map((id) => [id, []]));
  const taus = [];

  for (let s = 0; s < n; s++) {
    const cfg = structuredClone(config);
    if (modo !== 'gravidades') {
      for (const nome of Object.keys(GRUPOS)) {
        const a = amplitudes[nome] ?? 0;
        perturbarGrupo(cfg, nome, () => 1 - a + 2 * a * rnd());
      }
    }
    let c = caso;
    if (modo !== 'coeficientes' && incertezas.length) {
      c = casoComGravidades(caso, Object.fromEntries(incertezas.map((x) => [x.id, x.amostrar(rnd)])));
    }
    const r = analisar(c, kb, cfg);
    const ordem = r.ranking.map((x) => x.id);
    ordem.forEach((id, i) => {
      posicoes.get(id)?.push(i + 1);
      pontuacoes.get(id)?.push(r.ranking[i].pontuacao);
    });
    taus.push(kendallTau(ordemBase, ordem));
  }

  const est = sc.estabilidade;
  const intervencoes = base.ranking.map((it) => {
    const ps = posicoes.get(it.id).sort((a, b) => a - b);
    const sc_ = pontuacoes.get(it.id).sort((a, b) => a - b);
    const lo = percentil(ps, p5), hi = percentil(ps, p95);
    const amplitude = Math.round(hi) - Math.round(lo);
    const freq = (k) => ps.filter((p) => p <= k).length / ps.length;
    return {
      id: it.id, rotulo: it.rotulo,
      posicao_base: it.posicao,
      posicao_mediana: percentil(ps, 50), posicao_p5: Math.round(lo), posicao_p95: Math.round(hi),
      p_top1: freq(1), p_top3: freq(3), p_top5: freq(5),
      pontuacao_p5: percentil(sc_, p5), pontuacao_p50: percentil(sc_, 50), pontuacao_p95: percentil(sc_, p95),
      estabilidade: amplitude <= est.estavel_max_amplitude ? 'estável' : amplitude <= est.moderada_max_amplitude ? 'moderada' : 'instável',
    };
  });

  const tausOrd = [...taus].sort((a, b) => a - b);
  const resultado = {
    n, semente, modo, amplitudes, intervalo_gravidade_defeito: [glo, ghi],
    ordem_base: ordemBase,
    nos_gravidade_por_defeito: incertos,
    incertezas_gravidade: incertezas.map(({ id, tipo, lo, hi }) => ({ id, tipo, lo, hi })),
    fonte_sintomatica: config.gravidade.fonte_sintomatica,
    intervencoes,
    kendall_tau: { media: taus.reduce((s, t) => s + t, 0) / (taus.length || 1), p5: percentil(tausOrd, p5), mediana: percentil(tausOrd, 50) },
    p_mesmo_top1: intervencoes[0]?.p_top1 ?? null,
  };
  if (opcoes.tornado !== false) resultado.tornado = tornado(caso, kb, config, { base, ordemBase, amplitudes, incertezas });
  return resultado;
}

/** Análise um-fator-de-cada-vez. Ordenada por influência (1 − τ mínimo). */
export function tornado(caso, kb, config, ctx) {
  const { ordemBase, amplitudes, incertezas } = ctx;
  const top1 = ordemBase[0];
  const avaliar = (c, cfg) => {
    const ordem = analisar(c, kb, cfg).ranking.map((x) => x.id);
    return { tau: kendallTau(ordemBase, ordem), top1: ordem[0], top3: ordem.slice(0, 3) };
  };
  const linhas = [];
  for (const nome of Object.keys(GRUPOS)) {
    const a = amplitudes[nome] ?? 0;
    if (!a) continue;
    const r = [1 - a, 1 + a].map((m) => {
      const cfg = structuredClone(config);
      perturbarGrupo(cfg, nome, () => m);
      return avaliar(caso, cfg);
    });
    linhas.push({ fator: nome, tipo: 'coeficiente', baixo: r[0], alto: r[1] });
  }
  for (const x of incertezas) {
    const r = [x.lo, x.hi].map((g) => avaliar(casoComGravidades(caso, { [x.id]: g }), config));
    const tipo = x.tipo === 'gbd_ic' ? 'incerteza_gbd' : 'gravidade_por_defeito';
    linhas.push({ fator: x.id, tipo, subtipo: x.tipo, rotulo: kb.nos.get(x.id)?.rotulo, baixo: r[0], alto: r[1] });
  }
  for (const l of linhas) {
    l.influencia = 1 - Math.min(l.baixo.tau, l.alto.tau);
    l.muda_top1 = l.baixo.top1 !== top1 || l.alto.top1 !== top1;
  }
  return linhas.sort((x, y) => y.influencia - x.influencia);
}
