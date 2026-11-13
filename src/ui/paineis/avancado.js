// Painel avançado: coeficientes do motor (config.json), todos a validar. Alterações só nesta sessão.
import { estado, definirConfig, reporConfig } from '../estado.js';
import { esc } from '../formato.js';

export function renderAvancado(contentor) {
  contentor.innerHTML = `
    <p class="discreto">Todos os coeficientes são escolhas de desenho <strong>não validadas</strong>. As alterações aplicam-se só a esta sessão e não são guardadas no caso.</p>
    <label>Gravidade dos nós sintomáticos
      <select id="sel-fonte">
        <option value="gbd2013">Disability weights do GBD 2013 (Salomon 2015)</option>
        <option value="tabelas">Tabelas internas</option>
      </select>
    </label>
    <label style="display:block;margin-top:.5rem">config.json
      <textarea id="txt-config" spellcheck="false">${esc(JSON.stringify(estado.config, null, 2))}</textarea>
    </label>
    <div class="grupo-botoes"><button type="button" id="btn-aplicar-config">Aplicar</button><button type="button" id="btn-repor-config">Repor valores por defeito</button></div>
    <p class="discreto" id="erro-config" role="alert"></p>`;
  const sel = contentor.querySelector('#sel-fonte');
  sel.value = estado.config.gravidade.fonte_sintomatica;
  sel.addEventListener('change', () => {
    const c = structuredClone(estado.config);
    c.gravidade.fonte_sintomatica = sel.value;
    definirConfig(c);
    renderAvancado(contentor);
  });
  contentor.querySelector('#btn-aplicar-config').addEventListener('click', () => {
    try {
      const c = JSON.parse(contentor.querySelector('#txt-config').value);
      definirConfig(c);
      contentor.querySelector('#erro-config').textContent = 'Aplicado.';
    } catch (e) { contentor.querySelector('#erro-config').textContent = `JSON inválido: ${e.message}`; }
  });
  contentor.querySelector('#btn-repor-config').addEventListener('click', () => { reporConfig(); renderAvancado(contentor); });
}
