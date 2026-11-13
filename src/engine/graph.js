// Instanciação do grafo causal do utente a partir do caso e da KB.
import { normalizar, limitar, ajustarForca, combinar } from './util.js';
import { gravidadesPorModificador, nosInstanciadosPorParametro } from './severity.js';

/** Classe farmacológica de cada linha de medicação (estado ≠ suspenso). */
export function classificarMedicacao(caso, kb) {
  const linhas = [];
  const avisos = [];
  for (const m of caso.medicacao ?? []) {
    const classe = m.classe || kb.farmacos.dci[normalizar(m.dci)] || null;
    if (!classe) avisos.push({ tipo: 'farmaco_desconhecido', mensagem: `Classe de «${m.dci}» desconhecida: indique a classe manualmente.` });
    linhas.push({ ...m, classe: classe ?? 'outro', ativo: m.estado !== 'suspenso' });
  }
  const classes = new Set(linhas.filter((l) => l.ativo).map((l) => l.classe));
  return { linhas, classes, n_ativos: linhas.filter((l) => l.ativo).length, avisos };
}

function gravidadeDefeito(tipo, cfg) {
  if (tipo === 'medicacao') return cfg.gravidade.medicacao_por_defeito;
  if (tipo === 'determinante') return cfg.gravidade.determinante_por_defeito;
  if (tipo === 'objetivo_recurso') return cfg.gravidade.recurso_por_defeito;
  return cfg.gravidade.por_defeito;
}

/**
 * Constrói o grafo do utente.
 * @returns {{nos: Map, ligacoes: Array, classes: Set, medicacao: Array, sinais: Set, alvos: object, objetivos: Array, avisos: Array}}
 */
export function construirGrafo(caso, kb, cfg) {
  const avisos = [];
  const med = classificarMedicacao(caso, kb);
  avisos.push(...med.avisos);

  const subtipos = {};
  for (const p of caso.problemas ?? []) if (p.subtipo) subtipos[p.id] = p.subtipo;
  const { porNo: modif, alvos } = gravidadesPorModificador(caso, kb.severidade, subtipos);

  const nos = new Map();
  const declarar = (id, extra = {}) => {
    const def = kb.nos.get(id);
    if (!def) { avisos.push({ tipo: 'no_desconhecido', mensagem: `Problema «${id}» não existe na base de conhecimento.` }); return null; }
    const ex = nos.get(id);
    if (ex) { Object.assign(ex, extra); return ex; }
    const n = {
      id, tipo: def.tipo, rotulo: def.rotulo, rotulo_utente: def.rotulo_utente, icpc2: def.icpc2, camada: def.camada,
      subrotulo: def.subrotulo ?? null, subtipo: null, recurso: !!def.recurso,
      gravidade: null, origem_gravidade: null, fontes: [], derivado: false, declarado: true,
      alarme: false, a_validar: !!def.a_validar, modificadores: {},
      ...extra,
    };
    nos.set(id, n);
    return n;
  };

  // 1. Problemas, comportamentos, determinantes e recursos declarados
  for (const p of caso.problemas ?? []) {
    const n = declarar(p.id);
    if (!n) continue;
    if (p.subtipo) n.subtipo = p.subtipo;
    if (p.subrotulo) n.subrotulo = p.subrotulo;
    if (p.alarme) n.alarme = true;
    if (p.gravidade != null) { n.gravidade = limitar(Number(p.gravidade)); n.origem_gravidade = 'manual'; }
    if (p.a_validar) n.a_validar = true;
  }

  // 2. Nós de medicação a partir das classes
  for (const def of kb.nos.values()) {
    if (def.tipo === 'medicacao' && def.classes?.some((c) => med.classes.has(c))) {
      const n = declarar(def.id);
      n.farmacos = med.linhas.filter((l) => l.ativo && def.classes.includes(l.classe)).map((l) => l.dci);
    }
  }
  const pm = cfg.polimedicacao_min;
  if (med.n_ativos >= pm) {
    caso = { ...caso, parametros: { ...caso.parametros, n_farmacos: med.n_ativos } };
    const r = gravidadesPorModificador(caso, kb.severidade, subtipos);
    for (const [k, v] of r.porNo) modif.set(k, v);
    declarar('polimedicacao', { subrotulo: `${med.n_ativos} fármacos` });
  }

  // 3. Nós instanciados por parâmetro (ex.: CFS ≥ 4 → fragilidade)
  for (const id of nosInstanciadosPorParametro(kb.severidade)) {
    if (modif.has(id) && !nos.has(id)) declarar(id);
  }

  // 4. Gravidade dos nós declarados: manual > modificador > defeito
  for (const n of nos.values()) {
    const m = modif.get(n.id);
    if (m) n.fontes = m.fontes;
    if (n.origem_gravidade === 'manual') continue;
    if (m) { n.gravidade = m.gravidade; n.origem_gravidade = 'modificador'; }
    else { n.gravidade = gravidadeDefeito(n.tipo, cfg); n.origem_gravidade = 'defeito'; }
    const kd = m?.fontes.find((f) => f.tabela === 'kdigo');
    if (kd) {
      n.subtipo = kd.G;
      n.subrotulo = `${kd.G}${kd.A}${kd.albuminuriaEmFalta ? ' (albuminúria em falta)' : ''}`;
      if (kd.albuminuriaEmFalta) avisos.push({ tipo: 'dados_em_falta', mensagem: 'DRC: albuminúria em falta; assumida A1 (pode subestimar o risco).' });
    }
  }

  // 5. Ligações com overrides clínicos
  const overrides = new Map();
  for (const o of caso.overrides ?? []) {
    if (!o.justificacao || !String(o.justificacao).trim()) {
      avisos.push({ tipo: 'override_invalido', mensagem: `Override ${o.origem}→${o.destino} ignorado: justificação obrigatória.` });
      continue;
    }
    overrides.set(`${o.origem}->${o.destino}`, o);
  }
  const ligacoesKB = [];
  for (const l of kb.ligacoes) {
    const o = overrides.get(l.id);
    let forca = l.forca;
    if (o?.acao === 'desligar') { ligacoesKB.push({ ...l, desligada: true, override: o }); continue; }
    if (o?.acao === 'reforcar') forca = ajustarForca(forca, 1);
    if (o?.acao === 'enfraquecer') forca = ajustarForca(forca, -1);
    ligacoesKB.push({ ...l, forca, forca_original: l.forca, override: o ?? null, desligada: false });
  }
  const fatorSubtipo = (l) => {
    if (!l.subtipo_destino) return 1;
    const d = nos.get(l.destino);
    if (!d || !d.subtipo) return cfg.subtipo_nao_especificado_fator;
    return d.subtipo === l.subtipo_destino ? 1 : 0;
  };

  // 6. Nós derivados (risco e funcionalidade derivável), com iteração limitada para ciclos
  const t = cfg.transmissao;
  const derivaveis = [...kb.nos.values()].filter((d) => d.derivavel);
  const declaradoG = new Map([...nos.values()].map((n) => [n.id, n.gravidade]));
  for (let it = 0; it < cfg.gravidade.iteracoes_max; it++) {
    let mudou = false;
    for (const def of derivaveis) {
      const entradas = ligacoesKB.filter((l) => !l.desligada && l.destino === def.id && nos.has(l.origem) && !nos.get(l.origem).objetivo);
      const causais = entradas.filter((l) => !l.atenua && !nos.get(l.origem).recurso);
      if (!causais.length) continue;
      let g = combinar(causais.map((l) => t[l.forca] * fatorSubtipo(l) * nos.get(l.origem).gravidade));
      if (cfg.gravidade.atenuacao_recurso) {
        for (const l of entradas.filter((x) => x.atenua)) g *= 1 - t[l.forca] * nos.get(l.origem).gravidade;
      }
      const dec = declaradoG.get(def.id);
      const final = Math.max(g, dec ?? 0);
      if (final < cfg.gravidade.limiar_instanciacao_derivada) continue;
      const n = nos.get(def.id) ?? declarar(def.id, { declarado: false });
      if (Math.abs((n.gravidade ?? -1) - final) > 1e-9) {
        n.gravidade = final;
        n.gravidade_derivada = g;
        if (dec == null || g > dec) { n.derivado = true; n.origem_gravidade = 'derivada'; }
        mudou = true;
      }
    }
    if (!mudou) break;
  }

  // 7. Risco CV: categoria SCORE2 sobrepõe-se; DCV estabelecida → muito alto (mínimo)
  const cv = nos.get('eventos_cv');
  const score2 = modif.get('eventos_cv');
  if (score2) {
    const n = cv ?? declarar('eventos_cv', { declarado: false });
    n.gravidade = score2.gravidade; n.origem_gravidade = 'modificador'; n.fontes = score2.fontes; n.derivado = false;
  }
  const dcv = ['doenca_coronaria', 'avc', 'ait', 'dap'].some((id) => nos.has(id));
  if (dcv) {
    const n = nos.get('eventos_cv') ?? declarar('eventos_cv', { declarado: false });
    const piso = kb.severidade.score2.gravidade.muito_alto;
    if ((n.gravidade ?? 0) < piso) { n.gravidade = piso; n.origem_gravidade = 'dcv_estabelecida'; }
  }

  // 8. Objetivos do utente (nós de topo)
  const objetivos = [];
  const ligObj = [];
  (caso.objetivos ?? []).forEach((o, i) => {
    const id = o.id ? `objetivo:${o.id}` : `objetivo:${i + 1}`;
    nos.set(id, {
      id, tipo: 'objetivo_recurso', objetivo: true, rotulo: o.texto, rotulo_utente: o.texto, icpc2: null, camada: 5,
      gravidade: 1, origem_gravidade: 'objetivo', fontes: [], derivado: false, declarado: true, a_validar: false, subrotulo: 'Objetivo do utente',
    });
    const ligados = [];
    for (const alvo of o.nos ?? []) {
      if (!nos.has(alvo)) { avisos.push({ tipo: 'objetivo_sem_no', mensagem: `Objetivo «${o.texto}»: «${alvo}» não está presente no grafo.` }); continue; }
      ligados.push(alvo);
      ligObj.push({
        id: `${alvo}->${id}`, origem: alvo, destino: id, forca: cfg.objetivo.forca_ligacao_objetivo, forca_original: cfg.objetivo.forca_ligacao_objetivo,
        evidencia: 'objetivo do utente', refs: [], a_validar: false, bi: false, atenua: false, objetivo: true, desligada: false, override: null,
      });
    }
    objetivos.push({ id, texto: o.texto, nos: ligados });
  });

  // 9. Ligações do utente: ambos os extremos presentes
  const ligacoes = ligacoesKB
    .filter((l) => nos.has(l.origem) && nos.has(l.destino))
    .map((l) => ({ ...l, fator: fatorSubtipo(l) }))
    .filter((l) => l.fator > 0)
    .concat(ligObj.map((l) => ({ ...l, fator: 1 })));

  // 10. Sinais calculados
  const sinais = new Set();
  const hba1c = caso.parametros?.hba1c;
  if (nos.has('dm2') && alvos.fragil && hba1c != null && hba1c < alvos.hba1c - 1 && (med.classes.has('insulina') || med.classes.has('sulfonilureia'))) {
    sinais.add('sobretratamento_glicemico');
  }

  return { nos, ligacoes, classes: med.classes, medicacao: med.linhas, sinais, alvos, objetivos, avisos, utente: caso.utente ?? {}, parametros: caso.parametros ?? {} };
}

/** Lista de adjacência (arcos ativos, sem ligações desligadas). */
export function adjacencia(grafo, { incluirAtenuantes = false, incluirObjetivos = true } = {}) {
  const adj = new Map();
  for (const l of grafo.ligacoes) {
    if (l.desligada) continue;
    if (l.atenua && !incluirAtenuantes) continue;
    if (l.objetivo && !incluirObjetivos) continue;
    if (!adj.has(l.origem)) adj.set(l.origem, []);
    adj.get(l.origem).push(l);
  }
  return adj;
}
