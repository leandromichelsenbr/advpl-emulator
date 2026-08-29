# Dependências incorporadas

## `@totvs/tds-parsers` 0.1.5

- Publicador e mantenedor: TOTVS S.A.
- Origem: https://github.com/totvs/tds-parsers
- Licença declarada: Apache-2.0.
- A distribuição NPM contém `LICENSE` e não contém arquivo `NOTICE`.
- Versão fixada exatamente em `0.1.5`; atualizações exigem revisão de licença, corpus, tamanho do bundle e testes de equivalência.
- O bundle do navegador incorpora somente o analisador AdvPL e suas partes internas necessárias. O caminho de configuração dependente do módulo `path` do Node.js foi excluído da entrada para navegador.
- `pegjs`, `ts-pegjs` e `typescript` aparecem como dependências do pacote NPM, mas não são importados pelo bundle de execução gerado a partir dos arquivos já compilados.

O texto completo da licença acompanha a dependência instalada e está disponível no repositório de origem. Esta nota não altera nem substitui seus termos.
