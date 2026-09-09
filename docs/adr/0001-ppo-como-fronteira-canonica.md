# ADR 0001 — PPO como fronteira canônica

- **Estado:** aceito como direção arquitetural; implementação incremental pendente.
- **Data:** 08/09/2026.
- **Escopo:** entrada e compilação do AdvPL Emulator.

## Contexto

O produto é um ambiente didático, funcional e visual para exemplos de interface e exercícios AdvPL. Interpretar PRW junto com todo o universo de includes, diretivas e regras da LIB amplia o trabalho antes de chegar à lógica e à interação que queremos ensinar. O projeto já possui um pré-processador local parcial, identificado como PPO didático, com includes virtuais, catálogo educacional, macros parametrizadas e um subconjunto de traduções. Essas capacidades não equivalem à toolchain oficial.

## Decisão

Adotar o PPO textual produzido pelo pré-processador/toolchain AdvPL/TOTVS como representação canônica na fronteira do emulador. `#Include`, `#Define`, `#IfDef` e expansões dependentes dos headers são resolvidos antes dessa fronteira. A escolha é prática: reutilizar um processamento consolidado e reduzir as formas de entrada a interpretar.

O modo principal planejado é PRW + includes → pré-processador oficial → PPO → emulator. O modo de desenvolvimento recebe PPO previamente gerado diretamente. O mecanismo de obtenção e integração da ferramenta oficial ainda será escolhido e validado.

O PPO passa por lexer/parser, AST, binder/análise semântica e compiler para ISA/bytecode próprios **stack-based**, executados pela VM do projeto. Não reproduzir bytecode proprietário TOTVS, APO/RPO ou a máquina virtual do AppServer. A analogia com Wine orienta a implementação de comportamento/API observável necessário, com runtime e simulações acima da VM.

## Alternativas e consequências

- **Reimplementar todo o pré-processamento no navegador:** não escolhido como direção principal, pelo custo de reproduzir e manter includes e expansões. O módulo local atual permanece um caminho didático parcial de transição.
- **Executar bytecode TOTVS:** descartado; compatibilidade binária não atende ao recorte do produto e não é requisito para a experiência didática.
- **PPO oficial como entrada:** escolhido. Diminui a complexidade de pré-processamento interna, mas exige acesso à toolchain para gerar novos artefatos e caracterização por versão/perfil. PPO não elimina a necessidade de parser, semântica, runtime e simulação das APIs chamadas.

O desenvolvimento do núcleo pode usar fixtures PPO existentes sem depender da ferramenta a cada execução. A execução no navegador continua isolada da infraestrutura Protheus após a preparação do artefato. Não se presume redistribuição de headers nem equivalência entre a saída local atual e a oficial.

## Validação e acompanhamento

A [política de compatibilidade](../COMPATIBILITY.md) exige pares PRW/PPO reais e evidência empírica das expansões. A [arquitetura](../ARCHITECTURE.md) define responsabilidades e contratos; o [roadmap](../ROADMAP.md) determina a prioridade didática. Permanecem abertos o mecanismo de geração/importação, perfis da toolchain, proveniência dos diagnósticos e especificação inicial da ISA.

Esta decisão substitui a proposta de ampliar o pré-processador local como caminho arquitetural principal nos estudos [de compatibilidade](../compatibility-layer-roadmap.md) e [de PPO](../ppo-e-pipeline-advpl.md), preservados como histórico. Não altera por si só APIs ou capacidades da distribuição atual.
