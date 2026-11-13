# Mapa Causal do Utente

Ferramenta de apoio à decisão para MGF em utentes multimórbidos: rede causal, priorização de intervenções, simulação de cenários e plano imprimível. 100 % client-side e offline. **Não substitui o juízo clínico.**

- Princípios, estrutura e convenções: [`CLAUDE.md`](CLAUDE.md)
- Base de conhecimento editável: `src/kb/*.json` (coeficientes em `src/kb/config.json`, todos *a validar*)
- Motor puro e testável: `src/engine/`
- Testes: `npm test` (Node ≥ 22)
- Validação: [`docs/validacao/protocolo.md`](docs/validacao/protocolo.md) · sensibilidade: `npm run sensibilidade` · Delphi: `npm run delphi`

**Estado:** protótipo de investigação. Os coeficientes do motor não estão validados; a robustez do ranking à sua incerteza é quantificada pela análise de sensibilidade.
