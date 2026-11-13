// Utilitários puros do motor (sem DOM, sem I/O).

/** Normaliza texto para chave: minúsculas, sem acentos, espaços colapsados. */
export function normalizar(txt) {
  return String(txt ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Interpolação linear por pontos [[x, y], …] ordenados por x; limitada aos extremos. */
export function interpolar(pontos, x) {
  if (!pontos.length) return null;
  if (x <= pontos[0][0]) return pontos[0][1];
  const ult = pontos[pontos.length - 1];
  if (x >= ult[0]) return ult[1];
  for (let i = 1; i < pontos.length; i++) {
    const [x1, y1] = pontos[i];
    if (x <= x1) {
      const [x0, y0] = pontos[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return ult[1];
}

export const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Combinação com retornos decrescentes: 1 − Π(1 − eᵢ). */
export function combinar(efeitos) {
  return 1 - efeitos.reduce((p, e) => p * (1 - e), 1);
}

export const arred = (v, casas = 3) => Math.round(v * 10 ** casas) / 10 ** casas;

const NIVEIS_FORCA = ['fraca', 'moderada', 'forte'];
export function ajustarForca(forca, delta) {
  const i = NIVEIS_FORCA.indexOf(forca);
  return NIVEIS_FORCA[limitar(i + delta, 0, NIVEIS_FORCA.length - 1)];
}
