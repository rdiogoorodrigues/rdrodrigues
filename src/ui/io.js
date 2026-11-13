// Exportar/importar o caso em JSON (download/upload local; nada sai do computador).
import { exportarCaso, importarCaso } from '../engine/case.js';
import { estado, definirCaso } from './estado.js';

export function exportar() {
  const blob = new Blob([exportarCaso(estado.caso)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(estado.caso.id || 'caso').replace(/[^\w-]+/g, '_')}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importar(ficheiro) {
  const texto = await ficheiro.text();
  const caso = importarCaso(texto); // lança erro com mensagem clara se inválido
  definirCaso(caso, 'importado');
  return caso;
}
