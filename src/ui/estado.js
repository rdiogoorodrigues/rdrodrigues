// Estado da aplicação: caso, configuração, análise e análise de sensibilidade. Observável simples.
import { kbBruta, configPorDefeito } from '../kb/index.js';
import { casosExemplo } from '../cases/index.js';
import { prepararKB, analisar } from '../engine/index.js';
import { analisarSensibilidade } from '../engine/sensitivity.js';

export const kb = prepararKB(kbBruta);
export const casos = casosExemplo;
const CHAVE_RASCUNHO = 'mapa-causal:rascunho';

export const estado = {
  casoId: 'caso-a',
  caso: structuredClone(casosExemplo['caso-a']),
  config: structuredClone(configPorDefeito),
  analise: null,
  sens: null,
  sensPendente: false,
  vista: 'rede',
  selecao: null, // { tipo: 'no' | 'ligacao' | 'intervencao', id }
  destaqueCaminho: true,
  webgl: true,
};

const ouvintes = new Set();
export function subscrever(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
function emitir(motivo) { for (const fn of ouvintes) { try { fn(motivo); } catch (e) { console.error(e); } } }

let temporizadorSens = null;
function agendarSensibilidade() {
  clearTimeout(temporizadorSens);
  estado.sens = null;
  estado.sensPendente = true;
  temporizadorSens = setTimeout(() => {
    try {
      estado.sens = analisarSensibilidade(estado.caso, kb, estado.config, { n: estado.config.sensibilidade.n_ui ?? 300, tornado: false });
    } catch (e) { console.error('Sensibilidade:', e); estado.sens = null; }
    estado.sensPendente = false;
    emitir('sens');
  }, 80);
}

export function recalcular() {
  estado.analise = analisar(estado.caso, kb, estado.config);
  if (estado.selecao && !existeSelecao(estado.selecao)) estado.selecao = null;
  emitir('analise');
  agendarSensibilidade();
}

function existeSelecao(s) {
  const a = estado.analise;
  if (s.tipo === 'no') return a.grafo.nos.has(s.id);
  if (s.tipo === 'ligacao') return a.grafo.ligacoes.some((l) => l.id === s.id);
  if (s.tipo === 'intervencao') return a.ranking.some((r) => r.id === s.id);
  return false;
}

export function definirCaso(caso, id) {
  estado.caso = structuredClone(caso);
  estado.casoId = id;
  estado.selecao = null;
  recalcular();
}

/** Altera o caso (overrides, preferências, alarmes…), guarda rascunho e recalcula. */
export function alterarCaso(mutador) {
  mutador(estado.caso);
  guardarRascunho();
  recalcular();
}

export function definirConfig(cfg) { estado.config = cfg; recalcular(); }
export function reporConfig() { definirConfig(structuredClone(configPorDefeito)); }
export const configOriginal = () => structuredClone(configPorDefeito);

export function selecionar(sel) { estado.selecao = sel; emitir('selecao'); }
export function definirVista(v) { estado.vista = v; emitir('vista'); }
export function alternarDestaque(v) { estado.destaqueCaminho = v; emitir('selecao'); }

// Rascunho local (conveniência; a persistência real é exportar/importar JSON)
export function guardarRascunho() {
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ caso: estado.caso, guardado: new Date().toISOString() })); emitir('rascunho'); } catch { /* sem armazenamento */ }
}
export function lerRascunho() {
  try { const v = localStorage.getItem(CHAVE_RASCUNHO); return v ? JSON.parse(v) : null; } catch { return null; }
}
