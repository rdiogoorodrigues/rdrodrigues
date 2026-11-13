// Modificadores clínicos → gravidade (0–1). Tabelas em kb.severidade (a_validar).
import { interpolar, limitar } from './util.js';

/** O utente cumpre o critério de "frágil/idoso" para efeitos de alvos individualizados? */
export function eFragil(caso, criterio) {
  const cfs = caso.parametros?.cfs;
  return (cfs != null && cfs >= criterio.cfs_gte) || (caso.utente?.idade ?? 0) >= criterio.idade_gte;
}

/** Alvos individuais (HbA1c, PAS, PAD). caso.alvos sobrepõe-se aos defeitos. */
export function calcularAlvos(caso, sev) {
  const fragil = eFragil(caso, sev.alvos.criterio_fragil);
  const alvos = { fragil };
  for (const k of ['hba1c', 'pas', 'pad']) {
    const def = sev.alvos[k];
    alvos[k] = caso.alvos?.[k] ?? (fragil ? def.fragil : def.padrao);
  }
  return alvos;
}

/** Categoria KDIGO (G, A) e gravidade correspondente. */
export function kdigo(caso, sev, subtipoDeclarado) {
  const k = sev.kdigo;
  const p = caso.parametros ?? {};
  let G = subtipoDeclarado && /^G/.test(subtipoDeclarado) ? subtipoDeclarado : null;
  if (p.tfg != null) G = k.tfg.find(([lim]) => p.tfg >= lim)[1];
  if (!G) return null;
  let A = 'A1';
  let albuminuriaEmFalta = true;
  if (p.albuminuria != null) {
    A = k.albuminuria.find(([lim]) => p.albuminuria >= lim)[1];
    albuminuriaEmFalta = false;
  }
  const risco = k.risco[G][A];
  const gravidade = G === 'G5' ? k.gravidade_G5 : k.gravidade[risco];
  return { G, A, risco, gravidade, albuminuriaEmFalta };
}

/**
 * Gravidade por modificadores, por nó.
 * @returns Map<noId, {gravidade, fontes: [{tabela, parametro, valor, valor_efetivo, gravidade}]}>
 */
export function gravidadesPorModificador(caso, sev, subtipos = {}) {
  const out = new Map();
  const p = caso.parametros ?? {};
  const alvos = calcularAlvos(caso, sev);
  const registar = (no, fonte) => {
    const cur = out.get(no) ?? { gravidade: 0, fontes: [] };
    cur.fontes.push(fonte);
    cur.gravidade = Math.max(cur.gravidade, fonte.gravidade);
    out.set(no, cur);
  };

  for (const t of sev.tabelas) {
    const v = p[t.parametro];
    if (v == null || Number.isNaN(Number(v))) continue;
    let x = Number(v);
    if (t.relativo_ao_alvo) x = x - alvos[t.relativo_ao_alvo.alvo] + t.relativo_ao_alvo.referencia;
    if (t.ajuste_sexo && caso.utente?.sexo && t.ajuste_sexo[caso.utente.sexo]) x += t.ajuste_sexo[caso.utente.sexo];
    let g;
    if (t.discreto) {
      g = t.discreto[String(Math.round(x))];
      if (g == null) continue; // fora da tabela (ex.: CFS 1–3 → sem fragilidade)
    } else {
      if (t.instancia_se?.gte != null && x < t.instancia_se.gte) continue;
      g = interpolar(t.pontos, x);
    }
    registar(t.no, { tabela: t.id, parametro: t.parametro, valor: v, valor_efetivo: x, gravidade: limitar(g) });
  }

  const kd = kdigo(caso, sev, subtipos.drc);
  if (kd) {
    registar(sev.kdigo.no, { tabela: 'kdigo', parametro: 'tfg/albuminuria', valor: `${kd.G}${kd.A}`, risco: kd.risco, gravidade: kd.gravidade, albuminuriaEmFalta: kd.albuminuriaEmFalta, G: kd.G, A: kd.A });
  }

  const cat = p[sev.score2.parametro];
  if (cat && sev.score2.gravidade[cat] != null) {
    registar(sev.score2.no, { tabela: 'score2', parametro: sev.score2.parametro, valor: cat, gravidade: sev.score2.gravidade[cat] });
  }
  return { porNo: out, alvos };
}

/** Parâmetros que instanciam um nó por si só (ex.: CFS ≥ 4 → fragilidade). */
export function nosInstanciadosPorParametro(sev) {
  return new Set(sev.tabelas.filter((t) => t.instancia_se).map((t) => t.no));
}

/** DW → gravidade 0–1 (transformação potência ancorada na mediana do GBD). */
export function dwParaGravidade(dw, dwKB) {
  return limitar(dw ** dwKB.gama);
}

/** Nível GBD de um problema: manual (problema.nivel) > regra por parâmetro > nível por defeito. */
export function nivelGBD(mapa, problema, parametros) {
  if (problema?.nivel && mapa.niveis[problema.nivel]) return { nivel: problema.nivel, origem: 'manual' };
  const v = mapa.parametro ? parametros?.[mapa.parametro] : null;
  if (v != null && v !== '' && mapa.regras) {
    const r = mapa.regras.find(([min]) => Number(v) >= min);
    if (r) return { nivel: r[1], origem: 'parametro', parametro: mapa.parametro, valor: v };
  }
  return { nivel: mapa.nivel_por_defeito, origem: 'defeito' };
}

/**
 * Gravidade ancorada nos disability weights do GBD, para os nós sintomáticos declarados.
 * @returns Map<noId, {gravidade, dw, ui, g_ui, estado, rotulo_gbd, nivel, origem_nivel}>
 */
export function gravidadesGBD(caso, dwKB) {
  const out = new Map();
  if (!dwKB) return out;
  for (const p of caso.problemas ?? []) {
    const mapa = dwKB.porNo.get(p.id);
    if (!mapa) continue;
    const nv = nivelGBD(mapa, p, caso.parametros);
    const idEstado = mapa.niveis[nv.nivel];
    const e = dwKB.estados[idEstado];
    out.set(p.id, {
      tabela: 'gbd2013', gravidade: dwParaGravidade(e.dw, dwKB), dw: e.dw, ui: e.ui,
      g_ui: e.ui.map((x) => dwParaGravidade(x, dwKB)), estado: idEstado, rotulo_gbd: e.rotulo_gbd,
      nivel: nv.nivel, origem_nivel: nv.origem, parametro: nv.parametro ?? null, valor: nv.valor ?? null,
    });
  }
  return out;
}
