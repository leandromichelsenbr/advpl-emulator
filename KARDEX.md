# Kardex do AdvPL Emulator

Registro cronológico consolidado das movimentações do projeto. Para detalhes técnicos e itens futuros, consulte também o [histórico de implementação](docs/updates-2026-08-25.md) e o [backlog](TODO.md).

## Situação atual

| Campo | Situação |
|---|---|
| Versão da distribuição | `0.19.0` |
| Contrato público | `0.1` |
| Parser avançado | `@totvs/tds-parsers@0.1.5`, opcional |
| Parser de execução | núcleo leve com fallback |
| Testes automatizados | 103 |
| Branch de publicação | `main` |

## Movimentações

### 0.19.0 — 04/09/2026

**Tipo:** expressões, pontuação e segurança no motor de traduções.

- Padrões de `#translate`/`#xtranslate` passam a tokenizar pontuação estrutural, incluindo `->`, `:=`, `:`, `.`, delimitadores e operadores comuns.
- Marcadores capturam expressões respeitando parênteses, chaves, índices, strings e vírgulas internas.
- Diretivas físicas continuadas por `;` são remontadas, preservando uma linha no mapa do PPO para cada linha original.
- Regras reais `isNull()` e `DWGetProp()` de `DWDEFS.CH` foram carregadas e expandidas sem erros.
- Expansões podem ser encadeadas; `PP0020` bloqueia ciclos e `PP0021` limita o processamento a 64 passagens por linha.
- Versão do pacote elevada para `0.19.0`, pré-processador para `0.7` e suíte ampliada de 100 para 103 testes.

### 0.18.0 — 04/09/2026

**Tipo:** ampliação segura do motor de traduções.

- `#translate` e `#xtranslate` passam a aceitar sequências literais de palavras e marcadores que capturam um identificador.
- A regra real `BYREF <name> => <name>` de `APWEBSRV.CH` foi validada com o catálogo distribuído.
- Traduções compostas somente por palavras, como `BEGIN WSMETHOD`, também são reconhecidas e aplicadas.
- A captura não recorta membros e expressões com `->`, `:`, ou `.`, preservando o código até uma gramática apropriada.
- Strings e comentários continuam protegidos e regras mais específicas têm precedência pelo número de partes.
- Versão do pacote elevada para `0.18.0`, pré-processador para `0.6` e suíte ampliada de 97 para 100 testes.

### 0.17.0 — 04/09/2026

**Tipo:** traduções no PPO didático.

- Implementado o primeiro subconjunto de `#translate` e `#xtranslate`: chamadas como `ISNIL(<v1>)` e `ISNUMBER(<v1>)`.
- Argumentos respeitam parênteses, arrays, índices, strings e vírgulas internas; strings e comentários permanecem protegidos.
- Regras reais do `COMMON.CH` foram usadas como prova de integração com o catálogo distribuído.
- Adicionados `PP0017` (sintaxe fora do subconjunto) e `PP0018` (chamada sem fechamento); aridade diferente é tratada como padrão não correspondente.
- A capacidade `translations` passou de `recognized` para `partial`; opcionais, listas e comandos continuam explicitamente fora do recorte.
- Versão do pacote elevada para `0.17.0`, versão interna do pré-processador para `0.5` e suíte ampliada de 93 para 97 testes.

### 0.16.0 — 04/09/2026

**Tipo:** macros parametrizadas no PPO didático.

- `#define NOME(a,b) ...` passa a registrar parâmetros formais e expandir chamadas no fonte e nos headers virtuais.
- Scanner de argumentos preserva strings, arrays, chamadas e parênteses aninhados.
- Argumentos são pré-expandidos, permitindo chamadas aninhadas da mesma macro sem falso ciclo.
- Substituição ocorre somente em tokens, preservando strings, nomes maiores e literais/operadores `.T.`, `.F.`, `.AND.`, `.OR.` e `.NOT.`.
- Adicionados diagnósticos para aridade incorreta, chamada sem fechamento, parâmetros inválidos e ciclos.
- Corpus real valida `_DFSET(x,y)` de `STDWIN.CH`, incluindo expansão posterior de `_SET_DATEFORMAT`.
- Suíte ampliada de 89 para 93 testes automatizados.

### 0.15.0 — 04/09/2026

**Tipo:** catálogo educacional de headers Protheus.

- Incorporados 103 arquivos `.CH` do repositório `imsys/Protheus-Include`, fixados no commit `7b56abf` e acompanhados do README original e nota de procedência.
- Adicionado catálogo indexado e carregador que busca somente a árvore de includes usada pelo fonte.
- `runAsync()` passa a carregar automaticamente headers conhecidos; manifests explícitos continuam prioritários e o recurso pode ser desativado.
- Guardas vazias e comentários em macros passam a ser tratados corretamente.
- Regras `#command`/`#xcommand`/`#translate`/`#xtranslate` e macros parametrizadas em headers são reconhecidas com advertência, sem serem falsamente expandidas.
- O teste integrado confirma `TOTVS.CH → PROTHEUS.CH` e a expansão de `CLR_RED` sem erros bloqueantes.
- Suíte ampliada de 84 para 89 testes automatizados.

### 0.14.0 — 04/09/2026

**Tipo:** resolução controlada de includes virtuais.

- `#include` passa a expandir headers fornecidos explicitamente por manifesto, sem acessar disco ou rede.
- Includes aninhados compartilham macros e preservam proveniência por arquivo e linha no mapa do PPO.
- Adicionadas proteções para caminho absoluto/travessia, ciclo e profundidade máxima.
- Diagnósticos do parser executados sobre o PPO são remapeados ao arquivo virtual de origem.
- API headless aceita o manifesto em `options.preprocessor.includes` e na configuração do frame.
- Suíte ampliada de 80 para 84 testes automatizados.

### 0.13.0 — 03/09/2026

**Tipo:** observabilidade do pré-processador e pipeline.

- O PPO didático passa a declarar `capabilities`, distinguindo suporte, reconhecimento e ausência de cada família de transformação.
- Cada execução informa em `applied` somente as transformações realmente utilizadas no fonte.
- Adicionado painel recolhível **Fonte × PPO didático**, com comparação lado a lado e resumo de capacidades.
- O fallback legado declara capacidades vazias e nenhuma transformação, sem fingir pré-processamento.
- Suíte ampliada de 78 para 80 testes automatizados.

### 0.12.0 — 03/09/2026

**Tipo:** novas funções de compatibilidade de strings.

- Implementados `Left(cString, nCaracteres)` e `Right(cString, nCaracteres)` sobre uma regra comum de extração.
- Quantidades maiores que o texto devolvem o conteúdo completo; zero e valores negativos devolvem texto vazio.
- Quantidades fracionárias são truncadas antes da extração, preservando um resultado determinístico no subconjunto.
- Adicionados diagnóstico aproximado `W0008`, realce de sintaxe, exemplo combinado e registro na matriz de compatibilidade.
- Suíte ampliada de 72 para 78 testes automatizados.

### 0.11.0 — 03/09/2026

**Tipo:** nova função de compatibilidade de strings.

- Implementado `SubStr(cString, nPosInicial, nCaracteres)` no avaliador seguro.
- Suportados índice AdvPL baseado em 1, quantidade opcional e posição negativa contada a partir do fim.
- Tratadas posições fora do texto e quantidades não positivas com retorno vazio; posição zero permanece fora do contrato garantido.
- Adicionados diagnóstico aproximado `W0008`, realce de sintaxe, exemplos didáticos e registro na matriz de compatibilidade.
- Suíte ampliada de 66 para 72 testes automatizados.

### 0.10.0 — 03/09/2026

**Tipo:** nova função de compatibilidade de strings.

- Implementado `StrTran(cString, cSearch, cReplace, nStart, nCount)` no avaliador seguro.
- Cobertos os três exemplos publicados pela Usina.BR: documento, separador importado e telefone.
- Suportadas substituição omitida, primeira ocorrência, limite de trocas e comparação case-sensitive.
- Adicionado realce de sintaxe para `StrTran()` e atualizado o catálogo de compatibilidade.
- Suíte ampliada de 60 para 66 testes automatizados.

### 0.9.0 — 03/09/2026

**Tipo:** contrato aditivo do PPO didático (P0 do estudo).

- Identificada a saída do pré-processador com `artifact.kind`, `label` e `compatibility`, sem alegar compatibilidade integral com a TOTVS.
- Diferenciado o fallback legado como fonte original sem pré-processamento.
- Mantidos os contratos públicos `0.1` e o texto gerado, sem alteração de semântica.
- Documentado o consumo pelo núcleo/modelo e pela análise do pipeline, inclusive quando há erros.
- Acrescentados três testes de contrato, isolamento e propagação; ampliada a cobertura do fallback legado. Suíte com 60 testes.
- Painel visual, `capabilities`, includes e regras de tradução continuam pendentes.

### 0.8.4 — 31/08/2026

**Tipo:** correção de compatibilidade de integração.

- Restaurado o carregamento isolado de `advpl-core.js` usado por páginas de treinamento anteriores à arquitetura modular.
- Adicionados fallbacks de modelo e pré-processamento legado quando os módulos completos não estão presentes no navegador.
- Mantido o uso preferencial de `advpl-model.js` e `advpl-preprocessor.js` nas integrações atualizadas.
- Criado teste em contexto de navegador sem dependências, reproduzindo a integração real do site Usina BR.
- Suíte ampliada de 56 para 57 testes automatizados.

### 0.8.3 — 31/08/2026

**Tipo:** documentação didática dos fontes.

- Elevado o padrão de comentários: módulos internos passam a servir também como material de estudo.
- Documentados envelope e união discriminada no modelo intermediário.
- Explicados scanner de estados, pilha condicional, tabela de símbolos, mapa de origem e detecção de ciclos no pré-processador.
- Detalhados injeção de dependências, fronteira de efeitos, revisões concorrentes e deduplicação de diagnósticos no pipeline.
- Mantida a suíte de 56 testes automatizados.

### 0.8.2 — 31/08/2026

**Tipo:** correção de diagnósticos do pipeline.

- Eliminada a duplicação de diagnósticos presentes simultaneamente no núcleo e na análise assíncrona.
- A advertência `PP0006` de `#include` passa a aparecer uma única vez na interface.
- Mantida a suíte de 56 testes automatizados.

### 0.8.1 — 31/08/2026

**Tipo:** compatibilidade de fontes com includes.

- `#include` passa a ser reconhecido e ignorado com advertência `PP0006`, sem fingir que o arquivo `.ch` foi carregado.
- Restaurada a execução dos exemplos existentes que declaram `TOTVS.CH`.
- Suíte ampliada de 55 para 56 testes automatizados.

### 0.8.0 — 31/08/2026

**Tipo:** pré-processador mínimo observável.

- Criado pré-processador independente do DOM com contrato próprio `0.1`.
- Implementados `#define`, `#undef`, `#ifdef`, `#ifndef`, `#else` e `#endif`, incluindo aninhamento.
- Expansão de tokens passa a preservar strings, comentários de linha e comentários de bloco.
- Adicionados diagnósticos de diretivas, redefinições, blocos não encerrados e ciclos de macros.
- Gerado mapa de linhas entre o fonte processado e o original.
- O pipeline assíncrono passa a pré-processar antes da análise TDS e bloqueia execução quando há erro nessa fase.
- Suíte ampliada de 49 para 55 testes automatizados, mantendo os contratos públicos `0.1`.

### 0.7.0 — 31/08/2026

**Tipo:** contrato do modelo intermediário.

- Versionado como `0.1` o envelope comum das saídas do emulador.
- Unificados os discriminadores `message`, `console`, `dialog`, `grid` e `report` sem remover os payloads existentes.
- Normalizadas as coleções `events`, `controls`, `diagnostics` e `variables` para todos os resultados bem-sucedidos.
- Criado módulo independente do DOM para finalizar e validar modelos consumidos por backends.
- Documentados os payloads específicos, eventos, compatibilidade e política de evolução do formato.
- Suíte ampliada de 47 para 49 testes automatizados, mantendo o contrato público `0.1`.

### 0.6.0 — 31/08/2026

**Tipo:** fundação do catálogo de compatibilidade.

- Publicada a matriz inicial de compatibilidade, cobrindo todas as capacidades anunciadas no README.
- Classificados linguagem, runtime, saídas, editor, diálogos, browses, dados e impressão nos cinco estados arquiteturais.
- Ligadas as capacidades aos testes existentes e declaradas as lacunas que ainda dependem de testes visuais ou calibração.
- Separados explicitamente os recursos fora do contrato atual, incluindo banco Protheus, `.ch`, `VALID`, `WHEN`, `PICTURE`, LIB completa e binários APO.
- Adicionado contrato automatizado para IDs únicos, estados válidos e campos obrigatórios da matriz.
- Suíte ampliada de 46 para 47 testes automatizados, mantendo o contrato público `0.1`.

### 0.5.3 — 31/08/2026

**Tipo:** direcionamento arquitetural e planejamento.

- Formalizado o AdvPL Emulator como camada de compatibilidade educacional e visual AdvPL/Protheus para Web.
- Documentados os limites da analogia com o Wine, evitando promessas de compatibilidade binária ou substituição da infraestrutura Protheus.
- Planejadas oito camadas: contexto, pré-processador, parser, AST neutra, runtime, bibliotecas de compatibilidade, modelo de saídas e backends.
- Criados estados verificáveis de compatibilidade e oito marcos incrementais com critérios de aceite.
- Priorizados a matriz de compatibilidade, o modelo intermediário e o pré-processador mínimo observável.
- Mantidos o contrato público `0.1` e os 46 testes automatizados.

### 0.5.2 — 30/08/2026

**Tipo:** correção do executor e aprimoramento do console.

- Corrigido `+=` para somar operandos numéricos e concatenar somente quando houver texto.
- Validada a soma dos pares de 0 a 100 com resultado `2550`, preservando os exemplos textuais existentes.
- O console exclusivo passa a ocupar toda a área de saída, sem exibir um estado vazio concorrente.
- Suíte ampliada de 44 para 46 testes automatizados.

### 0.5.1 — 30/08/2026

**Tipo:** experiência da saída de console.

- O console passa a abrir automaticamente quando `ConOut()` é a única saída observável da execução.
- Fluxos que também produzem mensagem, diálogo ou relatório mantêm o console recolhível para preservar a área visual.
- Mantidos o contrato público `0.1` e os 44 testes automatizados.

### 0.5.0 — 30/08/2026

**Tipo:** novo componente visual e dados fictícios.

- Adicionado reconhecimento de `FWMBrowse():New()`, `SetAlias()`, `SetDescription()` e `Activate()`.
- Criado modelo neutro `fwmbrowse`, alimentado somente pelas tabelas JSON da execução.
- Reproduzida a estrutura observada no WebApp: janela sem moldura, título, pesquisa, filtro, `wa-tgrid`, seleção e detalhes recolhíveis.
- Mantidas fora desta etapa as rotinas e metadados não declarados no fonte, evitando inventar comportamentos do Protheus.
- Suíte ampliada de 42 para 44 testes automatizados.

### 0.4.1 — 30/08/2026

**Tipo:** documentação, governança e referências visuais.

- Criado este Kardex como registro oficial das versões e entregas.
- Incorporadas ao histórico as imagens atualizadas de `AxCadastro` e `FWMSPrinter` do [PR #37](https://github.com/leandromichelsenbr/advpl-emulator/pull/37).
- Regularizado o incremento de versão posterior à atualização dos exemplos.
- Mantidos o contrato público `0.1` e os 42 testes automatizados.

### 0.4.0 — 29/08/2026

**Tipo:** funcionalidade do editor.

- Adicionada indentação automática para funções, condicionais, laços, ramificações, diálogos e continuações por `;`.
- `Tab` e `Shift+Tab` passaram a indentar ou recuar linhas e seleções.
- Preservado o atalho `Ctrl+Enter` para execução.
- Entrega: [PR #36](https://github.com/leandromichelsenbr/advpl-emulator/pull/36).

### 0.3.2 — 29/08/2026

**Tipo:** documentação interna.

- Iniciado o padrão de comentários didáticos nos módulos internos.
- Documentados propósito, contratos, fallback, concorrência, segurança e limitações do parser.
- Criado o guia de comentários dos fontes.
- Entrega: [PR #35](https://github.com/leandromichelsenbr/advpl-emulator/pull/35).

### 0.3.1 — 29/08/2026

**Tipo:** execução e segurança.

- Criado `AdvPLEmulator.runAsync()`.
- A análise sintática passou a ocorrer antes da execução visual.
- Erros TDS passaram a impedir mensagens, diálogos e relatórios.
- Adicionado descarte de resultados antigos e protocolo headless assíncrono.
- Entrega: [PR #34](https://github.com/leandromichelsenbr/advpl-emulator/pull/34).

### 0.3.0 — 29/08/2026

**Tipo:** arquitetura do interpretador.

- Adotado `@totvs/tds-parsers@0.1.5` como camada opcional.
- Criados adaptador neutro, bundle sob demanda e Web Worker.
- Implementados os modos `light`, `tds` e `auto`.
- Normalizados AST, diagnósticos, duração e fallback.
- Entrega: [PR #33](https://github.com/leandromichelsenbr/advpl-emulator/pull/33).

### 0.2.1 — 29/08/2026

**Tipo:** correções de mensagens e versionamento.

- Implementado `Alert()` crítico e sua execução em callbacks do `TCBrowse`.
- Corrigidos ícones de mensagens abertas por callbacks em páginas incorporadas.
- Formalizada a política de versionamento semântico.
- Entregas: [PR #29](https://github.com/leandromichelsenbr/advpl-emulator/pull/29), [PR #30](https://github.com/leandromichelsenbr/advpl-emulator/pull/30), [PR #31](https://github.com/leandromichelsenbr/advpl-emulator/pull/31) e [PR #32](https://github.com/leandromichelsenbr/advpl-emulator/pull/32).

### 0.2.0 — 22 a 28/08/2026

**Tipo:** expansão funcional.

- Incorporados componentes visuais, impressão, relatórios e orientação de página.
- Criados laboratório público, modo headless e compatibilidade com incorporação.
- Adicionados dados fictícios e JSON por execução.
- Implementados `BrGetDDB`, `TCBrowse`, `AxCadastro`, mensagens, console, `ACopy`, `AClone` e chamadas entre funções.
- Unificados eventos de console, mensagens, diálogos e relatórios.
- Adicionados branding, versão visível, inventário DANFE e backlog do parser TDS.
- Período coberto pelos [PRs #2 a #28](https://github.com/leandromichelsenbr/advpl-emulator/pulls?q=is%3Apr+is%3Amerged+2..28).

### 0.1.0 — 14/08/2026

**Tipo:** fundação.

- Criado o primeiro emulador visual AdvPL.
- Separado o núcleo reutilizável da apresentação HTML.
- Definido o contrato público inicial `0.1`.
- Entrega-base: [PR #1](https://github.com/leandromichelsenbr/advpl-emulator/pull/1).

## Regra de atualização

Toda entrega publicada deve:

1. incrementar a versão semântica da distribuição;
2. sincronizar `package.json`, `package-lock.json` e `AdvPLCore.PACKAGE_VERSION`;
3. atualizar os parâmetros de invalidação de cache das páginas;
4. registrar aqui data, tipo, resumo, validação e referência da entrega;
5. preservar versões anteriores, sem reescrever retroativamente seus resultados.
