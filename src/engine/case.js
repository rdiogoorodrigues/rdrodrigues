// Esquema do caso, validação, importação/exportação (JSON local). Sem identificadores pessoais.

export const SCHEMA_VERSION = 1;

/** Campos que NUNCA devem constar de um caso (identificadores pessoais). */
const PROIBIDOS = ['nome', 'apelido', 'nif', 'sns', 'numero_utente', 'n_utente', 'cc', 'morada', 'endereco', 'telefone', 'telemovel', 'email', 'data_nascimento', 'nascimento', 'processo'];

function procurarProibidos(obj, caminho = '', achados = []) {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (PROIBIDOS.includes(k.toLowerCase())) achados.push(caminho ? `${caminho}.${k}` : k);
      procurarProibidos(v, caminho ? `${caminho}.${k}` : k, achados);
    }
  }
  return achados;
}

function removerProibidos(obj) {
  if (Array.isArray(obj)) return obj.map(removerProibidos);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (!PROIBIDOS.includes(k.toLowerCase())) out[k] = removerProibidos(v);
    return out;
  }
  return obj;
}

export function casoVazio() {
  return {
    schemaVersion: SCHEMA_VERSION, id: 'novo', descricao: '',
    utente: { idade: null, sexo: null }, parametros: {}, alvos: {},
    problemas: [], medicacao: [], objetivos: [], preferencias: {}, em_curso: [], overrides: [],
  };
}

/**
 * Valida o caso. 'erros' impedem uma análise fiável (conjunto mínimo); 'avisos' não.
 * O motor corre mesmo com erros, para que a UI possa mostrar o estado parcial.
 */
export function validarCaso(caso, kb) {
  const erros = [];
  const avisos = [];
  if (!caso || typeof caso !== 'object') return { erros: ['Caso inválido.'], avisos };
  if (caso.schemaVersion !== SCHEMA_VERSION) avisos.push(`Versão de esquema ${caso.schemaVersion} ≠ ${SCHEMA_VERSION}.`);
  const u = caso.utente ?? {};
  if (!(Number.isFinite(u.idade) && u.idade >= 0 && u.idade <= 120)) erros.push('Idade em falta ou inválida.');
  if (!['M', 'F'].includes(u.sexo)) erros.push('Sexo em falta (M/F).');
  const probs = caso.problemas ?? [];
  if (!probs.some((p) => kb.nos.get(p.id)?.icpc2)) erros.push('Conjunto mínimo: pelo menos um problema com código ICPC-2.');
  for (const p of probs) if (!kb.nos.has(p.id)) erros.push(`Problema desconhecido: ${p.id}`);
  const nParam = Object.values(caso.parametros ?? {}).filter((v) => v != null && v !== '').length;
  if (nParam < 3) avisos.push(`Conjunto mínimo recomendado: 3–4 parâmetros-chave (tem ${nParam}). As gravidades em falta usam o valor por defeito.`);
  if (!(caso.objetivos ?? []).some((o) => o.texto && o.texto.trim())) erros.push('Conjunto mínimo: pelo menos um objetivo do utente.');
  for (const o of caso.objetivos ?? []) if (!(o.nos ?? []).length) avisos.push(`Objetivo «${o.texto}» não está associado a nenhum nó.`);
  for (const o of caso.overrides ?? []) if (!o.justificacao?.trim()) erros.push(`Override ${o.origem}→${o.destino} sem justificação.`);
  for (const m of caso.medicacao ?? []) if (!m.dci) erros.push('Linha de medicação sem DCI.');
  const ids = procurarProibidos(caso);
  if (ids.length) erros.push(`Campos de identificação pessoal não permitidos: ${ids.join(', ')}.`);
  return { erros, avisos };
}

/** Serializa o caso para download (remove identificadores pessoais). */
export function exportarCaso(caso) {
  return JSON.stringify({ ...removerProibidos(caso), schemaVersion: SCHEMA_VERSION }, null, 2);
}

/** Lê um caso de texto JSON (upload local). Lança erro se for inválido. */
export function importarCaso(texto) {
  let obj;
  try { obj = JSON.parse(texto); } catch { throw new Error('Ficheiro não é JSON válido.'); }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.problemas)) throw new Error('JSON não tem o formato de um caso.');
  const limpo = removerProibidos(obj);
  return { ...casoVazio(), ...limpo, schemaVersion: SCHEMA_VERSION };
}
