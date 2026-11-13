import { kbBruta, configPorDefeito } from '../src/kb/index.js';
import { casosExemplo } from '../src/cases/index.js';
import { prepararKB, analisar } from '../src/engine/index.js';

export const kb = prepararKB(kbBruta);
export const cfg = configPorDefeito;
export const clone = (o) => structuredClone(o);
export const caso = (id) => clone(casosExemplo[id]);
export const correr = (c) => analisar(c, kb, cfg);
export const posicao = (r, id) => r.ranking.findIndex((x) => x.id === id) + 1; // 0 = ausente
