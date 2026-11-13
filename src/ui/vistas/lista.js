// Vista 3 — alternativa 2D/lista acessível (também usada quando não há WebGL).
import { kb, estado, selecionar } from '../estado.js';
import { esc, num, categoriaGravidade, origemGravidade, CAMADAS, FORCA, etqValidar } from '../formato.js';

export function renderLista(contentor) {
  const a = estado.analise;
  if (!a) { contentor.innerHTML = ''; return; }
  const nos = [...a.grafo.nos.values()];
  const rot = (id) => a.grafo.nos.get(id)?.rotulo ?? id;
  const botaoNo = (id) => `<button type="button" class="link-botao" data-no="${esc(id)}">${esc(rot(id))}</button>`;

  const porCamada = CAMADAS.map((nome, i) => ({ nome, nos: nos.filter((n) => (n.camada ?? 2) === i).sort((x, y) => (y.gravidade ?? 0) - (x.gravidade ?? 0)) })).reverse();

  const tabelaNos = porCamada.filter((c) => c.nos.length).map((c) => `
    <h3>${esc(c.nome)}</h3>
    <table>
      <caption class="discreto" style="text-align:left">${c.nos.length} nó(s)</caption>
      <thead><tr><th scope="col">Nó</th><th scope="col">Tipo</th><th scope="col">ICPC-2</th><th scope="col">Gravidade</th><th scope="col">Origem da gravidade</th><th scope="col" class="num">Centralidade</th></tr></thead>
      <tbody>${c.nos.map((n) => `<tr>
        <th scope="row">${botaoNo(n.id)} ${n.a_validar ? etqValidar : ''}</th>
        <td>${esc(n.objetivo ? 'Objetivo' : kb.tipos[n.tipo]?.rotulo)}</td>
        <td>${esc(n.icpc2 ?? '—')}</td>
        <td>${n.objetivo ? '—' : `<span class="medidor" aria-hidden="true"><span style="width:${Math.round((n.gravidade ?? 0) * 100)}%"></span></span>${categoriaGravidade(n.gravidade)} (${num(n.gravidade)})`}</td>
        <td>${esc(origemGravidade(n.origem_gravidade))}</td>
        <td class="num">${n.objetivo ? '—' : num(n.C ?? 0)}</td>
      </tr>`).join('')}</tbody>
    </table>`).join('');

  const caminhos = a.caminhos_objetivo.map((o) => `
    <h3>«${esc(o.texto)}»</h3>
    <ol>${o.caminhos.filter((c) => c.nos.length >= 2).slice(0, 8).map((c) => `<li>${c.nos.slice(0, -1).map(botaoNo).join(' → ')} → <strong>objetivo</strong> <span class="discreto">(força do caminho ${num(c.forca)})</span></li>`).join('')}</ol>`).join('');

  const ligacoes = a.grafo.ligacoes.filter((l) => !l.objetivo).sort((x, y) => rot(x.origem).localeCompare(rot(y.origem), 'pt'));
  const tabelaLig = `
    <table>
      <thead><tr><th scope="col">Ligação</th><th scope="col">Força</th><th scope="col">Evidência</th><th scope="col">Estado</th></tr></thead>
      <tbody>${ligacoes.map((l) => `<tr>
        <th scope="row"><button type="button" class="link-botao" data-ligacao="${esc(l.id)}">${esc(rot(l.origem))} ${l.atenua ? '⊣' : '→'} ${esc(rot(l.destino))}</button></th>
        <td>${FORCA[l.forca]}${l.forca !== l.forca_original ? ` <span class="discreto">(era ${FORCA[l.forca_original]})</span>` : ''}</td>
        <td>${esc(l.evidencia)}</td>
        <td>${l.desligada ? '<span class="etq alta">desligada</span>' : ''}${l.override ? '<span class="etq">override clínico</span>' : ''}${l.a_validar ? etqValidar : ''}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  contentor.innerHTML = `
    <section aria-labelledby="l-cam"><h2 id="l-cam">Caminhos até aos objetivos do utente</h2>${caminhos || '<p>Sem objetivos definidos.</p>'}</section>
    <section aria-labelledby="l-nos"><h2 id="l-nos">Rede causal por camada (do topo para a base)</h2>${tabelaNos}</section>
    <section aria-labelledby="l-lig"><h2 id="l-lig">Ligações causais (${ligacoes.length})</h2>${tabelaLig}</section>`;

  contentor.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', () => selecionar({ tipo: 'no', id: b.dataset.no })));
  contentor.querySelectorAll('[data-ligacao]').forEach((b) => b.addEventListener('click', () => selecionar({ tipo: 'ligacao', id: b.dataset.ligacao })));
}
