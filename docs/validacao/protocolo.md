# Protocolo de validação — Mapa Causal do Utente

Versão 0.1 · 2026-11-13 · documento de trabalho

## 1. Posicionamento (o que a ferramenta afirma e o que não afirma)

**Afirma:** torna explícito, transparente e contestável o raciocínio de priorização de intervenções num utente multimórbido, ancorado nos objetivos do próprio utente. Cada pontuação é decomponível, cada ligação mostra a evidência, e a robustez do ranking à incerteza dos coeficientes é visível.

**Não afirma:** que a ordem produzida é ótima ou que prevê desfechos. Os coeficientes do motor são escolhas de desenho, ordinais e plausíveis, mas **não estimativas empíricas**. Até à conclusão das etapas 3–4, a ferramenta é um **protótipo de investigação**.

Enquadramento metodológico: análise de decisão multicritério (MCDA) em saúde (Thokala 2016; Marsh 2016), aplicada ao nível individual e alinhada com os princípios de cuidados orientados por prioridades do utente (Muth 2014; Tinetti 2019).

## 2. Enquadramento regulamentar

Software destinado a apoiar decisões terapêuticas em doentes individuais é, em princípio, **dispositivo médico pela regra 11 do Regulamento (UE) 2017/745 (MDR)**, com classe ≥ IIa (orientação MDCG 2019-11). O aviso "não substitui o juízo clínico" não afasta esta qualificação.

- **Uso em investigação** (estudos de vinhetas, Delphi, avaliação em ambiente controlado): enquadrável como investigação, com aprovação por comissão de ética e, se houver uso em doentes reais, avaliação da necessidade de investigação clínica de dispositivo (MDR, art. 62.º e ss.).
- **Uso clínico rotineiro:** exige marcação CE e organismo notificado. A decisão sobre o destino pretendido deve preceder a etapa 4.

## 3. Etapas

| Etapa | Pergunta | Método | Produto |
|---|---|---|---|
| 0. Robustez (feito) | O ranking depende de valores exatos dos coeficientes? | Monte Carlo + tornado (`npm run sensibilidade`) | `sensibilidade.md`; testes de robustez em `tests/sensitivity.test.js` |
| 1. Validade de conteúdo | As ligações, efeitos, custos e tabelas são clinicamente aceitáveis? | Delphi modificado, método RAND/UCLA | KB revista; itens `a_validar` resolvidos |
| 2. Ancoragem empírica | É possível substituir valores arbitrários por dados? | Ver secção 5 | KB v2 |
| 3. Validade de critério | O ranking concorda com o juízo de peritos? | Estudo de vinhetas | τ de Kendall ferramenta–painel vs. médico–painel |
| 4. Impacto | Muda o processo de cuidados? | Ensaio pragmático em cluster (USF) | Desfechos de processo (ver 3.4) |

### 3.1 Etapa 0 — Análise de sensibilidade (implementada)

- **Coeficientes:** cada grupo multiplicado por U(1 − a, 1 + a), com a ordem preservada; as amplitudes estão em `config.json → sensibilidade`.
- **Dados em falta:** as gravidades que usaram o valor por defeito são amostradas em U(0,3; 0,7). Isto separa a incerteza *do modelo* da incerteza *dos dados do utente*.
- **Saídas:** por intervenção, posição mediana, P5–P95, P(top 1/3/5) e estabilidade; τ de Kendall global; tornado.
- **Valor da informação:** o tornado inclui as gravidades não medidas. Se "IC (gravidade por defeito)" muda a ordem, medir a classe NYHA é a ação que mais estabiliza a decisão.
- **Critério de aceitação nos casos A e B:** os critérios clínicos da especificação mantêm-se em ≥ 90 % das simulações (testado).

### 3.2 Etapa 1 — Delphi modificado (RAND/UCLA)

- **Painel:** 9–15 médicos de MGF, com pelo menos 2 internistas/geriatras e 1 farmacêutico clínico; diversidade de USF/UCSP e região. Recrutamento sugerido via APMGF.
- **Materiais:** `npm run delphi` gera `delphi-ronda1.csv` (todos os itens) e `delphi-ronda1-a-validar.csv`. Cada item traz a proposta, a evidência e os PMID. Cada perito pontua de 1 a 9 e pode propor uma alternativa.
- **Volume:** 175 itens a validar é demasiado para uma ronda. Dividir por módulos (cardiometabólico; músculo-esquelético/funcionalidade; medicação/desprescrição; saúde mental/social; coeficientes) e atribuir subpainéis.
- **Classificação (RAND/UCLA):** mediana 1–3 = inadequado; 4–6 = incerto; 7–9 = adequado. Há *desacordo* (painel de 9) se ≥ 3 pontuações em 1–3 **e** ≥ 3 em 7–9. Itens incertos ou em desacordo seguem para a ronda 2, com feedback anónimo da distribuição; a ronda 3 é presencial ou síncrona (técnica de grupo nominal) para os restantes.
- **Consequência na KB:** item adequado sem desacordo → `a_validar: false`, com registo `"validado": "Delphi R<n>, mediana <m>"`; item inadequado → removido ou reformulado; coeficientes → valor mediano proposto.
- Referência: Jones & Hunter 1995.

### 3.3 Etapa 3 — Estudo de vinhetas

- **Vinhetas:** 30–50 casos multimórbidos realistas, estratificados por complexidade e faixa etária, construídos a partir de casos anonimizados ou sintéticos. Sem dados identificáveis.
- **Referência:** um painel independente (não o do Delphi) ordena consensualmente as 5 intervenções prioritárias de cada vinheta.
- **Comparação:** τ de Kendall e concordância no top 3 entre ferramenta e painel, **comparados com a concordância entre médicos individuais e o painel**. A ferramenta é útil se não for inferior aos médicos individuais; se for superior a médicos sem a ferramenta, há sinal de benefício.
- **Secundário:** braço com e sem ferramenta (médicos aleatorizados): concordância com o painel, tempo, identificação de alertas (p. ex. triple whammy) e de oportunidades de desprescrição.
- **Amostra:** a calcular com bioestatística a partir de um estudo-piloto (10 vinhetas, 5 médicos).

### 3.4 Etapa 4 — Impacto

Ensaio pragmático aleatorizado por cluster (USF). Desfechos de processo: proporção de planos com objetivos documentados, desprescrições potencialmente apropriadas, carga terapêutica (Treatment Burden Questionnaire), alinhamento percebido com prioridades. O ensaio Patient Priorities Care, não aleatorizado, mostrou redução da carga terapêutica e mais suspensões de medicação (Tinetti 2019); é um precedente de desenho e de desfechos.

## 4. Limitações conhecidas do modelo (a declarar em qualquer publicação)

1. A gravidade 0–1 é um constructo sem unidade comum entre nós. Somar reduções entre nós heterogéneos assume comensurabilidade.
2. Os efeitos são relativos e categóricos, sem risco basal absoluto (exceto onde há SCORE2 ou KDIGO). O PATH Statement recomenda estimativas absolutas individualizadas (Kent 2020).
3. A centralidade residual mitiga, mas não elimina, a sobreposição entre efeitos diretos (ensaios) e indiretos (grafo).
4. As sinergias entre intervenções estão representadas apenas qualitativamente (p. ex. TCC-I facilita a desprescrição de BZD).
5. A estrutura do grafo vem de evidência populacional; a heterogeneidade individual é captada só pelos modificadores.

## 5. Ancoragem empírica (etapa 2)

**Feito (2026-11-13): disability weights do GBD 2013.** A Tabela 2 de Salomon 2015 foi transcrita para `src/kb/disability_weights.json` (48 estados relevantes, com IC 95 %) e mapeada para 18 nós sintomáticos. Transformação g = DW^γ, ancorada na mediana dos 235 estados (0,128 → 0,5). Ativa-se com `config.gravidade.fonte_sintomatica = "gbd2013"`; na análise de sensibilidade, o DW é amostrado (triangular) no IC 95 % publicado.

- **Resultado nos casos A e B:** τ de Kendall entre modos de 0,96 e 1,00; os critérios clínicos mantêm-se. Ancorar a gravidade sintomática em dados empíricos não altera as decisões de topo.
- **Limitação:** só 2 nós por caso são mapeáveis. O teste é fraco para casos dominados por doença mental, DPOC ou demência, onde o GBD atribui DW muito superiores aos da IC (p. ex. depressão moderada 0,396 vs IC moderada 0,072).
- **A validar:** a correspondência nível clínico ↔ estado GBD (p. ex. NYHA III = IC moderada) foi inferida sem as descrições leigas do apêndice. Itens D001–D018 no questionário Delphi.
- **Pendente:** comparar com os DW do GBD 2019/2021, se disponíveis.

Restantes ancoragens previstas:

| Parâmetro | Fonte candidata |
|---|---|
| Gravidade dos nós doença/funcionalidade | Disability weights do GBD (Salomon 2015), mapeados para os estados de saúde da KB e reescalados |
| Magnitude dos efeitos | RRA/NNT dos ensaios de referência, aplicada ao risco basal (SCORE2/SCORE2-OP, KDIGO) |
| Peso dos benefícios a longo prazo | Tempo até ao benefício (p. ex. estatinas em prevenção primária: Yourman 2021), comparado com a esperança de vida estimada |
| Estrutura do grafo | Redes fenotípicas de comorbilidade (Hidalgo 2009) e MR (Larsson 2021); calibração possível com dados de cuidados primários portugueses, mediante parecer da CNPD e da comissão de ética |

## Referências (PMID verificados no PubMed)

- Thokala P et al. Value Health 2016 — PMID 26797229 · [DOI](https://doi.org/10.1016/j.jval.2015.12.003)
- Marsh K et al. Value Health 2016 — PMID 27021745 · [DOI](https://doi.org/10.1016/j.jval.2015.12.016)
- Muth C et al. BMC Med 2014 (princípios Ariadne) — PMID 25484244 · [DOI](https://doi.org/10.1186/s12916-014-0223-1)
- Tinetti ME et al. JAMA Intern Med 2019 (ensaio não aleatorizado) — PMID 31589281 · [DOI](https://doi.org/10.1001/jamainternmed.2019.4235)
- Kent DM et al. Ann Intern Med 2020 (PATH Statement) — PMID 31711134 · [DOI](https://doi.org/10.7326/M18-3667)
- Salomon JA et al. Lancet Glob Health 2015 — PMID 26475018 · [DOI](https://doi.org/10.1016/S2214-109X(15)00069-8)
- Yourman LC et al. JAMA Intern Med 2021 — PMID 33196766 · [DOI](https://doi.org/10.1001/jamainternmed.2020.6084)
- Hidalgo CA et al. PLoS Comput Biol 2009 — PMID 19360091 · [DOI](https://doi.org/10.1371/journal.pcbi.1000353)
- Jones J, Hunter D. BMJ 1995 — PMID 7640549 · [DOI](https://doi.org/10.1136/bmj.311.7001.376)
- Larsson SC et al. BMC Med 2021 — PMID 34906131 · [DOI](https://doi.org/10.1186/s12916-021-02188-x)
- Regulamento (UE) 2017/745 (MDR), anexo VIII, regra 11; MDCG 2019-11.
