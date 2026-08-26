# AdvPL Emulator

Núcleo reutilizável para interpretar e emular componentes visuais e relatórios clássicos do AdvPL sem depender de AppServer ou SmartClient.

## Executar a demonstração

Instale a dependência local e abra `index.html` em um navegador:

```sh
npm install
```

Pressione **Executar código** ou `Ctrl+Enter`. Não há etapa de compilação.

O laboratório público sem autenticação está em [`exercise.html`](exercise.html).

Os próximos componentes, calibrações visuais e evoluções do interpretador estão registrados no [TODO do projeto](TODO.md).

## Arquitetura atualizável

```text
Fonte AdvPL
    ↓
src/advpl-core.js      parser, execução controlada e diagnósticos
    ↓
modelo neutro          telas, mensagens, console, relatórios e ações
    ↓
msdialog.js            renderizador HTML/CSS de telas e relatórios
```

Sites de treinamento e plugins podem consumir somente `src/advpl-core.js` e criar seu próprio renderizador. Consulte [a documentação de integração](docs/integration.md).

Para incorporar apenas a saída visual em outra página, use o [modo headless](docs/integration.md#modo-headless-para-incorporação).

As saídas exibem discretamente a identificação do projeto, a marca Usina.BR e a versão do pacote em execução.

## Compatibilidade atual

- `DEFINE MSDIALOG` com `TITLE`, `FROM`, `TO` e `PIXEL`;
- `ACTIVATE MSDIALOG ... CENTERED`;
- controles `SAY`, `GET`, `MSGET`, `CHECKBOX` e `BUTTON`;
- cláusulas `VAR`, `PROMPT`, `SIZE` e `OF`;
- ligação direta de `MSGET` à variável informada;
- expressões com concatenação, soma, subtração, comparações e acesso a arrays aninhados;
- funções `Space()`, `AllTrim()`, `Abs()`, `cValToChar()`, `Chr()`, `Len()`, `ACopy()` e `AClone()`;
- constantes simples declaradas com `#DEFINE`, incluindo combinações como `CRLF`;
- declarações `Local` múltiplas, atribuição `+=`, `If`/`Else` e `For`/`To`/`Step`/`Next` no subconjunto executável;
- ações compostas sequenciais, como `(MsgInfo(...), oDlg:End())`;
- `ACTION MsgInfo(...)` e `ACTION oDlg:End()`.
- `MsgInfo()` e `MsgStop()` independentes, com título, conteúdo multilinha e filas modais;
- `ConOut()` com painel recolhível **Mostrar console**;
- fluxo ordenado de eventos para combinar `ConOut()` e mensagens no mesmo fonte sem antecipar saídas posteriores;
- eventos de diálogo que suspendem o fluxo em `ACTIVATE`, retomam após `oDlg:End()` e compartilham console e mensagens com callbacks;
- eventos de impressão que preservam mensagens e console antes/depois de `Setup()` e suspendem o fluxo durante `Preview()`;
- botão **Executar novamente** ao concluir mensagens ou encerrar um diálogo;
- diagnósticos de assinatura com código, severidade, linha, coluna e origem, incluindo suporte inicial ao `W0008`;
- construção orientada a objetos com `MSDialog():New()` e `oDlg:Activate()`;
- blocos de inicialização e validação com `MsgStop()`;
- `DEFINE DIALOG` e `TWBrowse():New()` com arrays, seleção e duplo clique;
- `TCBrowse():New()` com colunas, `bLine`, `bHeaderClick`, `bLDblClick` e botões `GoUp`, `GoDown`, `GoTop` e `GoBottom`;
- `BrGetDDB():New()` com alias, colunas `TCColumn`, seleção por célula e callbacks de edição/exclusão;
- base fictícia local com registros de exemplo para `SA1`, `SB1` e `SBM`, sem conexão externa;
- realce de sintaxe AdvPL no editor;
- `FWMSPrinter` com setup, preview, A4 retrato/paisagem e impressão pelo navegador;
- `TMSPrinter` com coordenadas legadas e tela de configuração própria;
- comandos de relatório `Say`, `SayAlign`, `Line`, `Box`, `FillRect` e `SayBitmap`;
- códigos `EAN13` e `QRCode` válidos e gerados localmente;
- orientação controlada por `SetPortrait()`, `SetLandscape()` ou pelo setup.

O projeto interpreta um subconjunto controlado de AdvPL e não executa código arbitrário. Consultas ao banco Protheus não são executadas; exemplos que dependem de dados externos precisam fornecer dados de referência. O suporte a `#DEFINE` é intencionalmente limitado e não equivale ao pré-processador completo dos arquivos `.ch`. Ainda não estão implementados `VALID`, `WHEN`, máscaras `PICTURE`, recursos ou classes completas da LIB.

Os diagnósticos identificados como `emulator-signatures` são aproximações locais e não substituem o compilador ou o linter oficial do TDS. A estratégia planejada para diagnósticos oficiais está no [TODO](TODO.md#interpretador).

## Testes

```sh
npm test
```

Os testes protegem o contrato público do núcleo, expressões e fluxo de execução, mensagens, console, componentes visuais, ações, relatórios, códigos de barras e orientação de página.

Veja também o [registro das implementações de 25 de agosto de 2026](docs/updates-2026-08-25.md).
