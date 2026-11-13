// Arranque da interface. 100 % local: sem pedidos de rede.
import { estado, casos, subscrever, recalcular, definirCaso, definirVista, lerRascunho } from './estado.js';
import { exportar, importar } from './io.js';
import { renderRanking } from './paineis/ranking.js';
import { renderDetalhe } from './paineis/detalhe.js';
import { renderAlertas } from './paineis/alertas.js';
import { renderAvancado } from './paineis/avancado.js';
import { renderLista } from './vistas/lista.js';
import { temWebGL } from './vistas/objetos3d.js';
import { esc } from './formato.js';

const $ = (s) => document.querySelector(s);
const vistas3d = {};

function iniciarSeletorCaso() {
  const sel = $('#sel-caso');
  const opcoes = Object.entries(casos).map(([id, c]) => `<option value="${id}">${esc(c.descricao ?? id)}</option>`);
  const r = lerRascunho();
  if (r?.caso) opcoes.push(`<option value="rascunho">Rascunho guardado (${esc(new Date(r.guardado).toLocaleString('pt-PT'))})</option>`);
  sel.innerHTML = opcoes.join('');
  sel.value = estado.casoId;
  sel.addEventListener('change', () => {
    if (sel.value === 'rascunho') { const rr = lerRascunho(); if (rr?.caso) definirCaso(rr.caso, 'rascunho'); return; }
    if (casos[sel.value]) definirCaso(casos[sel.value], sel.value);
  });
}

function adicionarOpcaoImportado(caso) {
  const sel = $('#sel-caso');
  sel.querySelector('option[value="importado"]')?.remove();
  sel.insertAdjacentHTML('beforeend', `<option value="importado">Importado: ${esc(caso.descricao || caso.id || 'caso')}</option>`);
  sel.value = 'importado';
}

function iniciarIO() {
  $('#btn-exportar').addEventListener('click', exportar);
  $('#btn-importar').addEventListener('click', () => $('#ficheiro').click());
  $('#ficheiro').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { adicionarOpcaoImportado(await importar(f)); } catch (err) { alert(`Não foi possível importar: ${err.message}`); }
    e.target.value = '';
  });
}

function iniciarSeparadores() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const ativar = (v) => definirVista(v);
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => ativar(t.dataset.vista));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        if (!n.disabled) { n.focus(); ativar(n.dataset.vista); }
      }
    });
  });
  if (!estado.webgl) {
    for (const t of tabs) if (t.dataset.vista !== 'lista') { t.disabled = true; t.title = 'WebGL indisponível neste navegador'; }
  }
}

async function garantirVista3d(v) {
  if (!estado.webgl || vistas3d[v]) return;
  if (v === 'rede') {
    const { criarRede } = await import('./vistas/rede3d.js');
    vistas3d.rede = criarRede($('#vista-rede'));
  } else if (v === 'prioridade') {
    const { criarPrioridade } = await import('./vistas/prioridade3d.js');
    vistas3d.prioridade = criarPrioridade($('#vista-prioridade'));
  }
  vistas3d[v]?.atualizar(estado.analise);
}

function aplicarVista() {
  const v = estado.vista;
  for (const t of document.querySelectorAll('[role="tab"]')) {
    const ativo = t.dataset.vista === v;
    t.setAttribute('aria-selected', String(ativo));
    t.tabIndex = ativo ? 0 : -1;
  }
  for (const id of ['rede', 'prioridade', 'lista']) $(`#vista-${id}`).hidden = id !== v;
  for (const [id, obj] of Object.entries(vistas3d)) (id === v ? obj.retomar : obj.pausar)();
  if (v === 'lista') renderLista($('#vista-lista'));
  else garantirVista3d(v);
}

function main() {
  estado.webgl = temWebGL();
  if (!estado.webgl) {
    estado.vista = 'lista';
    $('#vista-rede').innerHTML = '<p class="sem-webgl">Este navegador não suporta WebGL: use a vista em lista.</p>';
  }
  iniciarSeletorCaso();
  iniciarIO();
  iniciarSeparadores();
  renderAvancado($('#painel-avancado'));

  subscrever((motivo) => {
    if (motivo === 'analise' || motivo === 'sens' || motivo === 'selecao') renderRanking($('#ranking'));
    if (motivo === 'analise' || motivo === 'sens' || motivo === 'selecao') renderDetalhe($('#detalhe'));
    if (motivo === 'analise') renderAlertas($('#alertas'));
    if ((motivo === 'analise' || motivo === 'selecao') && estado.vista === 'lista') renderLista($('#vista-lista'));
    if (motivo === 'vista') aplicarVista();
    if (motivo === 'rascunho') $('#estado-rascunho').textContent = 'Rascunho guardado localmente';
  });

  recalcular();
  aplicarVista();
  window.__mapaCausal = { estado }; // apoio a testes automáticos (sem dados enviados)
}

main();
