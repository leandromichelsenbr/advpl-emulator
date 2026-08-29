# Comentários didáticos nos fontes

Os módulos internos devem explicar decisões que não são evidentes pela leitura isolada do código. O objetivo é permitir que estudantes e colaboradores compreendam a arquitetura sem transformar cada linha em uma tradução para português.

## Comentar

- o propósito do módulo e sua posição no fluxo;
- contratos de entrada, saída e estados especiais;
- motivos de segurança, compatibilidade ou desempenho;
- estratégias de fallback e controle de concorrência;
- limitações conscientes e diferenças em relação ao AdvPL real;
- funções internas cujo nome não explica completamente o algoritmo.

## Evitar

- repetir literalmente a instrução seguinte;
- manter comentários que descrevem comportamento antigo;
- chamar um diagnóstico local de compilação oficial;
- esconder limitações importantes em comentários sem registrá-las também na documentação ou no backlog.

Comentários de contrato usam o formato `/** ... */`. Notas locais curtas usam `//`. Cada mudança funcional deve revisar os comentários próximos para evitar documentação divergente do comportamento.
