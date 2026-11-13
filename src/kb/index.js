// Agrega a base de conhecimento (JSON) num único objeto. Sem I/O em runtime: o bundler embute os JSON.
import nodes from './nodes.json' with { type: 'json' };
import edges from './edges.json' with { type: 'json' };
import interventions from './interventions.json' with { type: 'json' };
import references from './references.json' with { type: 'json' };
import severity from './severity_tables.json' with { type: 'json' };
import drugs from './drugs.json' with { type: 'json' };
import alerts from './alerts.json' with { type: 'json' };
import config from './config.json' with { type: 'json' };

export const kbBruta = { nodes, edges, interventions, references, severity, drugs, alerts };
export const configPorDefeito = config;
