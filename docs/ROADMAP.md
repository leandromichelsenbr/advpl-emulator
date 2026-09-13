# Roadmap didático

## Direção e prioridade

O objetivo é tornar exemplos de interface e exercícios AdvPL executáveis, compreensíveis e visuais. Esta ordem, consolidada em 08/09/2026, substitui a sequência de expansão do pré-processador local descrita nos estudos anteriores. A [arquitetura](ARCHITECTURE.md) define as camadas; o [TODO](../TODO.md) continua como backlog detalhado, sem representar por si só a ordem de execução.

| Ordem | Etapa | Entrega e critério de avanço |
|---|---|---|
| 1 | Language Core | Caracterizar PPO real e consolidar lexer/parser, AST, binder, compiler, ISA própria baseada em pilha, VM e Core Runtime. Aceite: fixtures mínimas de expressões, escopos, controle de fluxo, funções e code blocks, com diagnósticos e limites verificáveis. |
| 2 | Visual Runtime | Ligar objetos, propriedades, callbacks, diálogos e mensagens ao núcleo e ao modelo neutro. Aceite: exemplo interativo abre, altera estado, suspende e retoma execução com efeitos na ordem esperada. |
| 3 | Playground | Integrar editor + preview + console/trace, seleção clara do modo de entrada e diagnósticos posicionados. Aceite: editar e repetir um exemplo mostra saída e passos coerentes, distinguindo PPO oficial de PPO didático. |
| 4 | Exercise Engine | Definir enunciado, fonte inicial, fixtures, resultados esperados, avaliação e reinicialização isolada. Aceite: exercício determinístico avalia lógica e interação e oferece feedback reproduzível. |
| 5 | Protheus Simulation | Introduzir ambiente e contratos de `GetMv`, `xFilial` e `FW*` motivados por exercícios. Aceite: mocks configuráveis com assinatura, retorno, efeitos e limitações documentados. |
| 6 | Data Simulation | Consolidar Work Areas, aliases e operações de banco sobre dados fictícios. Aceite: navegação e estado por execução comprovados por fixtures, sem exigir banco Protheus/DBAccess. |
| 7 | UI avançada | Ampliar grades, browses, validações, foco, teclado, layouts e fidelidade visual. Aceite: referências e regressões funcionais/visuais para cada componente ampliado. |

A ordem indica foco de investimento, não ausência de recursos atuais: editor, saídas visuais, callbacks, browses e tabelas JSON já existem em diferentes graus de cobertura. Eles devem ser preservados na migração. Uma etapa pode usar mocks mínimos das posteriores para viabilizar seu exemplo; isso não antecipa a simulação completa.

## Próximas entregas concretas

1. Selecionar pares mínimos PRW/PPO reais, com versão de toolchain/includes e resultados observados, seguindo a [política de fixtures](COMPATIBILITY.md#fixtures-prwppo).
2. **Parcialmente entregue em 0.20.0:** importar texto PPO por colagem/API, preservar seu conteúdo sem pré-processamento local e alcançar o modelo/renderer existente. O contrato distingue PPO fornecido de PPO didático; testes sintéticos cobrem análise, lógica, mensagem, diagnósticos e regressões. Ainda falta obter e caracterizar PPO oficial com proveniência reproduzível.
3. Especificar o subconjunto inicial da AST, binder e ISA; implementar uma fatia vertical de lógica e mensagem até o renderer, com testes de equivalência do contrato atual.
4. Migrar capacidades incrementalmente conforme os critérios da tabela, preservando os exemplos existentes.

O pré-processador local fica como caminho didático de transição. Reimplementar todo o universo de includes e regras TOTVS não é pré-requisito nem trilha principal. Não há prazo ou conclusão presumida para os novos componentes; o estado entregue continua na [matriz](compatibility-matrix.md).

## Incremento entregue — 0.20.0

Entrada PPO → análise TDS opcional → executor leve → console/mensagem → renderer. A escolha fecha a fronteira de entrada sem inventar expansões oficiais ou antecipar a VM. Seleção disponível nas duas páginas e nas APIs; diretivas residuais (inclusive #line) são bloqueadas. A primeira coleta de pares oficiais continua sendo a próxima dependência para definir a gramática/AST/ISA com evidência.
