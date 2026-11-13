// Verificação da interface no browser (Playwright): offline, sem pedidos de rede, sem erros de consola.
// Uso: node scripts/verificar-ui.cjs [pasta-capturas]
// Requer: npm run build (gera dist/mapa-causal.html).
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ficheiro = path.resolve(__dirname, '..', 'dist', 'mapa-causal.html');
const saida = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs', 'capturas'));
fs.mkdirSync(saida, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1, offline: true });
  const page = await ctx.newPage();
  const pedidosExternos = [];
  const erros = [];
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) pedidosExternos.push(r.url()); });
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });

  await page.goto(`file://${ficheiro}`);
  await page.waitForFunction(() => window.__mapaCausal?.estado.analise);
  await page.waitForFunction(() => window.__mapaCausal.estado.sens, null, { timeout: 15000 });
  await page.waitForTimeout(2500);

  const verificar = [];
  const ok = (cond, msg) => verificar.push(`${cond ? '✔' : '✘'} ${msg}`);

  ok(await page.locator('.aviso').innerText().then((t) => t.includes('não substitui o juízo clínico')), 'aviso permanente visível');
  ok(await page.locator('.item-rank').count() > 0, 'ranking renderizado');
  ok(await page.locator('.item-rank .estab').first().innerText().then((t) => /top 3 em/.test(t)), 'posição acompanhada de estabilidade');
  ok(await page.locator('#vista-rede canvas').count() > 0, 'canvas WebGL da rede causal');
  await page.screenshot({ path: path.join(saida, '1-rede-caso-a.png') });

  // Detalhe de intervenção
  await page.locator('.item-rank').first().click();
  await page.waitForTimeout(600);
  ok(await page.locator('#detalhe').innerText().then((t) => t.includes('Porque está nesta posição')), 'decomposição da pontuação');
  ok(await page.locator('#detalhe a[href^="https://pubmed.ncbi.nlm.nih.gov/"]').count() > 0, 'links PubMed no detalhe');
  await page.screenshot({ path: path.join(saida, '2-intervencao-destacada.png') });

  // Espaço de prioridade
  await page.locator('#tab-prioridade').click();
  await page.waitForTimeout(1500);
  ok(await page.locator('#vista-prioridade canvas').count() > 0, 'canvas do espaço de prioridade');
  await page.screenshot({ path: path.join(saida, '3-espaco-prioridade.png') });

  // Lista acessível
  await page.locator('#tab-lista').click();
  await page.waitForTimeout(300);
  ok(await page.locator('#vista-lista').innerText().then((t) => /Obesidade.*Gonartrose.*Mobilidade reduzida/s.test(t)), 'lista: caminho obesidade → gonartrose → mobilidade');
  await page.locator('#vista-lista [data-ligacao]').first().click();
  await page.waitForTimeout(300);
  ok(await page.locator('#detalhe form[data-override]').count() === 1, 'formulário de override na ligação');
  await page.screenshot({ path: path.join(saida, '4-lista-acessivel.png'), fullPage: false });

  // Caso B: alertas
  await page.locator('#sel-caso').selectOption('caso-b');
  await page.waitForTimeout(400);
  ok(await page.locator('#alertas').innerText().then((t) => t.includes('Triple whammy')), 'caso B: alerta triple whammy');
  await page.locator('#tab-rede').click();
  await page.waitForFunction(() => window.__mapaCausal.estado.sens, null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(saida, '5-rede-caso-b.png') });

  // Override com justificação obrigatória
  await page.locator('#tab-lista').click();
  await page.locator('#vista-lista [data-ligacao]').first().click();
  await page.locator('#detalhe input[value="desligar"]').check();
  await page.locator('#detalhe form[data-override] button[type="submit"]').click();
  ok(await page.locator('#detalhe [data-erro]').innerText().then((t) => /obrigatória/.test(t)), 'override recusado sem justificação');

  ok(pedidosExternos.length === 0, `sem pedidos de rede (${pedidosExternos.length})`);
  ok(erros.length === 0, `sem erros de consola (${erros.length})`);
  console.log(verificar.join('\n'));
  if (pedidosExternos.length) console.log('Pedidos:', pedidosExternos);
  if (erros.length) console.log('Erros:', erros);
  await browser.close();
  process.exit(verificar.some((l) => l.startsWith('✘')) ? 1 : 0);
})();
