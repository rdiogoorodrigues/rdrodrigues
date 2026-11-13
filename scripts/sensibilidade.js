// Relatório de sensibilidade dos casos de exemplo (ou de um caso JSON passado como argumento).
// Uso: node scripts/sensibilidade.js [caminho/para/caso.json]
// Saída: docs/validacao/sensibilidade.md
import fs from 'node:fs';
import path from 'node:path';
import { kbBruta, configPorDefeito as cfg } from '../src/kb/index.js';
import { casosExemplo } from '../src/cases/index.js';
import { prepararKB } from '../src/engine/kb.js';
import { analisarSensibilidade } from '../src/engine/sensitivity.js';

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
    md += `| ${l.rotulo ?? l.fator} | ${l.tipo === 'coeficiente' ? 'coeficiente' : 'gravidade não medida'} | ${num(l.influencia)} | ${l.muda_top1 ? `sim (${[l.baixo.top1, l.alto.top1].join(' / ')})` : 'não'} |\n`;
  }
  md += '\n';
}
const destino = path.resolve('docs/validacao/sensibilidade.md');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, md);
console.log(`→ ${path.relative(process.cwd(), destino)}`);
