# Mapa Causal do Utente — instruções para o projeto

Ferramenta de apoio à decisão para Medicina Geral e Familiar (MGF) em Portugal, para utentes multimórbidos. Representa o utente como uma rede causal, ordena **intervenções** (não doenças) pelo impacto global, simula cenários e produz um plano imprimível, sempre ancorado nos objetivos do próprio utente.

Toda a interface é em **português europeu (PT-PT)**, com terminologia clínica correta.

**Posicionamento:** protótipo de investigação. A ferramenta torna explícito, transparente e contestável o raciocínio de priorização; **não** afirma produzir a ordem ótima. Os coeficientes são escolhas de desenho não validadas. Ver `docs/validacao/protocolo.md` (inclui o enquadramento MDR: regra 11, classe ≥ IIa se houver uso clínico).

## Princípios inegociáveis
1. **Privacidade:** 100 % client-side. Nenhum dado sai do browser. Não há chamadas de rede em runtime (`fetch`, XHR, WebSocket, beacons, fontes e imagens remotas) nem analytics. Sem identificadores pessoais: apenas idade, sexo e dados clínicos.
2. **Offline:** o produto final é UM ficheiro (`dist/mapa-causal.html`) com todas as bibliotecas embutidas, nunca via CDN. A CSP do HTML final inclui `connect-src 'none'`.
3. **Transparência:** cada ligação e cada efeito mostram força, nível de evidência e referência (PMID com link `https://pubmed.ncbi.nlm.nih.gov/<PMID>/`, que só abre com clique). Cada pontuação é decomponível.
4. **Honestidade:** efeitos apresentados como categorias/intervalos, sem falsa precisão. Mostrar sempre benefícios **e** custos. Assinalar visualmente tudo o que está marcado `a_validar`.
5. **Sem doses:** a app nunca sugere doses. A medicação (incluindo a dose) é introduzida pelo médico.
6. **Aviso permanente:** "Ferramenta de apoio à decisão; não substitui o juízo clínico."
7. **Robustez visível:** qualquer posição no ranking mostrada na UI é acompanhada da sua estabilidade (análise de sensibilidade: intervalo P5–P95 e P(top 3)). Nunca mostrar só a posição pontual.

## Estrutura
```
src/kb/*.json      base de conhecimento editável (separada do código)
  nodes.json         nós (tipos: doenca, comportamento, determinante, funcionalidade, medicacao, objetivo_recurso, risco)
  edges.json         ligações causais (força, evidência, refs, bi, subtipo)
  interventions.json intervenções (efeitos, horizonte, cria, custos, requisitos)
  references.json    chave → PMID
  severity_tables.json  modificadores → gravidade (a_validar)
  drugs.json         DCI → classe
  alerts.json        regras de alertas de combinação
  config.json        TODOS os coeficientes do motor (a_validar)
  disability_weights.json  DW do GBD 2013 (Salomon 2015, Tabela 2) + mapeamento nível clínico → estado GBD (a_validar)
src/engine/        motor puro: sem DOM, sem I/O, kb/config injetados; testável em Node
  sensitivity.js     Monte Carlo + tornado sobre coeficientes e gravidades por defeito
scripts/           exportar-delphi.js (questionário RAND/UCLA), sensibilidade.js (relatório)
docs/validacao/    protocolo de validação, relatório de sensibilidade, CSV Delphi
src/ui/            interface (vanilla JS, ES modules)
src/cases/         casos de teste pré-carregados (A, B)
tests/             node --test
build.js           gera dist/mapa-causal.html com tudo inline (esbuild)
```

## Convenções
- O motor nunca importa nada de `src/ui` nem usa APIs do browser. O browser e os testes chamam `analisar(caso, kb, config)` de `src/engine/index.js`.
- Coeficientes numéricos **só** em `config.json` ou nas tabelas da KB, nunca hard-coded no motor.
- Qualquer entrada sem referência verificada leva `"a_validar": true`.
- Ligações referem nós por `id`; os subtipos (p. ex. `ic` FEr/FEp) usam o campo `subtipo` e não ids novos.
- Os nós de tipo `risco` (eventos_cv, quedas, lesao_renal, …) são instanciados automaticamente quando há um progenitor presente, com gravidade derivada.
- Gravidade dos nós sintomáticos: `config.gravidade.fonte_sintomatica` = `gbd2013` (defeito) ou `tabelas`. Nós prognósticos (DM2, HTA, DRC/KDIGO, risco CV, obesidade) usam sempre as tabelas de risco.
- Na UI, os números usam vírgula decimal (`Intl.NumberFormat('pt-PT')`).
- localStorage serve apenas de rascunho e é sempre envolvido em try/catch. Persistência real = exportar/importar JSON.

## Comandos
- `npm test`: testes do motor e dos casos A/B (correr no fim de cada fase).
- `npm run build`: gera `dist/mapa-causal.html`.
- `npm run sensibilidade`: regenera `docs/validacao/sensibilidade.md` (correr após mudar KB/config).
- `npm run delphi`: regenera os CSV do Delphi a partir da KB.
- Quando um item é validado em Delphi: `"a_validar": false` + `"validado": "Delphi R<n>, mediana <m>"`.

## Fases
1. Estrutura, KB, motor e testes · 2. Vistas 3D · 3. Simulador · 4. Modo utente e impressão · 5. Build offline e acessibilidade. Parar no fim de cada fase para validação clínica.
