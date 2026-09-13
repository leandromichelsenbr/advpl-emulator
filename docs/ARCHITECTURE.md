# Arquitetura do AdvPL Emulator

## Objetivo e estado da decisão

O objetivo central é didático, funcional e visual: executar exemplos de interface e exercícios AdvPL no navegador, com lógica, estado, interação e resultados observáveis. A abrangência da linguagem e das APIs cresce conforme esses exemplos exigem.

Esta é a arquitetura-alvo consolidada em 08/09/2026. Binder, compiler, ISA e VM próprios são decisões de evolução, não uma descrição de componentes já entregues. O [README](../README.md#arquitetura-atual) descreve a implementação atual; a [matriz](compatibility-matrix.md) registra o suporte verificável.

## Fronteira canônica e modos de entrada

PPO é a representação textual canônica na fronteira de entrada do emulador. A decisão prática é aproveitar o pré-processador/toolchain AdvPL/TOTVS para resolver `#Include`, `#Define`, `#IfDef` e expansões de comandos e constantes dos headers. Isso reduz a complexidade que precisamos interpretar; não torna o PPO uma gramática universal independente de versão.

- **Modo principal planejado:** PRW + includes → pré-processador oficial → PPO → emulator.
- **Modo de desenvolvimento entregue em 0.20.0:** PPO previamente gerado → análise TDS opcional → executor leve → modelo/renderer. A entrada é preservada, com proveniência declarada não verificada. Não há compiler/ISA/VM próprios nesse caminho ainda; veja o [contrato e limites](integration.md#entrada-ppo-fornecida).

O pré-processamento oficial ocorre antes da fronteira do emulador. Sua integração e a forma de obter o PPO ainda precisam ser definidas e verificadas; esta decisão não afirma que a toolchain roda no navegador. Depois de produzido o PPO, a execução didática deve ser independente de AppServer, SmartClient e banco Protheus.

O pré-processador local atual mantém o contrato de [PPO didático parcial](integration.md#contrato-do-ppo-didático). Ele não passa a ser oficial nem equivalente ao PPO TOTVS por esta decisão. A justificativa e as consequências estão no [ADR 0001](adr/0001-ppo-como-fronteira-canonica.md).

## Pipeline-alvo

```text
PRW + includes + símbolos/opções do ambiente
    ↓ pré-processador oficial AdvPL/TOTVS (etapa externa)
PPO                              ← fronteira canônica
    ↓ lexer / parser
AST
    ↓ binder / análise semântica
AST vinculada / representação semântica
    ↓ compiler
ISA / bytecode próprios, stack-based
    ↓ VM
    ├── AdvPL Core Runtime
    ├── Protheus Compatibility / Simulation Layer
    └── UI Simulation Layer
             ↓ modelo neutro de saídas e eventos
        Web Renderer
```

As camadas de runtime e compatibilidade são serviços acessados pela VM; não são etapas sucessivas de compilação. A camada Protheus fica acima da VM, sem regras do ERP embutidas nas instruções. A UI Simulation Layer produz estado e eventos, e recebe as interações traduzidas pelo renderer para retomar callbacks e execução.

## Responsabilidades e contratos

| Camada | Responsabilidade | Limite |
|---|---|---|
| Pré-processador oficial | Resolver diretivas, includes e expansões antes de entregar PPO | Não faz parte do parser do emulador |
| Lexer / parser | Tokenizar PPO e construir AST com posições e diagnósticos sintáticos | Não executar código nem resolver APIs Protheus |
| Binder / análise semântica | Vincular nomes, declarações, escopos e chamadas; validar regras semânticas do subconjunto | Resolver o que for estático e representar explicitamente referências dinâmicas para o runtime |
| Compiler | Traduzir a representação semântica para instruções da ISA própria e preservar posições para trace | Não gerar APO nem criar DOM |
| VM | Executar instruções, pilha de operandos, frames, chamadas, desvios, suspensão/retomada e limites de execução | Não incorporar regras Protheus ou detalhes visuais |
| AdvPL Core Runtime | Implementar valores, tipos, coerções, arrays, escopos dinâmicos, code blocks e operações básicas da linguagem | Compartilhar a semântica entre lógica e callbacks; não simular ERP |
| Protheus Compatibility / Simulation Layer | Fornecer contratos de funções/classes, ambiente e dados necessários aos exercícios | Simular somente o comportamento documentado |
| UI Simulation Layer | Modelar controles, propriedades, eventos, ciclo modal e callbacks | Produzir modelo neutro sem dependência de DOM |
| Web Renderer | Apresentar o modelo e encaminhar ações do usuário à simulação | Não interpretar AdvPL nem decidir semântica da linguagem |

A AST representa o programa; o bytecode representa sua execução; o [modelo intermediário de saídas](intermediate-model.md) representa telas, mensagens, console e relatórios. São contratos distintos. O modelo atual `0.1` continua sendo referência de integração, e não deve ser renomeado ou tratado como ISA.

A ISA será própria e baseada em pilha (*stack-based*). Não reproduziremos o bytecode proprietário TOTVS nem carregaremos APO/RPO. O conjunto de instruções, sua codificação, versionamento e formato de depuração permanecem a especificar e testar.

## Compatibilidade inspirada no Wine

A analogia arquitetural com Wine consiste em implementar o comportamento/API observável necessário sobre o ambiente hospedeiro. Aqui, o recorte é o subconjunto didático AdvPL/Protheus no navegador. Isso não implica compatibilidade binária nem reprodução de AppServer, SmartClient, DBAccess, protocolos ou bytecode TOTVS.

Protheus, Work Areas, aliases, banco, `GetMv`, `xFilial` e funções/classes `FW*` serão simulados ou mocados conforme a necessidade didática. Os valores e efeitos devem ser explícitos, determinísticos e configuráveis por exercício. A resolução sintática de uma chamada não significa que sua API está implementada. A [política de compatibilidade](COMPATIBILITY.md) define as evidências necessárias.

## Evolução e questões abertas

A migração será incremental, preservando contratos públicos, exemplos e fluxo ordenado de eventos por testes de equivalência. A sequência de entregas está no [roadmap](ROADMAP.md); o [TODO](../TODO.md) mantém o inventário detalhado.

Permanecem abertos: ferramenta/versão e mecanismo de exportação do PPO; perfis de includes e símbolos; corpus inicial PRW/PPO; gramática efetivamente observada; contrato da AST vinculada; ISA e interface de chamadas ao runtime; proveniência PRW/includes/PPO para diagnósticos; formato dos exercícios e critérios automáticos de avaliação. A definição desses contratos deve preceder a migração dos respectivos caminhos de execução.
