# Análise de sensibilidade do ranking

Gerado por `npm run sensibilidade`. 500 simulações por caso, semente 20261113 (reprodutível).

**Incerteza simulada:** coeficientes do motor × U(1 − a, 1 + a), preservando a ordem (forte > moderada > fraca, + < ++ < +++, menor < moderado < major); gravidades que usaram o valor por defeito ~ U(0.3; 0.7).

| Grupo | a |
|---|---|
| forca_peso | ±30 % |
| transmissao | ±30 % |
| magnitude | ±30 % |
| custos | ±50 % |
| peso_desfecho | ±50 % |
| urgencia | ±50 % |
| objetivo | ±50 % |
| adesao | ±50 % |
| centralidade | ±30 % |
| subtipo | ±40 % |

**Leitura:** "estável" = posição P5–P95 varia ≤ 1 lugar; "moderada" ≤ 3; "instável" > 3. O τ de Kendall compara cada simulação com o ranking base (1 = ordem idêntica).

## Caso A — homem, 62 anos, síndrome metabólica com gonartrose

τ de Kendall: média 0,93, P5 0,87. Mesmo 1.º lugar em 65 % das simulações.

Gravidades por defeito (dados não medidos): Hipertensão arterial, Gonartrose, Síndrome de apneia obstrutiva do sono (SAOS), Sedentarismo, AINE crónico.

| Base | Intervenção | Mediana | P5–P95 | Top 1 | Top 3 | Top 5 | Estabilidade |
|---|---|---|---|---|---|---|---|
| 1 | Agonista GLP-1 / GIP-GLP-1 (semaglutido, tirzepatido) | 1 | 1–3 | 65 % | 100 % | 100 % | moderada |
| 2 | Exercício físico prescrito (aeróbio + força + equilíbrio) | 2 | 1–2 | 35 % | 100 % | 100 % | estável |
| 3 | Programa estruturado de perda ponderal | 3 | 2–3 | 0 % | 100 % | 100 % | estável |
| 4 | Suspender AINE crónico | 4 | 4–5 | 0 % | 0 % | 98 % | estável |
| 5 | Estatina | 5 | 4–7 | 0 % | 0 % | 56 % | moderada |
| 6 | CPAP | 6 | 4–6 | 0 % | 0 % | 45 % | moderada |
| 7 | Inibidor do SGLT2 (dapagliflozina, empagliflozina) | 7 | 6–7 | 0 % | 0 % | 1 % | estável |
| 8 | Antidepressivo | 8 | 8–9 | 0 % | 0 % | 0 % | estável |
| 9 | Educação terapêutica | 9 | 8–9 | 0 % | 0 % | 0 % | estável |
| 10 | IECA / ARA | 10 | 10–10 | 0 % | 0 % | 0 % | estável |

**Tornado (um fator de cada vez; influência = 1 − τ mínimo):**

| Fator | Tipo | Influência | Muda o 1.º lugar? |
|---|---|---|---|
| transmissao | coeficiente | 0,09 | sim (exercicio / glp1_gip) |
| magnitude | coeficiente | 0,09 | sim (exercicio / glp1_gip) |
| custos | coeficiente | 0,09 | sim (glp1_gip / exercicio) |
| peso_desfecho | coeficiente | 0,09 | sim (exercicio / glp1_gip) |
| objetivo | coeficiente | 0,09 | sim (glp1_gip / exercicio) |
| Hipertensão arterial | gravidade não medida | 0,09 | sim (exercicio / glp1_gip) |
| forca_peso | coeficiente | 0,04 | não |
| urgencia | coeficiente | 0,04 | não |
| centralidade | coeficiente | 0,04 | não |
| Síndrome de apneia obstrutiva do sono (SAOS) | gravidade não medida | 0,04 | sim (exercicio / glp1_gip) |

## Caso B — mulher, 81 anos, frágil (CFS 6), IC-FEr e DRC G3b

τ de Kendall: média 0,84, P5 0,6. Mesmo 1.º lugar em 89 % das simulações.

Gravidades por defeito (dados não medidos): Hipertensão arterial, Insuficiência cardíaca, Gonartrose, Insónia, AINE crónico, Benzodiazepinas / hipnóticos Z.

| Base | Intervenção | Mediana | P5–P95 | Top 1 | Top 3 | Top 5 | Estabilidade |
|---|---|---|---|---|---|---|---|
| 1 | Suspender AINE crónico | 1 | 1–2 | 89 % | 100 % | 100 % | estável |
| 2 | Exercício físico prescrito (aeróbio + força + equilíbrio) | 2 | 1–2 | 11 % | 100 % | 100 % | estável |
| 3 | Desprescrição de benzodiazepinas / hipnóticos Z | 3 | 3–3 | 0 % | 100 % | 100 % | estável |
| 4 | Estatina | 5 | 4–6 | 0 % | 0 % | 86 % | moderada |
| 5 | Inibidor do SGLT2 (dapagliflozina, empagliflozina) | 5 | 4–6 | 0 % | 0 % | 66 % | moderada |
| 6 | Terapia cognitivo-comportamental para a insónia (TCC-I) | 6 | 4–6 | 0 % | 0 % | 48 % | moderada |

**Tornado (um fator de cada vez; influência = 1 − τ mínimo):**

| Fator | Tipo | Influência | Muda o 1.º lugar? |
|---|---|---|---|
| peso_desfecho | coeficiente | 0,27 | não |
| Insónia | gravidade não medida | 0,27 | não |
| forca_peso | coeficiente | 0,13 | não |
| transmissao | coeficiente | 0,13 | sim (suspender_aine / exercicio) |
| custos | coeficiente | 0,13 | não |
| objetivo | coeficiente | 0,13 | não |
| centralidade | coeficiente | 0,13 | não |
| Insuficiência cardíaca | gravidade não medida | 0,13 | não |

## Comparação: tabelas vs disability weights do GBD 2013

Modo GBD: os nós sintomáticos mapeados em `disability_weights.json` usam g = DW^γ (γ = 0,34, mediana GBD 0,128 → 0,5); na sensibilidade, o DW é amostrado no IC 95 % publicado. Nós prognósticos inalterados.

### Caso A — homem, 62 anos, síndrome metabólica com gonartrose

τ de Kendall entre modos: **0,96**.

| Nó | Gravidade (tabelas) | Estado GBD | DW (IC 95 %) | Gravidade (GBD) | Nível |
|---|---|---|---|---|---|
| Gonartrose | 0,5 | Musculoskeletal problems: legs, moderate | 0,08 (0,05–0,11) | 0,42 | moderado (por defeito) |
| Depressão | 0,33 | Major depressive disorder, mild episode | 0,15 (0,1–0,21) | 0,52 | ligeiro |

| # | Tabelas | GBD | GBD: P5–P95 | GBD: top 3 |
|---|---|---|---|---|
| 1 | Agonista GLP-1 / GIP-GLP-1 (semaglutido, tirzepatido) | Agonista GLP-1 / GIP-GLP-1 (semaglutido, tirzepatido) | 1–3 | 100 % |
| 2 | Exercício físico prescrito (aeróbio + força + equilíbrio) | Exercício físico prescrito (aeróbio + força + equilíbrio) | 1–2 | 100 % |
| 3 | Programa estruturado de perda ponderal | Programa estruturado de perda ponderal | 2–3 | 100 % |
| 4 | Suspender AINE crónico | Suspender AINE crónico | 4–6 | 0 % |
| 5 | Estatina | CPAP | 4–6 | 0 % |
| 6 | CPAP | Estatina | 4–7 | 0 % |
| 7 | Inibidor do SGLT2 (dapagliflozina, empagliflozina) | Inibidor do SGLT2 (dapagliflozina, empagliflozina) | 6–8 | 0 % |
| 8 | Antidepressivo | Antidepressivo | 7–9 | 0 % |
| 9 | Educação terapêutica | Educação terapêutica | 8–9 | 0 % |
| 10 | IECA / ARA | IECA / ARA | 10–10 | 0 % |

### Caso B — mulher, 81 anos, frágil (CFS 6), IC-FEr e DRC G3b

τ de Kendall entre modos: **1**.

| Nó | Gravidade (tabelas) | Estado GBD | DW (IC 95 %) | Gravidade (GBD) | Nível |
|---|---|---|---|---|---|
| Insuficiência cardíaca | 0,5 | Heart failure, moderate | 0,07 (0,05–0,1) | 0,41 | moderado (por defeito) |
| Gonartrose | 0,5 | Musculoskeletal problems: legs, moderate | 0,08 (0,05–0,11) | 0,42 | moderado (por defeito) |

| # | Tabelas | GBD | GBD: P5–P95 | GBD: top 3 |
|---|---|---|---|---|
| 1 | Suspender AINE crónico | Suspender AINE crónico | 1–2 | 100 % |
| 2 | Exercício físico prescrito (aeróbio + força + equilíbrio) | Exercício físico prescrito (aeróbio + força + equilíbrio) | 1–2 | 100 % |
| 3 | Desprescrição de benzodiazepinas / hipnóticos Z | Desprescrição de benzodiazepinas / hipnóticos Z | 3–3 | 100 % |
| 4 | Estatina | Estatina | 4–6 | 0 % |
| 5 | Inibidor do SGLT2 (dapagliflozina, empagliflozina) | Inibidor do SGLT2 (dapagliflozina, empagliflozina) | 4–6 | 0 % |
| 6 | Terapia cognitivo-comportamental para a insónia (TCC-I) | Terapia cognitivo-comportamental para a insónia (TCC-I) | 4–6 | 0 % |

