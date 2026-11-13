// Vista 2 — Espaço de prioridade: cada intervenção é um ponto em C × U × M; cor = alinhamento com os objetivos (G).
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { estado, selecionar, subscrever } from '../estado.js';
import { esc, num, pct } from '../formato.js';
import { rotuloSprite, corCSS } from './objetos3d.js';

const L = 90; // semi-aresta do cubo
const eixo = (v) => (v * 2 - 1) * L;
const CINZA = new THREE.Color('#9aa5b1');
const VERDE = new THREE.Color('#1a7f37');
export const corG = (g) => `#${CINZA.clone().lerp(VERDE, Math.max(0, Math.min(1, g))).getHexString()}`;

export function criarPrioridade(contentor) {
  contentor.innerHTML = '';
  const alvo3d = document.createElement('div');
  alvo3d.style.position = 'absolute';
  alvo3d.style.inset = '0';
  contentor.append(alvo3d);
  contentor.insertAdjacentHTML('beforeend', `
    <details class="legenda" open>
      <summary><strong>Espaço de prioridade</strong></summary>
      <div>C = centralidade causal · U = urgência · M = modificabilidade (efeito × adesão × preferência)</div>
      <div>Cor: <span class="ponto" style="background:${corG(0)}"></span>sem ligação ao objetivo → <span class="ponto" style="background:${corG(1)}"></span>muito alinhada (G)</div>
      <div>Tamanho = pontuação · anel violeta = contém entradas a validar</div>
    </details>`);

  const cores = { fundo: corCSS('--superficie', '#fff'), texto: corCSS('--texto', '#1b1f24'), eixo: '#8b95a3', validar: corCSS('--validar', '#7a4fb5'), sel: corCSS('--realce', '#0b5cad') };
  const objetos = new Map();

  const fg = new ForceGraph3D(alvo3d, { controlType: 'orbit' })
    .backgroundColor(cores.fundo)
    .showNavInfo(false)
    .nodeId('id')
    .nodeLabel((n) => tooltip(n))
    .nodeThreeObject((n) => objeto(n))
    .onNodeClick((n) => selecionar({ tipo: 'intervencao', id: n.id }))
    .onBackgroundClick(() => selecionar(null))
    .cooldownTicks(0)
    .enableNodeDrag(false);
  desenharEixos(fg.scene(), cores);
  fg.cameraPosition({ x: 230, y: 150, z: 270 }, { x: 0, y: 0, z: 0 }, 0);

  function objeto(n) {
    const g = new THREE.Group();
    const r = 2.5 + 6 * n.pnorm;
    const mat = new THREE.MeshLambertMaterial({ color: corG(n.G), transparent: true, opacity: 0.95 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat));
    if (n.a_validar) {
      const anel = new THREE.Mesh(new THREE.TorusGeometry(r * 1.35, 0.3, 8, 40), new THREE.MeshBasicMaterial({ color: cores.validar }));
      anel.rotation.x = Math.PI / 2;
      g.add(anel);
    }
    const sel = new THREE.Mesh(new THREE.SphereGeometry(r * 1.6, 20, 14), new THREE.MeshBasicMaterial({ color: cores.sel, transparent: true, opacity: 0, wireframe: true }));
    g.add(sel);
    const rot = rotuloSprite(`${n.posicao}. ${n.rotuloCurto}`, { cor: cores.texto, contorno: cores.fundo, altura: 4.4 });
    rot.position.y = r + 4;
    g.add(rot);
    objetos.set(n.id, { sel });
    return g;
  }

  function atualizar(analise) {
    const r = analise.ranking;
    const pmax = Math.max(...r.map((x) => x.pontuacao), 0.01);
    const nos = r.map((it) => ({
      id: it.id, rotulo: it.rotulo, rotuloCurto: it.rotulo.replace(/\s*\(.*?\)/g, '').slice(0, 30), posicao: it.posicao,
      C: it.eixos.C, U: it.eixos.U, M: it.eixos.M, G: it.eixos.G, pontuacao: it.pontuacao,
      pnorm: Math.max(0, it.pontuacao) / pmax, a_validar: it.a_validar,
      fx: eixo(it.eixos.C), fy: eixo(it.eixos.U), fz: eixo(it.eixos.M),
    }));
    objetos.clear();
    fg.graphData({ nodes: nos, links: [] });
    marcarSelecao();
  }

  function marcarSelecao() {
    const s = estado.selecao;
    for (const [id, o] of objetos) o.sel.material.opacity = s?.tipo === 'intervencao' && s.id === id ? 0.5 : 0;
  }

  function tooltip(n) {
    const s = estado.sens?.intervencoes.find((x) => x.id === n.id);
    return `<b>${n.posicao}. ${esc(n.rotulo)}</b><br>C ${num(n.C)} · U ${num(n.U)} · M ${num(n.M)} · G ${num(n.G)}<br>Pontuação ${num(n.pontuacao)}`
      + (s ? `<br>Posição P5–P95: ${s.posicao_p5}–${s.posicao_p95} · top 3 em ${pct(s.p_top3)}` : '');
  }

  const ro = new ResizeObserver(() => fg.width(contentor.clientWidth).height(contentor.clientHeight));
  ro.observe(contentor);
  subscrever((motivo) => {
    if (motivo === 'analise') atualizar(estado.analise);
    if (motivo === 'selecao') marcarSelecao();
  });

  return { fg, atualizar, pausar: () => fg.pauseAnimation(), retomar: () => fg.resumeAnimation() };
}

function desenharEixos(cena, cores) {
  const o = new THREE.Vector3(-L, -L, -L);
  const eixos = [
    { fim: new THREE.Vector3(L, -L, -L), nome: 'C — centralidade causal →' },
    { fim: new THREE.Vector3(-L, L, -L), nome: 'U — urgência →' },
    { fim: new THREE.Vector3(-L, -L, L), nome: 'M — modificabilidade →' },
  ];
  for (const e of eixos) {
    cena.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([o, e.fim]), new THREE.LineBasicMaterial({ color: cores.eixo })));
    const s = rotuloSprite(e.nome, { cor: cores.texto, contorno: cores.fundo, altura: 5, negrito: true });
    s.position.copy(e.fim).add(e.fim.clone().sub(o).normalize().multiplyScalar(18));
    cena.add(s);
  }
  const s0 = rotuloSprite('0', { cor: cores.texto, contorno: cores.fundo, altura: 4 });
  s0.position.copy(o).add(new THREE.Vector3(-6, -6, 0));
  cena.add(s0);
  const caixa = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * L, 2 * L, 2 * L)), new THREE.LineBasicMaterial({ color: cores.eixo, transparent: true, opacity: 0.25 }));
  cena.add(caixa);
}
