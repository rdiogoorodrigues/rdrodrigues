// Caminhos causais até aos objetivos do utente (para o bónus G e para o destaque visual).
import { adjacencia } from './graph.js';

/** Força de um caminho = Π transmissão(força) × fator_subtipo. */
export function forcaCaminho(ligacoes, cfg) {
  return ligacoes.reduce((p, l) => p * cfg.transmissao[l.forca] * l.fator, 1);
}

/** Todos os caminhos simples de `origem` a `destino` com ≤ maxSaltos arcos. */
export function caminhos(grafo, origem, destino, maxSaltos, cfg, adj = null) {
  const A = adj ?? adjacencia(grafo);
  const out = [];
  const dfs = (no, nosCaminho, ligs) => {
    if (ligs.length > maxSaltos) return;
    if (no === destino && ligs.length) {
      out.push({ nos: nosCaminho, ligacoes: ligs.map((l) => l.id), forca: forcaCaminho(ligs, cfg) });
      return;
    }
    for (const l of A.get(no) ?? []) {
      if (nosCaminho.includes(l.destino)) continue;
      dfs(l.destino, [...nosCaminho, l.destino], [...ligs, l]);
    }
  };
  dfs(origem, [origem], []);
  return out.sort((a, b) => b.forca - a.forca);
}

/** Melhor força de caminho de `origem` até `destino` (0 se não houver caminho). */
export function melhorForca(grafo, origem, destino, maxSaltos, cfg, adj = null) {
  if (origem === destino) return 1;
  const c = caminhos(grafo, origem, destino, maxSaltos, cfg, adj);
  return c.length ? c[0].forca : 0;
}

/**
 * Para cada objetivo, todos os caminhos (≤ maxSaltos) que lá chegam, a partir de qualquer nó.
 * Ordenados por força; limitado a `limite` por objetivo.
 */
export function caminhosParaObjetivos(grafo, cfg, { maxSaltos = 4, limite = 60 } = {}) {
  const adj = adjacencia(grafo);
  // adjacência inversa
  const inv = new Map();
  for (const ls of adj.values()) for (const l of ls) {
    if (!inv.has(l.destino)) inv.set(l.destino, []);
    inv.get(l.destino).push(l);
  }
  return grafo.objetivos.map((obj) => {
    const out = [];
    const dfs = (no, nosRev, ligsRev) => {
      if (ligsRev.length) {
        const ligs = [...ligsRev].reverse();
        out.push({ nos: [...nosRev].reverse(), ligacoes: ligs.map((l) => l.id), forca: forcaCaminho(ligs, cfg) });
      }
      if (ligsRev.length >= maxSaltos) return;
      for (const l of inv.get(no) ?? []) {
        if (nosRev.includes(l.origem)) continue;
        dfs(l.origem, [...nosRev, l.origem], [...ligsRev, l]);
      }
    };
    dfs(obj.id, [obj.id], []);
    out.sort((a, b) => b.forca - a.forca || b.nos.length - a.nos.length);
    return { objetivo: obj.id, texto: obj.texto, caminhos: out.slice(0, limite) };
  });
}
