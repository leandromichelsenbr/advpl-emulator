# Política de compatibilidade

## Escopo

A compatibilidade é orientada pelos exemplos de interface e exercícios AdvPL, com lógica, estado, retornos e efeitos observáveis. A [arquitetura](ARCHITECTURE.md) estabelece PPO como fronteira canônica e ISA própria; isso não declara suporte integral à linguagem, à LIB ou a aplicações Protheus.

A [matriz de compatibilidade](compatibility-matrix.md) é o catálogo único do suporte atual e mantém os estados `supported`, `partial`, `approximated`, `recognized` e `unsupported`, com cobertura, lacunas e evidências. Este documento define a política de evolução, sem duplicar as linhas do catálogo. Testes locais aprovados não comprovam, isoladamente, equivalência com a plataforma original.

## Fixtures PRW/PPO

A compatibilidade futura deve partir de pares PRW/PPO reais obtidos com a toolchain oficial e de observação empírica do PPO. Não presumir que `DEFINE`, comandos visuais, macros ou outra sintaxe do PRW sobrevivam à expansão, nem inventar chamadas expandidas para fundamentar suporte.

Cada caso de caracterização deve registrar:

- PRW mínimo e PPO correspondente, com origem autorizada e dados fictícios;
- ferramenta e versão, perfil/versão dos includes, símbolos e opções usados, além do procedimento de geração;
- construção investigada e trecho efetivamente observado no PPO;
- comportamento esperado: retorno, variáveis relevantes, console, eventos, estado visual e interações, conforme aplicável;
- referência da execução real quando disponível, teste associado e divergências conhecidas;
- posições no PPO e relação com PRW/includes quando houver mapa confiável; sem mapa, apresentar a posição no PPO sem inventar correspondência.

O corpus inicial deve separar lógica básica, chamadas, arrays/code blocks, condicionais de pré-processamento, expansões de comandos, mensagens e um diálogo interativo. Casos sintéticos ajudam a testar unidades, mas devem ser identificados como tais e não substituem evidência de PPO oficial. Fixtures reais ainda precisam ser selecionadas; esta documentação não certifica um corpus já coletado.

## Validação por fronteira

| Fronteira | Evidência esperada |
|---|---|
| PRW/includes → PPO | Artefato oficial e contexto reproduzível; registrar variações entre perfis, sem exigir que o pré-processador didático replique toda a toolchain |
| PPO → AST/binder | Estrutura e vínculos esperados, diagnósticos de construções fora do subconjunto e posições corretas |
| Compiler/ISA/VM/Core Runtime | Retornos, estado, chamadas, fluxo, erros e limites observáveis em fixtures; bytecode próprio não é comparado ao TOTVS |
| Simulação Protheus/dados/UI | Contratos, efeitos e interações necessários ao exercício, com diferenças explícitas da referência |
| Modelo → renderer | Ordem de eventos, comportamento funcional e comparações visuais quando pertinentes |

Aceitar PPO sintaticamente não garante execução; reconhecer uma função não garante que exista uma implementação compatível. Novas capacidades precisam de teste e lacunas na matriz antes de serem anunciadas no README. Evidências empíricas e aproximações didáticas devem permanecer distinguíveis.

## Ambiente simulado e limites

Work Areas, aliases e banco são estado simulado sobre fixtures. `GetMv`, `xFilial` e `FW*` recebem implementações ou mocks limitados ao cenário didático, com assinatura, parâmetros, retorno, efeitos, valores configurados e limitações documentados. Um mock não deve passar silenciosamente por uma implementação integral; dependências ausentes precisam de diagnóstico explícito no contrato planejado.

Não há compromisso de reproduzir AppServer, SmartClient, DBAccess, ERP completo, bytecode TOTVS ou APO/RPO. O contrato atual de [PPO didático](integration.md#contrato-do-ppo-didático) continua parcial; o uso futuro de PPO oficial não promove automaticamente os recursos existentes a compatibilidade oficial.
