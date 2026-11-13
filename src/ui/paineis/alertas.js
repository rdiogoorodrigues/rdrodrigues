// Faixa de alertas globais (combinações perigosas) e avisos de dados.
import { estado, selecionar } from '../estado.js';
import { esc } from '../formato.js';

export function renderAlertas(contentor) {
  const a = estado.analise;
  if (!a) { contentor.innerHTML = ''; return; }
  const alertas = a.alertas.map((al) => {
    const res = al.resolvido_por.map((id) => a.ranking.find((r) => r.id === id)).filter(Boolean);
    return `<div class="alerta ${al.gravidade}" role="${al.gravidade === 'alta' ? 'alert' : 'status'}"><strong>${esc(al.titulo)}:</strong> ${esc(al.mensagem)}${res.length ? ` — ${res.map((r) => `<button type="button" class="link-botao" data-intervencao="${esc(r.id)}">${esc(r.rotulo)}</button>`).join(', ')}` : ''}${al.a_validar ? ' <span class="etq validar">a validar</span>' : ''}</div>`;
  });
  const avisos = a.avisos.map((av) => `<div class="alerta moderada">${esc(av.mensagem)}</div>`);
  contentor.innerHTML = [...alertas, ...avisos].join('');
  contentor.querySelectorAll('[data-intervencao]').forEach((b) => b.addEventListener('click', () => selecionar({ tipo: 'intervencao', id: b.dataset.intervencao })));
}
