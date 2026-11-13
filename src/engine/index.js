// API pública do motor. Puro: recebe caso, KB e config; devolve a análise completa.
import { prepararKB } from './kb.js';
import { construirGrafo } from './graph.js';
import { centralidades } from './centrality.js';
import { avaliarAlertas } from './alerts.js';
import { priorizar } from './scoring.js';
import { caminhosParaObjetivos } from './paths.js';
import { validarCaso } from './case.js';

export { prepararKB, validarKB, urlPubMed } from './kb.js';
export { validarCaso, exportarCaso, importarCaso, casoVazio, SCHEMA_VERSION } from './case.js';

/** Alertas com 'eleva' impõem uma gravidade mínima a nós de risco já presentes (sinergia de combinação). */
function aplicarElevacoes(grafo, kb, alertas) {
  for (const a of alertas) {
    const regra = kb.alertas.find((r) => r.id === a.id);
    for (const e of regra?.eleva ?? []) {
      const n = grafo.nos.get(e.no);
      if (n && n.gravidade < e.gravidade_min) {
        n.gravidade_antes_alerta = n.gravidade;
        n.gravidade = e.gravidade_min;
        n.origem_gravidade = `alerta:${a.id}`;
      }
    }
  }
}

/**
 * @param caso   objeto do caso (ver src/cases/*.json)
 * @param kb     KB preparada (prepararKB)
 * @param config coeficientes (kb/config.json)
 */
export function analisar(caso, kb, config) {
  const validacao = validarCaso(caso, kb);
  const grafo = construirGrafo(caso, kb, config);
  const alertas = avaliarAlertas(grafo, kb, { apenasGlobais: true });
  aplicarElevacoes(grafo, kb, alertas);
  const C = centralidades(grafo, config);
  for (const [id, c] of C) grafo.nos.get(id).C = c.C;
  const prio = priorizar(grafo, caso, kb, config, { C, alertasGlobais: alertas });
  const caminhos = caminhosParaObjetivos(grafo, config);
  return {
    grafo,
    centralidade: C,
    alertas,
    ...prio,
    caminhos_objetivo: caminhos,
    validacao,
    avisos: [...grafo.avisos],
    coeficientes_a_validar: !!config.a_validar,
  };
}
