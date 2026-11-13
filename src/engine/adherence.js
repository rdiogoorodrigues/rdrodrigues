// M_adesão — um único mecanismo: a gravidade do nó de risco `ma_adesao`
// (derivada de depressão, baixa literacia, carência económica, polimedicação…, atenuada por recursos).
// Evita penalizar duas vezes o mesmo fator.
export function fatorAdesao(grafo, categoria, cfg) {
  const g = grafo.nos.get('ma_adesao')?.gravidade ?? 0;
  const k = cfg.adesao.k[categoria] ?? 0.4;
  return { fator: Math.max(cfg.adesao.minimo, 1 - k * g), g_ma_adesao: g, k };
}
