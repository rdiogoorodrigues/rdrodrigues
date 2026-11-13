// Objetos three.js partilhados: formas por tipo de nó, rótulos em sprite, linhas tracejadas.
import * as THREE from 'three';

export const corCSS = (nome, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || fallback;
};

/** Rótulo de texto como sprite (canvas local; sem fontes externas). */
export function rotuloSprite(texto, { cor = '#1b1f24', contorno = '#ffffff', altura = 4.2, negrito = false } = {}) {
  const px = 48;
  const fonte = `${negrito ? 700 : 500} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = fonte;
  const largura = Math.ceil(ctx.measureText(texto).width) + 16;
  c.width = largura;
  c.height = px + 16;
  ctx.font = fonte;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = contorno;
  ctx.lineJoin = 'round';
  ctx.strokeText(texto, 8, c.height / 2);
  ctx.fillStyle = cor;
  ctx.fillText(texto, 8, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set((altura * c.width) / c.height, altura, 1);
  s.renderOrder = 10;
  return s;
}

function estrela(raio) {
  const forma = new THREE.Shape();
  const pontas = 5;
  for (let i = 0; i < pontas * 2; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.45;
    const a = (i / (pontas * 2)) * Math.PI * 2 + Math.PI / 2;
    const p = [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) forma.moveTo(...p); else forma.lineTo(...p);
  }
  forma.closePath();
  const g = new THREE.ExtrudeGeometry(forma, { depth: raio * 0.35, bevelEnabled: false });
  g.center();
  return g;
}

/** Geometria por tipo de nó (forma própria para cada tipo). */
export function geometriaTipo(tipo, r, { objetivo = false, recurso = false } = {}) {
  if (objetivo) return estrela(r * 1.4);
  switch (tipo) {
    case 'doenca': return new THREE.SphereGeometry(r, 24, 16);
    case 'comportamento': return new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6);
    case 'determinante': return new THREE.OctahedronGeometry(r * 1.2);
    case 'funcionalidade': return new THREE.CylinderGeometry(r, r, r * 1.6, 20);
    case 'medicacao': return new THREE.CapsuleGeometry(r * 0.7, r * 1.2, 6, 16);
    case 'objetivo_recurso': return recurso ? new THREE.DodecahedronGeometry(r * 1.1) : estrela(r * 1.3);
    case 'risco': return new THREE.SphereGeometry(r * 0.85, 20, 14);
    default: return new THREE.SphereGeometry(r, 16, 12);
  }
}

/** Linha tracejada (para ligações a_validar). Atualizada em linkPositionUpdate. */
export function linhaTracejada(cor) {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const m = new THREE.LineDashedMaterial({ color: cor, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.85 });
  const l = new THREE.Line(g, m);
  l.userData.tracejada = true;
  return l;
}
export function atualizarLinha(linha, start, end) {
  const pos = linha.geometry.attributes.position;
  pos.setXYZ(0, start.x, start.y, start.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  linha.geometry.computeBoundingSphere();
  linha.computeLineDistances();
}

export function temWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
