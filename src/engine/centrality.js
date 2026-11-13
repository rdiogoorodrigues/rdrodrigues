// C — Centralidade causal.
// Bruto = Σ, por nó a jusante presente, de peso(força) × fator_subtipo × gravidade × desconto^(nível−1),
// até `niveis_max` níveis. Cada nó a jusante conta UMA vez (o melhor caminho), o que evita a dupla
// contagem em ciclos e em ligações bidirecionais. Os nós em `excluir` não são contados nem atravessados
// (centralidade residual: usada quando uma intervenção já atua diretamente sobre esses nós).
// C = 1 − exp(−bruto / escala).
import { adjacencia } from './graph.js';

export function centralidade(grafo, origem, cfg, { excluir = new Set(), adj = null } = {}) {
  const A = adj ?? adjacencia(grafo, { incluirObjetivos: false });
  const { desconto_por_nivel: desc, niveis_max: max, escala } = cfg.centralidade;
  const melhor = new Map(); // destino → {valor, nivel, via}

  const visitar = (no, nivel, caminho) => {
    if (nivel > max) return;
    for (const l of A.get(no) ?? []) {
      const d = l.destino;
      if (d === origem || caminho.includes(d) || excluir.has(d)) continue;
      const nd = grafo.nos.get(d);
      if (!nd || nd.objetivo) continue;
      const valor = cfg.forca_peso[l.forca] * l.fator * nd.gravidade * desc ** (nivel - 1);
      const cur = melhor.get(d);
      if (!cur || valor > cur.valor) melhor.set(d, { valor, nivel, via: [...caminho, d] });
      visitar(d, nivel + 1, [...caminho, d]);
    }
  };
  visitar(origem, 1, [origem]);

  const contribuicoes = [...melhor.entries()]
    .map(([no, v]) => ({ no, ...v }))
    .sort((a, b) => b.valor - a.valor);
  const bruto = contribuicoes.reduce((s, c) => s + c.valor, 0);
  return { C: 1 - Math.exp(-bruto / escala), bruto, contribuicoes };
}

/** Centralidade (sem exclusões) de todos os nós do grafo. */
export function centralidades(grafo, cfg) {
  const adj = adjacencia(grafo, { incluirObjetivos: false });
  const out = new Map();
  for (const n of grafo.nos.values()) {
    if (n.objetivo) continue;
    out.set(n.id, centralidade(grafo, n.id, cfg, { adj }));
  }
  return out;
}
