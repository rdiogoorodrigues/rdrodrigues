// Painel de detalhe: nó, ligação ou intervenção. Transparência total: evidência, PMID, decomposição.
import { kb, estado, selecionar, alterarCaso } from '../estado.js';
import { esc, num, dw, pct, MAGNITUDE, HORIZONTE, FORCA, PREFERENCIA, categoriaGravidade, origemGravidade, refsHTML, etqValidar } from '../formato.js';

export function renderDetalhe(contentor) {
  const a = estado.analise;
  if (!a) { contentor.innerHTML = ''; return; }
  const s = estado.selecao;
  if (s?.tipo === 'no') contentor.innerHTML = detalheNo(a, s.id);
  else if (s?.tipo === 'ligacao') contentor.innerHTML = detalheLigacao(a, s.id);
  else if (s?.tipo === 'intervencao') contentor.innerHTML = detalheIntervencao(a, s.id);
  else contentor.innerHTML = resumoCaso(a);
  ligarEventos(contentor);
}

const rot = (a, id) => a.grafo.nos.get(id)?.rotulo ?? kb.nos.get(id)?.rotulo ?? id;
const btnNo = (a, id) => `<button type="button" class="link-botao" data-no="${esc(id)}">${esc(rot(a, id))}</button>`;
const btnLig = (a, l) => `<button type="button" class="link-botao" data-ligacao="${esc(l.id)}">${esc(rot(a, l.origem))} ${l.atenua ? '⊣' : '→'} ${esc(rot(a, l.destino))}</button>`;

function resumoCaso(a) {
  const c = estado.caso;
  const v = a.validacao;
  return `
    <div class="detalhe-cab"><h3>${esc(c.descricao || 'Caso')}</h3></div>
    <dl class="propriedades">
      <dt>Utente</dt><dd>${esc(c.utente?.sexo === 'F' ? 'Mulher' : c.utente?.sexo === 'M' ? 'Homem' : '—')}, ${esc(c.utente?.idade ?? '—')} anos</dd>
      <dt>Objetivos</dt><dd>${(c.objetivos ?? []).map((o) => `«${esc(o.texto)}»`).join('<br>') || '—'}</dd>
      <dt>Problemas</dt><dd>${(c.problemas ?? []).length}</dd>
      <dt>Medicação</dt><dd>${(c.medicacao ?? []).map((m) => esc(m.dci)).join(', ') || '—'}</dd>
      <dt>Gravidade sintomática</dt><dd>${estado.config.gravidade.fonte_sintomatica === 'gbd2013' ? 'GBD 2013 (disability weights)' : 'tabelas'}</dd>
    </dl>
    ${v.erros.length ? `<div class="caixa"><strong>Conjunto mínimo incompleto</strong><ul>${v.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    ${v.avisos.length ? `<div class="caixa"><ul>${v.avisos.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    <p class="discreto">Selecione um nó ou uma ligação na rede, ou uma intervenção na lista, para ver a evidência e a decomposição da pontuação.</p>`;
}

function detalheNo(a, id) {
  const n = a.grafo.nos.get(id);
  if (!n) return '';
  const tipo = n.objetivo ? 'Objetivo do utente' : kb.tipos[n.tipo]?.rotulo;
  const entradas = a.grafo.ligacoes.filter((l) => l.destino === id);
  const saidas = a.grafo.ligacoes.filter((l) => l.origem === id);
  const C = a.centralidade.get(id);
  const problema = (estado.caso.problemas ?? []).find((p) => p.id === id);
  const intervs = a.ranking.filter((r) => r.decomposicao.beneficios.some((b) => b.no === id));

  const fontes = (n.fontes ?? []).map((f) => {
    if (f.tabela === 'gbd2013') {
      const e = kb.dw.estados[f.estado];
      return `<div class="caixa"><strong>GBD 2013:</strong> ${esc(f.rotulo_gbd)}<br>DW ${dw(f.dw)} (IC 95 % ${dw(f.ui[0])}–${dw(f.ui[1])}) → gravidade ${num(f.gravidade)}<br>
        Nível «${esc(f.nivel)}» ${f.origem_nivel === 'parametro' ? `determinado por ${esc(f.parametro)} = ${esc(f.valor)}` : f.origem_nivel === 'manual' ? 'indicado pelo médico' : '<strong>por defeito</strong> (parâmetro em falta)'}
        ${e?.descricao_leiga ? `<p class="leiga" lang="en">${esc(e.descricao_leiga)}</p>` : ''}
        <span class="citacao">Salomon et al. Lancet Glob Health 2015 · <a href="https://pubmed.ncbi.nlm.nih.gov/26475018/" target="_blank" rel="noopener noreferrer">PMID 26475018</a></span></div>`;
    }
    if (f.tabela === 'kdigo') return `<div>KDIGO ${esc(f.G)}${esc(f.A)} — risco ${esc(f.risco.replace('_', ' '))}${f.albuminuriaEmFalta ? ' (albuminúria em falta)' : ''}</div>`;
    return `<div>${esc(f.parametro)} = ${esc(f.valor)}${f.valor_efetivo != null && f.valor_efetivo !== f.valor ? ` (relativo ao alvo: ${num(f.valor_efetivo)})` : ''} → ${num(f.gravidade)}</div>`;
  }).join('');

  return `
    <div class="detalhe-cab"><h3>${esc(n.rotulo)}</h3>${n.a_validar ? etqValidar : ''}</div>
    <dl class="propriedades">
      <dt>Tipo</dt><dd>${esc(tipo)}${n.derivado ? ' · derivado' : ''}</dd>
      ${n.icpc2 ? `<dt>ICPC-2</dt><dd>${esc(n.icpc2)}</dd>` : ''}
      ${n.subtipo || n.subrotulo ? `<dt>Subtipo</dt><dd>${esc([n.subtipo, n.subrotulo].filter(Boolean).join(' · '))}</dd>` : ''}
      ${n.objetivo ? '' : `<dt>Gravidade</dt><dd><span class="medidor" aria-hidden="true"><span style="width:${Math.round(n.gravidade * 100)}%"></span></span>${categoriaGravidade(n.gravidade)} (${num(n.gravidade)})<br><span class="discreto">${esc(origemGravidade(n.origem_gravidade))}</span></dd>`}
      ${C ? `<dt>Centralidade</dt><dd>${num(C.C)} <span class="discreto">(${C.contribuicoes.length} nós a jusante, até 3 níveis)</span></dd>` : ''}
    </dl>
    ${fontes}
    ${problema && !n.objetivo ? `<label class="chip-controlo"><input type="checkbox" data-alarme="${esc(id)}" ${problema.alarme ? 'checked' : ''}> Sinal de alarme / descompensado (aumenta a urgência)</label>` : ''}
    ${C?.contribuicoes.length ? `<h3>Principais consequências a jusante</h3><ul class="ligacao-lista">${C.contribuicoes.slice(0, 6).map((c) => `<li>${btnNo(a, c.no)} <span class="discreto">nível ${c.nivel} · ${num(c.valor)}</span></li>`).join('')}</ul>` : ''}
    <h3>Causas (a montante)</h3>${listaLig(a, entradas)}
    <h3>Consequências (a jusante)</h3>${listaLig(a, saidas)}
    ${intervs.length ? `<h3>Intervenções que atuam aqui</h3><ul class="ligacao-lista">${intervs.map((r) => `<li><button type="button" class="link-botao" data-intervencao="${esc(r.id)}">${r.posicao}. ${esc(r.rotulo)}</button></li>`).join('')}</ul>` : ''}`;
}

function listaLig(a, ls) {
  if (!ls.length) return '<p class="discreto">—</p>';
  return `<ul class="ligacao-lista">${ls.map((l) => `<li>${btnLig(a, l)} <span class="discreto">${FORCA[l.forca]}</span>${l.desligada ? ' <span class="etq alta">desligada</span>' : ''}${l.override ? ' <span class="etq">override</span>' : ''}${l.a_validar ? ` ${etqValidar}` : ''}</li>`).join('')}</ul>`;
}

function detalheLigacao(a, id) {
  const l = a.grafo.ligacoes.find((x) => x.id === id);
  if (!l) return '';
  const ov = (estado.caso.overrides ?? []).find((o) => `${o.origem}->${o.destino}` === id);
  return `
    <div class="detalhe-cab"><h3>${btnNo(a, l.origem)} ${l.atenua ? '⊣' : '→'} ${btnNo(a, l.destino)}</h3>${l.a_validar ? etqValidar : ''}</div>
    <dl class="propriedades">
      <dt>Força</dt><dd>${FORCA[l.forca]}${l.forca_original && l.forca !== l.forca_original ? ` (KB: ${FORCA[l.forca_original]})` : ''}${l.desligada ? ' · <strong>desligada</strong>' : ''}</dd>
      <dt>Evidência</dt><dd>${esc(l.evidencia)}</dd>
      ${l.fator != null && l.fator !== 1 ? `<dt>Subtipo</dt><dd>aplica-se a ${esc(l.subtipo_destino)}; subtipo não especificado → ${pct(l.fator)}</dd>` : ''}
      ${l.bi ? '<dt>Relação</dt><dd>bidirecional</dd>' : ''}
      ${l.atenua ? '<dt>Relação</dt><dd>protetora (atenua o destino)</dd>' : ''}
      ${l.origem_kb === 'acrescentada' ? '<dt>Origem</dt><dd>acrescentada ao seed pelo desenvolvimento — a validar</dd>' : ''}
      ${l.objetivo ? '<dt>Origem</dt><dd>associação a um objetivo do utente</dd>' : ''}
    </dl>
    ${l.nota ? `<p class="discreto">${esc(l.nota)}</p>` : ''}
    <h3>Referências</h3>${l.objetivo ? '<p class="discreto">—</p>' : refsHTML(kb, l.refs)}
    ${l.objetivo ? '' : `
    <h3>Override clínico</h3>
    <form class="formulario" data-override="${esc(id)}">
      <div class="grupo-botoes" role="radiogroup" aria-label="Ação">
        ${[['reforcar', 'Reforçar'], ['enfraquecer', 'Enfraquecer'], ['desligar', 'Desligar']].map(([v, t]) => `<label><input type="radio" name="acao" value="${v}" ${ov?.acao === v ? 'checked' : ''}> ${t}</label>`).join(' ')}
      </div>
      <label>Justificação (obrigatória)<textarea name="justificacao" aria-required="true">${esc(ov?.justificacao ?? '')}</textarea></label>
      <div class="grupo-botoes"><button type="submit">Aplicar</button>${ov ? '<button type="button" data-remover-override>Remover override</button>' : ''}</div>
      <p class="discreto" data-erro role="alert"></p>
    </form>`}`;
}

function detalheIntervencao(a, id) {
  const r = a.ranking.find((x) => x.id === id);
  if (!r) return '';
  const d = r.decomposicao;
  const s = estado.sens?.intervencoes.find((x) => x.id === id);
  const pref = estado.caso.preferencias?.[id] ?? 'neutro';
  const linhaBen = (b) => `<tr>
    <td>${btnNo(a, b.no)}${b.subtipo ? ` <span class="discreto">(${esc(b.subtipo)})</span>` : ''}${b.nota ? `<br><span class="discreto">${esc(b.nota)}</span>` : ''}${b.acrescentado ? ' <span class="etq validar">acrescentado</span>' : ''}<br>${refsHTML(kb, b.refs)}</td>
    <td>${MAGNITUDE[b.magnitude]} <span class="discreto">(${b.magnitude})</span><br><span class="discreto">${HORIZONTE[b.horizonte]}${b.retorno_decrescente ? ' · retorno decrescente' : ''}</span></td>
    <td>${categoriaGravidade(b.gravidade)}</td>
    <td class="num">${num(b.contribuicao)}</td></tr>`;
  return `
    <div class="detalhe-cab"><h3>${r.posicao}. ${esc(r.rotulo)}</h3>${r.a_validar ? etqValidar : ''}</div>
    <dl class="propriedades">
      <dt>Categoria</dt><dd>${esc(kb.categorias[r.categoria])}</dd>
      <dt>Pontuação</dt><dd>${num(r.pontuacao)} <span class="discreto">(unidade arbitrária; só serve para ordenar)</span></dd>
      <dt>Estabilidade</dt><dd>${s ? `posição mediana ${num(s.posicao_mediana)}; P5–P95 ${s.posicao_p5}.ª–${s.posicao_p95}.ª; 1.º lugar ${pct(s.p_top1)} · top 3 ${pct(s.p_top3)} · top 5 ${pct(s.p_top5)} — <strong>${esc(s.estabilidade)}</strong>` : estado.sensPendente ? 'a calcular…' : '—'}</dd>
      <dt>Eixos</dt><dd>C ${num(r.eixos.C)} · U ${num(r.eixos.U)} · M ${num(r.eixos.M)} · G ${num(r.eixos.G)}</dd>
    </dl>
    ${r.alertas.map((al) => `<div class="alerta ${al.gravidade}"><strong>${esc(al.titulo)}:</strong> ${esc(al.mensagem)}</div>`).join('')}
    ${r.ponte ? `<div class="caixa aviso-ponte"><strong>Ponte obrigatória.</strong> ${esc(r.ponte.aviso)}</div>` : ''}
    <h3>Porque está nesta posição</h3>
    <ul class="ligacao-lista">${r.explicacao.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Benefícios (efeitos diretos)</h3>
    <table><thead><tr><th>Alvo e evidência</th><th>Efeito</th><th>Gravidade</th><th class="num">Contributo</th></tr></thead><tbody>${d.beneficios.map(linhaBen).join('')}</tbody></table>
    ${r.efeitos_nulos.length ? `<p class="discreto">Sem efeito demonstrado: ${r.efeitos_nulos.map((e) => `${esc(rot(a, e.alvo))} (${esc(e.nota)}; ${refsHTML(kb, e.refs)})`).join('; ')}</p>` : ''}
    <h3>Fatores</h3>
    <table><tbody>
      <tr><th scope="row">Urgência (U)</th><td class="num">×${num(d.fator_U)}</td><td>${d.alertas_resolvidos.length ? `resolve: ${d.alertas_resolvidos.map(esc).join(', ')}` : ''}</td></tr>
      <tr><th scope="row">Adesão prevista</th><td class="num">×${num(d.fator_adesao)}</td><td>má adesão estimada ${num(d.g_ma_adesao)}</td></tr>
      <tr><th scope="row">Preferência do utente</th><td class="num">×${num(d.fator_preferencia)}</td><td>${esc(PREFERENCIA[d.preferencia])}</td></tr>
      ${d.fator_evidencia !== 1 ? `<tr><th scope="row">Ajuste de evidência</th><td class="num">×${num(d.fator_evidencia)}</td><td>${esc(d.ajuste_evidencia.motivo)}</td></tr>` : ''}
      <tr><th scope="row">Bónus de objetivo (G)</th><td class="num">+${num(d.bonus_G)}</td><td>${d.G_por_objetivo.filter((o) => o.valor > 0).map((o) => `«${esc(o.texto)}» via ${esc(rot(a, o.no))}`).join('; ') || 'sem caminho até ao objetivo'}</td></tr>
      ${d.horizonte_reduzido ? '<tr><th scope="row">Tempo até ao benefício</th><td></td><td>benefícios a anos ponderados a 50 % (fragilidade/idade)</td></tr>' : ''}
    </tbody></table>
    <h3>Custos e riscos</h3>
    ${d.custos.length ? `<table><tbody>${d.custos.map((c) => `<tr><td>${esc(c.rotulo)}${c.motivos_amplificacao.length ? `<br><span class="discreto">amplificado por: ${c.motivos_amplificacao.map((m) => esc(rot(a, m))).join(', ')}</span>` : ''}</td><td>${esc(c.categoria)}</td><td class="num">−${num(c.valor)}</td></tr>`).join('')}</tbody></table>` : '<p class="discreto">Sem custos registados na base de conhecimento.</p>'}
    ${r.variantes.length ? `<h3>Variantes</h3><ul class="ligacao-lista">${r.variantes.map((v) => `<li>${esc(v.rotulo)}: ${[...(v.efeitos_extra ?? []).map((e) => `${MAGNITUDE[e.magnitude]} em ${esc(rot(a, e.alvo))}${e.nota ? ` (${esc(e.nota)})` : ''}`), ...(v.cria ?? []).map((c) => `pode agravar ${esc(rot(a, c.alvo))} (${esc(c.nota)})`)].join('; ')}</li>`).join('')}</ul>` : ''}
    ${r.sinergias.length ? `<p class="discreto">${r.sinergias.map((x) => esc(x.nota)).join('; ')}</p>` : ''}
    ${r.beneficios_qualitativos.length ? `<p class="discreto">Outros benefícios possíveis: ${r.beneficios_qualitativos.map(esc).join('; ')}</p>` : ''}
    <h3>Preferência do utente</h3>
    <div class="grupo-botoes" role="group" aria-label="Preferência do utente">
      ${Object.entries(PREFERENCIA).map(([k, t]) => `<button type="button" data-pref="${k}" aria-pressed="${pref === k}">${t}</button>`).join('')}
    </div>
    <p class="discreto">A app não sugere doses: a medicação e a posologia são definidas pelo médico.</p>`;
}

function ligarEventos(c) {
  c.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', () => selecionar({ tipo: 'no', id: b.dataset.no })));
  c.querySelectorAll('[data-ligacao]').forEach((b) => b.addEventListener('click', () => selecionar({ tipo: 'ligacao', id: b.dataset.ligacao })));
  c.querySelectorAll('[data-intervencao]').forEach((b) => b.addEventListener('click', () => selecionar({ tipo: 'intervencao', id: b.dataset.intervencao })));
  c.querySelectorAll('[data-pref]').forEach((b) => b.addEventListener('click', () => {
    const id = estado.selecao.id;
    alterarCaso((caso) => { caso.preferencias = { ...(caso.preferencias ?? {}), [id]: b.dataset.pref }; });
  }));
  c.querySelectorAll('[data-alarme]').forEach((chk) => chk.addEventListener('change', () => {
    alterarCaso((caso) => { const p = caso.problemas.find((x) => x.id === chk.dataset.alarme); if (p) p.alarme = chk.checked; });
  }));
  const form = c.querySelector('form[data-override]');
  if (form) {
    const id = form.dataset.override;
    const [origem, destino] = id.split('->');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const acao = form.acao.value;
      const justificacao = form.justificacao.value.trim();
      const erro = form.querySelector('[data-erro]');
      if (!acao) { erro.textContent = 'Escolha uma ação.'; return; }
      if (!justificacao) { erro.textContent = 'A justificação é obrigatória.'; form.justificacao.focus(); return; }
      alterarCaso((caso) => {
        caso.overrides = (caso.overrides ?? []).filter((o) => `${o.origem}->${o.destino}` !== id);
        caso.overrides.push({ origem, destino, acao, justificacao, data: new Date().toISOString().slice(0, 10) });
      });
    });
    form.querySelector('[data-remover-override]')?.addEventListener('click', () => {
      alterarCaso((caso) => { caso.overrides = (caso.overrides ?? []).filter((o) => `${o.origem}->${o.destino}` !== id); });
    });
  }
}
