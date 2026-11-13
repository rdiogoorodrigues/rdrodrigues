// Vista 1 — Rede causal 3D. Eixo vertical = profundidade causal (camada).
// Tamanho do nó = gravidade · espessura da ligação = força · tracejado = a validar · forma/cor = tipo.
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { kb, estado, selecionar, alternarDestaque, subscrever } from '../estado.js';
import { esc, num, categoriaGravidade, CAMADAS, FORCA } from '../formato.js';
import { rotuloSprite, geometriaTipo, linhaTracejada, atualizarLinha, corCSS } from './objetos3d.js';

const ALTURA_CAMADA = 48;
const yCamada = (c) => (c - 2.5) * ALTURA_CAMADA;
const LARGURA = { forte: 1.4, moderada: 0.75, fraca: 0.3 };

export function criarRede(contentor) {
  contentor.innerHTML = '';
  const alvo3d = document.createElement('div');
  alvo3d.style.position = 'absolute';
  alvo3d.style.inset = '0';
  contentor.append(alvo3d);
  contentor.insertAdjacentHTML('beforeend', sobreposicoes());

  const cores = {
    fundo: corCSS('--superficie', '#ffffff'),
    texto: corCSS('--texto', '#1b1f24'),
    ligacao: matchMedia('(prefers-color-scheme: dark)').matches ? '#8b95a3' : '#7d8794',
    caminho: corCSS('--caminho', '#d4a017'),
    validar: corCSS('--validar', '#7a4fb5'),
    atenua: corCSS('--ok', '#1a7f37'),
  };

  let destaque = { nos: new Set(), ligs: new Set(), ativo: false };
  const objetosNo = new Map();
  const nosAnteriores = new Map();

  const fg = new ForceGraph3D(alvo3d, { controlType: 'orbit' })
    .backgroundColor(cores.fundo)
    .showNavInfo(false)
    .nodeId('id')
    .nodeLabel((n) => tooltipNo(n))
    .linkLabel((l) => tooltipLigacao(l))
    .nodeThreeObject((n) => objetoNo(n))
    .linkWidth((l) => (l.a_validar ? 0 : LARGURA[l.forca] * (destacada(l) ? 1.8 : 1)))
    .linkColor((l) => corLigacao(l))
    .linkOpacity(0.6)
    .linkCurvature((l) => (l.bi ? 0.22 : 0))
    .linkDirectionalArrowLength((l) => (l.objetivo ? 0 : 3.2))
    .linkDirectionalArrowRelPos(0.92)
    .linkDirectionalArrowColor((l) => corLigacao(l))
    .linkThreeObject((l) => (l.a_validar ? linhaTracejada(corLigacao(l)) : null))
    .linkPositionUpdate((obj, { start, end }, l) => {
      if (!l.a_validar || !obj?.userData?.tracejada) return false;
      atualizarLinha(obj, start, end);
      return true;
    })
    .onNodeClick((n) => selecionar({ tipo: 'no', id: n.id }))
    .onLinkClick((l) => selecionar({ tipo: 'ligacao', id: l.id }))
    .onBackgroundClick(() => selecionar(null))
    .cooldownTicks(120)
    .warmupTicks(40)
    .onEngineStop(() => { if (enquadrar) { enquadrar = false; fg.zoomToFit(700, 30); } });
  let enquadrar = true;

  fg.d3Force('charge').strength(-140);
  fg.d3Force('link').distance(38);
  adicionarRotulosCamadas(fg, cores);

  // ---- objetos ----
  function objetoNo(n) {
    const r = n.objetivo ? 7 : 2.6 + 7 * (n.gravidade ?? 0.3);
    const tipo = kb.tipos[n.tipo] ?? { cor: '#888' };
    const cor = n.objetivo ? '#d4a017' : tipo.cor;
    const grupo = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: cor, transparent: true, opacity: n.derivado ? 0.5 : 0.93 });
    const malha = new THREE.Mesh(geometriaTipo(n.tipo, r, { objetivo: n.objetivo, recurso: n.recurso }), mat);
    grupo.add(malha);
    if (n.tipo === 'risco') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, 0.35, 8, 40), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7 }));
      halo.rotation.x = Math.PI / 2;
      grupo.add(halo);
    }
    if (n.a_validar) {
      const anel = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r * 1.45, 0)),
        new THREE.LineDashedMaterial({ color: cores.validar, dashSize: 1, gapSize: 0.8 }),
      );
      anel.computeLineDistances();
      grupo.add(anel);
    }
    const rot = rotuloSprite(rotuloCurto(n.rotulo), { cor: cores.texto, contorno: cores.fundo, altura: n.objetivo ? 6 : 4.6, negrito: n.objetivo });
    rot.position.y = r + 4.5;
    grupo.add(rot);
    objetosNo.set(n.id, { grupo, mat, rot, opacidadeBase: mat.opacity });
    return grupo;
  }

  function corLigacao(l) {
    if (destacada(l)) return cores.caminho;
    if (l.atenua) return cores.atenua;
    if (l.override) return '#c2185b';
    if (l.a_validar) return cores.validar;
    return cores.ligacao;
  }
  const destacada = (l) => destaque.ativo && destaque.ligs.has(l.id);

  // ---- dados ----
  function atualizar(analise) {
    const nos = [...analise.grafo.nos.values()].map((n) => {
      const ant = nosAnteriores.get(n.id);
      return {
        id: n.id, rotulo: n.rotulo, tipo: n.tipo, gravidade: n.gravidade, camada: n.camada ?? 2,
        derivado: n.derivado, a_validar: n.a_validar, objetivo: !!n.objetivo, recurso: !!n.recurso,
        origem: n.origem_gravidade, icpc2: n.icpc2, C: n.C,
        fy: yCamada(n.camada ?? 2),
        ...(ant ? { x: ant.x, z: ant.z } : {}),
      };
    });
    const ligacoes = analise.grafo.ligacoes.filter((l) => !l.desligada).map((l) => ({
      id: l.id, source: l.origem, target: l.destino, forca: l.forca, evidencia: l.evidencia,
      a_validar: l.a_validar, atenua: l.atenua, bi: l.bi, objetivo: !!l.objetivo, override: !!l.override,
    }));
    objetosNo.clear();
    fg.graphData({ nodes: nos, links: ligacoes });
    if (enquadrar) setTimeout(() => { if (enquadrar) fg.zoomToFit(700, 30); }, 1300);
    for (const n of nos) nosAnteriores.set(n.id, n);
    aplicarDestaque();
  }

  // ---- destaque (caminho até ao objetivo / seleção) ----
  function calcularDestaque() {
    const a = estado.analise;
    const d = { nos: new Set(), ligs: new Set(), ativo: false };
    if (!a) return d;
    const s = estado.selecao;
    const juntarCaminho = (c) => { c.nos.forEach((x) => d.nos.add(x)); c.ligacoes.forEach((x) => d.ligs.add(x)); };
    if (s?.tipo === 'no') {
      d.nos.add(s.id);
      for (const l of a.grafo.ligacoes) if (l.origem === s.id || l.destino === s.id) { d.ligs.add(l.id); d.nos.add(l.origem); d.nos.add(l.destino); }
    } else if (s?.tipo === 'ligacao') {
      const l = a.grafo.ligacoes.find((x) => x.id === s.id);
      if (l) { d.ligs.add(l.id); d.nos.add(l.origem); d.nos.add(l.destino); }
    } else if (s?.tipo === 'intervencao') {
      const it = a.ranking.find((x) => x.id === s.id);
      const alvos = new Set(it?.decomposicao.beneficios.map((b) => b.no) ?? []);
      alvos.forEach((x) => d.nos.add(x));
      for (const obj of a.caminhos_objetivo) for (const c of obj.caminhos) if (alvos.has(c.nos[0])) juntarCaminho(c);
    } else if (estado.destaqueCaminho) {
      for (const obj of a.caminhos_objetivo) {
        const fortes = obj.caminhos.filter((c) => c.nos.length >= 3).slice(0, 4);
        fortes.forEach(juntarCaminho);
        obj.caminhos.filter((c) => c.nos.length === 2).forEach(juntarCaminho);
      }
    }
    d.ativo = d.nos.size > 0 || d.ligs.size > 0;
    return d;
  }

  function aplicarDestaque() {
    destaque = calcularDestaque();
    for (const [id, o] of objetosNo) {
      const dim = destaque.ativo && !destaque.nos.has(id);
      o.mat.opacity = dim ? 0.18 : o.opacidadeBase;
      o.rot.material.opacity = dim ? 0.3 : 1;
    }
    fg.linkColor(fg.linkColor()).linkWidth(fg.linkWidth()).linkDirectionalArrowColor(fg.linkDirectionalArrowColor());
    // linhas tracejadas: cor manual
    for (const l of fg.graphData().links) {
      const obj = l.__lineObj;
      if (obj?.userData?.tracejada) obj.material.color.set(corLigacao(l));
    }
    const chk = contentor.querySelector('#chk-caminho');
    if (chk) chk.checked = estado.destaqueCaminho;
  }

  function focar(id) {
    const n = fg.graphData().nodes.find((x) => x.id === id);
    if (!n || n.x == null) return;
    const dist = 120;
    const r = Math.hypot(n.x, n.y, n.z) || 1;
    fg.cameraPosition({ x: n.x * (1 + dist / r), y: n.y * (1 + dist / r), z: n.z * (1 + dist / r) + 40 }, n, 900);
  }

  contentor.querySelector('#chk-caminho').addEventListener('change', (e) => alternarDestaque(e.target.checked));
  contentor.querySelector('#btn-centrar').addEventListener('click', () => fg.zoomToFit(600, 30));

  const ro = new ResizeObserver(() => fg.width(contentor.clientWidth).height(contentor.clientHeight));
  ro.observe(contentor);

  let casoAnterior = estado.casoId;
  subscrever((motivo) => {
    if (motivo === 'analise') {
      if (estado.casoId !== casoAnterior) { casoAnterior = estado.casoId; enquadrar = true; nosAnteriores.clear(); }
      atualizar(estado.analise);
    }
    if (motivo === 'selecao') {
      aplicarDestaque();
      if (estado.selecao?.tipo === 'no' && estado.vista === 'rede') focar(estado.selecao.id);
    }
  });

  return {
    fg,
    atualizar,
    pausar: () => fg.pauseAnimation(),
    retomar: () => fg.resumeAnimation(),
  };
}

function rotuloCurto(t) {
  const s = String(t ?? '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return s.length > 34 ? `${s.slice(0, 32)}…` : s;
}

function tooltipNo(n) {
  const tipo = kb.tipos[n.tipo]?.rotulo ?? n.tipo;
  return `<b>${esc(n.rotulo)}</b><br>${esc(n.objetivo ? 'Objetivo do utente' : tipo)}${n.icpc2 ? ` · ICPC-2 ${esc(n.icpc2)}` : ''}`
    + (n.objetivo ? '' : `<br>Gravidade: ${categoriaGravidade(n.gravidade)} (${num(n.gravidade)})${n.derivado ? ' · derivada' : ''}`)
    + (n.a_validar ? '<br><i>a validar</i>' : '');
}
function tooltipLigacao(l) {
  const s = typeof l.source === 'object' ? l.source.rotulo : l.source;
  const t = typeof l.target === 'object' ? l.target.rotulo : l.target;
  return `${esc(s)} ${l.atenua ? '⊣' : '→'} ${esc(t)}<br>Força ${FORCA[l.forca]} · ${esc(l.evidencia ?? '')}${l.a_validar ? '<br><i>a validar</i>' : ''}`;
}

function sobreposicoes() {
  const tipos = Object.entries(kb.tipos).map(([id, t]) => `<li><span class="ponto" style="background:${t.cor}"></span>${esc(t.rotulo)}</li>`).join('');
  return `
  <div class="sobreposicao-topo">
    <label class="chip-controlo"><input type="checkbox" id="chk-caminho"> Destacar caminhos até ao objetivo</label>
    <button type="button" class="chip-controlo" id="btn-centrar">Centrar</button>
  </div>
  <details class="legenda" open>
    <summary><strong>Legenda</strong></summary>
    <ul>${tipos}<li><span class="ponto" style="background:#d4a017"></span>Objetivo (estrela)</li></ul>
    <div style="margin-top:.3rem">Tamanho = gravidade · espessura = força · <span style="color:var(--validar)">tracejado / contorno = a validar</span> · semitransparente = derivado · verde = protetora · <span style="color:var(--caminho)">dourado = caminho em destaque</span></div>
    <div>Eixo vertical: base (determinantes) → topo (objetivos)</div>
  </details>`;
}

function adicionarRotulosCamadas(fg, cores) {
  const cena = fg.scene();
  CAMADAS.forEach((nome, i) => {
    const s = rotuloSprite(nome, { cor: cores.texto, contorno: cores.fundo, altura: 4.4, negrito: true });
    s.material.opacity = 0.55;
    s.position.set(-150, yCamada(i), 0);
    cena.add(s);
    const linha = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-120, yCamada(i), 0), new THREE.Vector3(120, yCamada(i), 0)]),
      new THREE.LineDashedMaterial({ color: cores.ligacao, dashSize: 2, gapSize: 4, transparent: true, opacity: 0.25 }),
    );
    linha.computeLineDistances();
    cena.add(linha);
  });
}
