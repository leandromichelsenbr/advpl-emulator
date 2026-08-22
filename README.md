# AdvPL Emulator

Núcleo reutilizável para interpretar e emular componentes visuais e relatórios clássicos do AdvPL sem depender de AppServer ou SmartClient.

## Executar a demonstração

Instale a dependência local e abra `index.html` em um navegador:

```sh
npm install
```

Pressione **Executar tela** ou `Ctrl+Enter`. Não há etapa de compilação.

## Arquitetura atualizável

```text
Fonte AdvPL
    ↓
src/advpl-core.js      parser e semântica, sem dependência visual
    ↓
modelo neutro          diálogo, controles, variáveis e ações
    ↓
msdialog.js            renderizador HTML/CSS de telas e relatórios
```

Sites de treinamento e plugins podem consumir somente `src/advpl-core.js` e criar seu próprio renderizador. Consulte [a documentação de integração](docs/integration.md).

## Compatibilidade atual

- `DEFINE MSDIALOG` com `TITLE`, `FROM`, `TO` e `PIXEL`;
- `ACTIVATE MSDIALOG ... CENTERED`;
- controles `SAY`, `GET`, `MSGET`, `CHECKBOX` e `BUTTON`;
- cláusulas `VAR`, `PROMPT`, `SIZE` e `OF`;
- ligação direta de `MSGET` à variável informada;
- expressões simples com concatenação, `Space()` e `AllTrim()`;
- ações compostas sequenciais, como `(MsgInfo(...), oDlg:End())`;
- `ACTION MsgInfo(...)` e `ACTION oDlg:End()`.
- construção orientada a objetos com `MSDialog():New()` e `oDlg:Activate()`;
- blocos de inicialização e validação com `MsgStop()`;
- `DEFINE DIALOG` e `TWBrowse():New()` com arrays, seleção e duplo clique;
- realce de sintaxe AdvPL no editor;
- `FWMSPrinter` com setup, preview, A4 retrato/paisagem e impressão pelo navegador;
- `TMSPrinter` com coordenadas legadas e tela de configuração própria;
- comandos de relatório `Say`, `SayAlign`, `Line`, `Box`, `FillRect` e `SayBitmap`;
- códigos `EAN13` e `QRCode` válidos e gerados localmente;
- orientação controlada por `SetPortrait()`, `SetLandscape()` ou pelo setup.

O projeto interpreta um subconjunto controlado de AdvPL e não executa código arbitrário. Consultas ao banco Protheus não são executadas; exemplos que dependem de dados externos precisam fornecer dados de referência. Ainda não estão implementados o pré-processamento real dos arquivos `.ch`, `VALID`, `WHEN`, máscaras `PICTURE`, recursos ou classes completas da LIB.

## Testes

```sh
npm test
```

Os testes protegem o contrato público do núcleo, componentes visuais, ações, relatórios, códigos de barras e orientação de página.
