// Relatório de sensibilidade dos casos de exemplo (ou de um caso JSON passado como argumento).
// Uso: node scripts/sensibilidade.js [caminho/para/caso.json]
// Saída: docs/validacao/sensibilidade.md
import fs from 'node:fs';
import path from 'node:path';
import { kbBruta, configPorDefeito as cfg } from '../src/kb/index.js';
import { casosExemplo } from '../src/cases/index.js';
import { prepararKB } from '../src/engine/kb.js';
import { analisarSensibilidade, kendallTau } from '../src/engine/sensitivity.js';
import { analisar } from '../src/engine/index.js';

const kb = prepararKB(kbBruta);
const arg = process.argv[2];
const casos = arg ? { [path.basename(arg, '.json')]: JSON.parse(fs.readFileSync(arg, 'utf8')) } : casosExemplo;
const pct = (v) => `${Math.round(v * 100)} %`;
const num = (v) => v.toLocaleString('pt-PT', { maximumFractionDigits: 2 });

let md = `# Análise de sensibilidade do ranking\n\n`;
md += `Gerado por \`npm run sensibilidade\`. ${cfg.sensibilidade.n} simulações por caso, semente ${cfg.sensibilidade.semente} (reprodutível).\n\n`;
md += `**Incerteza simulada:** coeficientes do motor × U(1 − a, 1 + a), preservando a ordem (forte > moderada > fraca, + < ++ < +++, menor < moderado < major); `;
md += `gravidades que usaram o valor por defeito ~ U(${cfg.sensibilidade.gravidade_defeito_intervalo.join('; ')}).\n\n`;
md += `| Grupo | a |\n|---|---|\n${Object.entries(cfg.sensibilidade.amplitudes).map(([k, v]) => `| ${k} | ±${pct(v)} |`).join('\n')}\n\n`;
md += `Modo de gravidade sintomática: **${cfg.gravidade.fonte_sintomatica}**.\n\n`;
md += `**Leitura:** "estável" = posição P5–P95 varia ≤ 1 lugar; "moderada" ≤ 3; "instável" > 3. O τ de Kendall compara cada simulação com o ranking base (1 = ordem idêntica).\n\n`;

for (const [id, caso] of Object.entries(casos)) {
  const s = analisarSensibilidade(caso, kb, cfg);
  md += `## ${caso.descricao ?? id}\n\n`;
  md += `τ de Kendall: média ${num(s.kendall_tau.media)}, P5 ${num(s.kendall_tau.p5)}. Mesmo 1.º lugar em ${pct(s.p_mesmo_top1)} das simulações.\n\n`;
  md += `Gravidades por defeito (dados não medidos): ${s.nos_gravidade_por_defeito.map((n) => kb.nos.get(n).rotulo).join(', ') || '—'}.\n\n`;
  md += `| Base | Intervenção | Mediana | P5–P95 | Top 1 | Top 3 | Top 5 | Estabilidade |\n|---|---|---|---|---|---|---|---|\n`;
  for (const i of s.intervencoes) md += `| ${i.posicao_base} | ${i.rotulo} | ${num(i.posicao_mediana)} | ${i.posicao_p5}–${i.posicao_p95} | ${pct(i.p_top1)} | ${pct(i.p_top3)} | ${pct(i.p_top5)} | ${i.estabilidade} |\n`;
  md += `\n**Tornado (um fator de cada vez; influência = 1 − τ mínimo):**\n\n| Fator | Tipo | Influência | Muda o 1.º lugar? |\n|---|---|---|---|\n`;
  for (const l of s.tornado.filter((x) => x.influencia > 0).slice(0, 10)) {
    md += `| ${l.rotulo ?? l.fator} | ${{ coeficiente: 'coeficiente', gravidade_por_defeito: 'gravidade não medida', incerteza_gbd: 'IC 95 % do DW (GBD)' }[l.tipo]} | ${num(l.influencia)} | ${l.muda_top1 ? `sim (${[l.baixo.top1, l.alto.top1].join(' / ')})` : 'não'} |\n`;
  }
  md += '\n';
}
// Comparação: gravidade dos nós sintomáticos por tabelas vs ancorada no GBD 2013
const cfgGBD = structuredClone(cfg);
cfgGBD.gravidade.fonte_sintomatica = 'gbd2013';
const cfgTab = structuredClone(cfg);
cfgTab.gravidade.fonte_sintomatica = 'tabelas';
md += `## Comparação: tabelas vs disability weights do GBD 2013\n\n`;
md += `Modo GBD: os nós sintomáticos mapeados em \`disability_weights.json\` usam g = DW^γ (γ = ${num(kb.dw.gama)}, mediana GBD 0,128 → 0,5); na sensibilidade, o DW é amostrado no IC 95 % publicado. Nós prognósticos inalterados.\n\n`;
for (const [id, caso] of Object.entries(casos)) {
  const a = analisar(caso, kb, cfgTab), b = analisar(caso, kb, cfgGBD);
  const s = analisarSensibilidade(caso, kb, cfgGBD, { tornado: false });
  md += `### ${caso.descricao ?? id}\n\nτ de Kendall entre modos: **${num(kendallTau(a.ranking.map((x) => x.id), b.ranking.map((x) => x.id)))}**.\n\n`;
  const nosGBD = [...b.grafo.nos.values()].filter((n) => n.gbd);
  if (nosGBD.length) {
    md += `| Nó | Gravidade (tabelas) | Estado GBD | DW (IC 95 %) | Gravidade (GBD) | Nível |\n|---|---|---|---|---|---|\n`;
    for (const n of nosGBD) md += `| ${n.rotulo} | ${num(a.grafo.nos.get(n.id).gravidade)} | ${n.gbd.rotulo_gbd} | ${num(n.gbd.dw)} (${n.gbd.ui.map(num).join('–')}) | ${num(n.gravidade)} | ${n.gbd.nivel}${n.gbd.origem_nivel === 'defeito' ? ' (por defeito)' : ''} |\n`;
  }
  md += `\n| # | Tabelas | GBD | GBD: P5–P95 | GBD: top 3 |\n|---|---|---|---|---|\n`;
  a.ranking.forEach((x, i) => { const y = s.intervencoes[i]; md += `| ${i + 1} | ${x.rotulo} | ${y.rotulo} | ${y.posicao_p5}–${y.posicao_p95} | ${pct(y.p_top3)} |\n`; });
  md += '\n';
}

const destino = path.resolve('docs/validacao/sensibilidade.md');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, md);
console.log(`→ ${path.relative(process.cwd(), destino)}`);
