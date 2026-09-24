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
3. **Parcialmente entregue em 0.21.0:** AST experimental `0.1`, lexer mínimo, posições e binder de funções/parâmetros/locais sobre fixture PPO sintética.
4. **Primeira fatia executável entregue em 0.22.0:** compiler para ISA stack-based `0.1`, VM limitada e Core Runtime com `ConOut`/`cValToChar`. Um teste de equivalência comprova `PPO → AST → binder → bytecode → VM → console` contra o executor leve.
5. **Controle condicional entregue em 0.23.0:** AST aninhada para `If`/`Else`, comparações, saltos validados, expressão unária, `Abs` e `MsgInfo`. A equivalência comprova a mesma mensagem e seleção de ramo do executor leve. Atribuições e chamadas foram entregues no incremento seguinte; permanecem corpus oficial, laços, code blocks, suspensão e integração ao renderer.
6. **Frames de funções entregues em 0.24.0:** atribuições `:=`/`+=`, distinção entre runtime e funções declaradas, frames isolados, retorno e limite de profundidade. A equivalência cobre função auxiliar e atribuição composta. `For` foi entregue no incremento seguinte; permanecem corpus oficial, demais laços, code blocks, suspensão e integração ao renderer.
7. **Laço `For` entregue em 0.25.0:** início, limite e passo avaliados uma vez, passo padrão/negativo, laços aninhados e proteção de passo zero pelo limite global. A equivalência cobre a soma dos pares até 100.
8. Migrar capacidades incrementalmente conforme os critérios da tabela, preservando os exemplos existentes.

O pré-processador local fica como caminho didático de transição. Reimplementar todo o universo de includes e regras TOTVS não é pré-requisito nem trilha principal. Não há prazo ou conclusão presumida para os novos componentes; o estado entregue continua na [matriz](compatibility-matrix.md).

## Incremento entregue — 0.20.0

Entrada PPO → análise TDS opcional → executor leve → console/mensagem → renderer. A escolha fecha a fronteira de entrada sem inventar expansões oficiais ou antecipar a VM. Seleção disponível nas duas páginas e nas APIs; diretivas residuais (inclusive #line) são bloqueadas. A primeira coleta de pares oficiais continua sendo a próxima dependência para definir a gramática/AST/ISA com evidência.

## Incremento entregue — 0.22.0

PPO sintético → AST/binder `0.1` → compiler → bytecode stack-based `0.1` → VM limitada → Core Runtime → console. A fatia aceita literais, locais, aritmética, concatenação, comparações, chamadas permitidas e retorno; preserva posições e aplica limite de passos. Ela é um laboratório paralelo, não o pipeline do playground. O controle condicional que era a ampliação seguinte está registrado no incremento `0.23.0` abaixo.

## Incremento entregue — 0.23.0

O pipeline experimental passa a representar e executar `If`/`Else` com blocos aninhados, sinais unários e comparações relacionais. O compiler emite saltos absolutos, a VM valida cada destino e o Core Runtime acrescenta `Abs` e `MsgInfo`. O teste de equivalência compara a mensagem produzida pelo ramo selecionado com o executor leve. A ampliação então planejada de atribuições e funções está registrada no incremento `0.24.0` abaixo.

## Incremento entregue — 0.24.0

A AST passa a representar atribuições `:=` e `+=` a locais/parâmetros. O compiler diferencia serviços do Core Runtime de funções AdvPL declaradas e emite `CALL_FUNCTION`. A VM cria frames com slots e contador próprios, devolve valores ao chamador e limita profundidade recursiva. O `For` então planejado está registrado no incremento `0.25.0` abaixo; `While` permanece pendente.

## Incremento entregue — 0.25.0

`For`/`To`/`Step`/`Next` passa a integrar AST, binder e compiler. Limite e passo ocupam slots internos avaliados uma vez; o compiler seleciona a comparação conforme o sinal do passo e reutiliza saltos existentes. Há cobertura de passo padrão, negativo, zero e laços aninhados. A próxima ampliação é `While`/`EndDo`.
