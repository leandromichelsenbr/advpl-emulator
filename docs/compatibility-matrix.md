# Matriz de compatibilidade

Catálogo verificável das capacidades anunciadas pelo AdvPL Emulator. Esta matriz cobre a distribuição `0.12.0`, o perfil `protheus-default`, o contrato público `0.1` e o modelo intermediário `0.1`.

Os estados seguem o [direcionamento arquitetural](compatibility-layer-roadmap.md#matriz-de-compatibilidade):

| Estado | Leitura correta |
|---|---|
| `supported` | O subconjunto descrito possui teste funcional automatizado. |
| `partial` | A construção funciona somente no subconjunto e as lacunas estão declaradas. |
| `approximated` | A saída é uma equivalência didática, não uma reprodução integral do Protheus. |
| `recognized` | A construção é identificada, mas não é executada. |
| `unsupported` | A construção não é aceita; quando alcança o analisador, deve gerar diagnóstico explícito. |

`supported` nesta matriz nunca significa compatibilidade integral com AppServer, SmartClient, WebApp ou LIB. Significa somente que o contrato descrito na coluna **Cobertura atual** é protegido pelos testes indicados.

## Linguagem e runtime

| ID | Recurso | Estado | Cobertura atual | Lacunas conhecidas | Evidência |
|---|---|---|---|---|---|
| LNG-001 | Expressões | `partial` | Concatenação, soma e subtração, comparações e arrays aninhados. | Não é um avaliador completo de expressões AdvPL; coerções e operadores fora do subconjunto não são garantidos. | `core.test.js`: soma numérica, concatenação, `Space`/`AllTrim`. |
| LNG-002 | Funções escalares e de array | `partial` | `Space`, `AllTrim`, `StrTran`, `SubStr`, `Left`, `Right`, `Abs`, `cValToChar`, `Chr`, `Len`, `ACopy` e `AClone`; as extrações cobrem posição, extremos e limites. | Assinaturas, tipos e erros cobrem apenas os exemplos testados; posição zero de `SubStr` não integra o contrato garantido. | `core.test.js`: exemplos de `StrTran`, `SubStr`, `Left`, `Right`, `If/Else`, `ACopy`, `AClone` e expressões. |
| LNG-003 | Pré-processamento controlado | `partial` | `#define`, `#undef`, `#ifdef`, `#ifndef`, `#else`, `#endif`, expansão fora de strings/comentários, ciclos, diagnósticos e mapa de linhas. | Sem `#include`, macros com parâmetros, expressões em condicionais ou pré-processador completo de `.ch`. | `preprocessor.test.js` e mensagem multilinha com `CRLF` em `core.test.js`. |
| LNG-004 | Declarações e controle de fluxo | `partial` | `Local` múltiplo, `+=`, `If`/`Else` e `For`/`To`/`Step`/`Next`. | Demais declarações, escopos, laços, desvios e semântica completa não são suportados. | `core.test.js`: soma em `For`, `If/Else` e filas em `For`. |
| LNG-005 | Funções AdvPL | `partial` | Chamadas a `User Function` e `Static Function`, parâmetros, retorno e propagação ordenada de eventos. | Resolução de símbolos, escopos e formas de chamada fora dos casos testados não são garantidos. | `core.test.js`: função auxiliar, eventos e função não chamada. |
| LNG-006 | Ações e callbacks | `partial` | Sequências como `(MsgInfo(...), oDlg:End())`, `ACTION MsgInfo(...)` e `ACTION oDlg:End()`. | Codeblocks e expressões arbitrárias de callback não são executados. | `core.test.js`: ações compostas e callbacks com console. |
| LNG-007 | Construção OO de diálogo | `partial` | `MSDialog():New()` e `oDlg:Activate()` no padrão testado. | Sem modelo geral de classes, herança, mensagens e objetos AdvPL. | `core.test.js`: `MSDialog():New` e blocos de ativação. |
| LNG-008 | Parser TDS opcional | `partial` | Análise sintática assíncrona, normalização de erro e fallback automático para o parser leve. | O AST TDS ainda não substitui o executor leve; disponibilidade depende do bundle opcional. | `tds-parser-adapter.test.js` e `execution-pipeline.test.js`. |
| LNG-009 | Diagnósticos de assinatura | `approximated` | Código, severidade, linha, coluna e origem, incluindo suporte inicial a `W0008`. | Origem `emulator-signatures`; não equivale ao compilador ou linter oficial do TDS. | `core.test.js`: diagnóstico de assinatura. |

## Saídas, mensagens e editor

| ID | Recurso | Estado | Cobertura atual | Lacunas conhecidas | Evidência |
|---|---|---|---|---|---|
| OUT-001 | Mensagens | `partial` | `MsgInfo`, `MsgStop`, `MsgAlert` e `Alert`, títulos, ícones, multilinha e fila modal. | Confirmações e todos os estados visuais ainda não estão calibrados. | `core.test.js`: `MsgStop`, `MsgAlert`, `Alert`, `ACopy` e fila de mensagens. |
| OUT-002 | Console | `supported` | `ConOut()` gera saída ordenada; painel recolhível e abertura automática quando é a única saída. | O suporte se limita a texto no console do emulador. | `core.test.js`: console e ordem console/mensagem. |
| OUT-003 | Fluxo modal de diálogo | `partial` | `ACTIVATE` suspende a execução; `End()` retoma o fluxo e preserva console/mensagens de callbacks. | Ciclo de vida completo, fechamento nativo e concorrência do cliente não são reproduzidos. | `core.test.js`: ordem console/diálogo/continuação. |
| OUT-004 | Fluxo modal de impressão | `partial` | Eventos antes/depois de `Setup()` e suspensão durante `Preview()`. | Resultado modal, spool e dispositivos reais não são emulados. | `core.test.js`: ordem de preview e `Setup`. |
| OUT-005 | Executar novamente | `approximated` | A interface oferece nova execução após mensagem ou encerramento do diálogo. | É uma conveniência do laboratório, não uma API AdvPL. | Validação manual da interface `index.html`/`exercise.html`. |
| OUT-006 | Indentação automática | `supported` | `Enter`, `Tab` e `Shift+Tab` para os blocos documentados. | Não formata todo o dialeto nem substitui o editor TDS. | `core.test.js`: três testes de `Enter` e seleção com `Tab`. |
| OUT-007 | Realce de sintaxe | `approximated` | Destaque visual do subconjunto AdvPL no editor. | Gramática incompleta e sem equivalência com o editor TDS. | Validação manual da interface. |

## Diálogos, controles e browses

| ID | Recurso | Estado | Cobertura atual | Lacunas conhecidas | Evidência |
|---|---|---|---|---|---|
| UI-001 | `DEFINE MSDIALOG` | `partial` | `TITLE`, `FROM`, `TO`, `PIXEL` e `ACTIVATE ... CENTERED`. | Geometria, fontes, cores e ciclo de ativação ainda precisam de calibração por referência. | `core.test.js`: `MSDialog` e `MSGET`. |
| UI-002 | Controles básicos | `partial` | `SAY`, `GET`, `MSGET`, `CHECKBOX`, `BUTTON`; cláusulas `VAR`, `PROMPT`, `SIZE`, `OF`; ligação de `MSGET` à variável. | `PICTURE`, `VALID`, `WHEN`, estados desabilitados, foco e conjunto completo de propriedades não implementados. | `core.test.js`: diálogo básico; validação manual dos demais controles. |
| UI-003 | Blocos de inicialização/validação | `partial` | Blocos reconhecidos no padrão testado e `MsgStop()` como resultado. | Não implementa a semântica geral de `VALID`/`WHEN`. | `core.test.js`: mensagens e diálogo OO. |
| UI-004 | `DEFINE DIALOG` e `TWBrowse` | `partial` | Array, seleção e duplo clique. | Rolagem, teclado, foco, estilos e demais callbacks não calibrados. | `core.test.js`: `TWBrowse` com array e duplo clique. |
| UI-005 | `TCBrowse` | `partial` | Colunas, `bLine`, `bHeaderClick`, `bLDblClick`, `GoUp`, `GoDown`, `GoTop`, `GoBottom` e preservação de `Alert()` em callback. | Rolagem fiel, teclado, foco, freeze, edição e callbacks adicionais ausentes. | `core.test.js`: `TCBrowse`, eventos e navegação. |
| UI-006 | `BrGetDDB`/`TGetDados` | `partial` | Alias, `TCColumn`, seleção por célula e callbacks modelados de edição/exclusão. | Edição, exclusão e navegação são aproximações; comportamento completo de `TGetDados` ausente. | `core.test.js`: `BrGetDDB`, colunas e callbacks. |
| UI-007 | `AxCadastro` | `approximated` | Grid por alias, pesquisa, detalhes, inclusão, alteração, visualização, exclusão, ações, botões e callbacks transacionais. | Sem dicionário SX3 real, permissões, regras de negócio, transação ou persistência Protheus. | `core.test.js`: dados e callbacks de manutenção. |
| UI-008 | `FWMBrowse` | `approximated` | Alias, descrição, pesquisa, filtro, seleção, detalhes e dados JSON. | Sem metadados SX3, ordens, legendas, menus completos, impressão ou navegação lateral fiel. | `core.test.js`: browse com dados e alias ausente. |
| UI-009 | Base fictícia | `approximated` | Registros locais de exemplo para `SA1`, `SB1` e `SBM`, fornecidos pelo chamador. | Sem banco, RDD, índices, locks, transações ou consultas Protheus; nenhum registro é inventado para alias ausente. | `data/sample-data.js`; testes de `FWMBrowse` e `AxCadastro`. |

## Impressão e gráficos

| ID | Recurso | Estado | Cobertura atual | Lacunas conhecidas | Evidência |
|---|---|---|---|---|---|
| PRT-001 | `FWMSPrinter` | `partial` | `Setup`, `Preview`, A4 retrato/paisagem e impressão pelo navegador. | Sem spool, dispositivo Protheus, resultado modal fiel, multipágina completa ou PDF comparado por referência. | `core.test.js`: fluxo A4, setup, preview e paisagem. |
| PRT-002 | `TMSPrinter` | `approximated` | Coordenadas legadas e tela de configuração própria. | Conversões, DPI, margens e comportamento SmartClient ainda não calibrados. | `core.test.js`: impressora e gráficos legados. |
| PRT-003 | Primitivas de relatório | `partial` | `Say`, `SayAlign`, `Line`, `Box`, `FillRect` e `SayBitmap`. | Fontes, cores, espessuras, imagens, paginação e geometria não têm fidelidade integral. | `core.test.js`: comandos de relatório e gráficos legados. |
| PRT-004 | Códigos de barras | `partial` | Geração local válida de `EAN13` e `QRCode`. | Opções, dimensões e conjunto completo de simbologias não suportados. | `core.test.js`: `EAN13` e `QRCode`. |
| PRT-005 | Orientação | `supported` | `SetPortrait()`, `SetLandscape()` ou seleção no setup alteram a página A4 modelada. | O estado é suportado no modelo atual; fidelidade física depende da calibração de impressão. | `core.test.js`: A4, setup e `SetLandscape`. |

## Recursos explicitamente fora do contrato atual

| ID | Recurso | Estado | Comportamento esperado atual |
|---|---|---|---|
| UNS-001 | Consultas e banco Protheus | `unsupported` | Não são executados; os exemplos devem receber dados JSON de referência. |
| UNS-002 | Arquivos `.ch` | `recognized` | `#include` é identificado e ignorado com `PP0006`; o arquivo não é localizado nem carregado. |
| UNS-003 | `VALID`, `WHEN` e máscaras `PICTURE` | `unsupported` | Não são executados como contratos AdvPL; permanecem no backlog de controles. |
| UNS-004 | Recursos e classes completas da LIB | `unsupported` | Apenas as APIs inventariadas nesta matriz possuem comportamento emulado. |
| UNS-005 | Código AdvPL arbitrário e binários APO | `unsupported` | O emulador interpreta somente o subconjunto controlado; não carrega nem executa APO. |

## Rastreabilidade e manutenção

- O nome de cada teste acima corresponde a um caso em `test/core.test.js`, `test/execution-pipeline.test.js` ou `test/tds-parser-adapter.test.js`.
- Evidência “validação manual” identifica uma lacuna: o comportamento existe na interface, mas ainda precisa de teste automatizado ou visual.
- Uma capacidade nova deve entrar primeiro nesta matriz, com estado, limites e evidência.
- A promoção para `supported` exige contrato estreito, referência aplicável e teste funcional automatizado.
- Uma incompatibilidade conhecida não pode ficar implícita: deve aparecer em **Lacunas conhecidas** ou na seção de recursos fora do contrato.
