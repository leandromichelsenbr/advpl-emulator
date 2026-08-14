# AdvPL Emulator

Núcleo reutilizável para interpretar e emular componentes visuais clássicos do AdvPL sem depender de AppServer ou SmartClient. O primeiro componente implementado é a `MSDialog`.

## Executar a demonstração

Abra `index.html` em um navegador e pressione **Executar tela** ou `Ctrl+Enter`. Não há dependências nem etapa de compilação.

## Arquitetura atualizável

```text
Fonte AdvPL
    ↓
src/advpl-core.js      parser e semântica, sem dependência visual
    ↓
modelo neutro          diálogo, controles, variáveis e ações
    ↓
msdialog.js            renderizador HTML/CSS da demonstração
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

O projeto interpreta um subconjunto controlado de AdvPL e não executa código arbitrário. Ainda não estão implementados o pré-processamento real dos arquivos `.ch`, `VALID`, `WHEN`, máscaras `PICTURE`, fontes, recursos ou classes completas da LIB.

## Testes

```sh
npm test
```

Os testes protegem o contrato público do núcleo, a leitura de `MSGET`, as funções suportadas e a ordem das ações compostas.
