// Ranking de intervenções. Cada posição é SEMPRE acompanhada da sua estabilidade (princípio 7).
import { kb, estado, selecionar } from '../estado.js';
import { esc, num, pct, PREFERENCIA, etqValidar } from '../formato.js';

export function renderRanking(contentor) {
  const a = estado.analise;
  if (!a) { contentor.innerHTML = ''; return; }
  const pmax = Math.max(...a.ranking.map((r) => r.pontuacao), 0.01);
  const sel = estado.selecao?.tipo === 'intervencao' ? estado.selecao.id : null;

  const itens = a.ranking.map((r) => {
    const s = estado.sens?.intervencoes.find((x) => x.id === r.id);
    const estab = s
      ? `Posição provável ${s.posicao_p5 === s.posicao_p95 ? `${s.posicao_p5}.ª` : `${s.posicao_p5}.ª–${s.posicao_p95}.ª`} · top 3 em ${pct(s.p_top3)}`
      : estado.sensPendente ? 'A calcular estabilidade…' : 'Estabilidade indisponível';
    const etqEstab = s ? `<span class="etq ${s.estabilidade === 'estável' ? 'estavel' : s.estabilidade === 'instável' ? 'instavel' : ''}" title="Estabilidade da posição face à incerteza dos coeficientes e dos dados não medidos">${s.estabilidade === 'moderada' ? 'estabilidade moderada' : `posição ${esc(s.estabilidade)}`}</span>` : '';
    const alertasAlta = r.decomposicao.alertas_resolvidos.length ? `<span class="etq alta">resolve alerta</span>` : '';
    const alertasProprios = r.alertas.map((al) => `<span class="etq ${al.gravidade}">⚠ ${esc(al.titulo)}</span>`).join('');
    const pref = estado.caso.preferencias?.[r.id];
    return `<li>
      <button type="button" class="item-rank" data-id="${esc(r.id)}" aria-pressed="${sel === r.id}">
        <span class="linha1"><span class="pos">${r.posicao}.</span><span class="nome">${esc(r.rotulo)}</span></span>
        <span class="barra-pont" aria-hidden="true"><span style="width:${Math.max(2, (Math.max(0, r.pontuacao) / pmax) * 100)}%"></span></span>
        <span class="estab">${estab}</span>
        <span class="etiquetas">
          <span class="etq">${esc(kb.categorias[r.categoria])}</span>${etqEstab}${alertasAlta}${alertasProprios}
          ${r.ponte ? '<span class="etq moderada">exige ponte</span>' : ''}
          ${pref && pref !== 'neutro' ? `<span class="etq">utente: ${esc(PREFERENCIA[pref].toLowerCase())}</span>` : ''}
          ${r.a_validar ? etqValidar : ''}
        </span>
      </button></li>`;
  }).join('');

  const emCurso = a.em_curso.length ? `<h3>Em curso</h3><ul class="ligacao-lista">${a.em_curso.map((e) => `<li>${esc(e.rotulo)} <span class="discreto">— ${esc(e.motivo)}</span></li>`).join('')}</ul>` : '';
  const excl = a.excluidas.length ? `<details><summary class="discreto">Não elegíveis (${a.excluidas.length})</summary><ul class="ligacao-lista">${a.excluidas.map((e) => `<li>${esc(e.rotulo)} <span class="discreto">— ${esc(e.motivo)}</span>${e.contraindicacao ? ' <span class="etq alta">contraindicação</span>' : ''}</li>`).join('')}</ul></details>` : '';
  const nota = estado.sens
    ? `<p class="discreto">Estabilidade: ${estado.sens.n} simulações com coeficientes e gravidades não medidas perturbados (τ médio ${num(estado.sens.kendall_tau.media)}).</p>`
    : '';

  contentor.innerHTML = `<ol class="ranking-lista">${itens}</ol>${nota}${emCurso}${excl}`;
  contentor.querySelectorAll('.item-rank').forEach((b) => b.addEventListener('click', () => {
    selecionar(estado.selecao?.tipo === 'intervencao' && estado.selecao.id === b.dataset.id ? null : { tipo: 'intervencao', id: b.dataset.id });
  }));
}
