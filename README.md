# AdvPL Emulator

Protótipo de emulação dos componentes visuais clássicos do AdvPL. O primeiro componente implementado é a `MSDialog`, renderizada em HTML/CSS sem depender de AppServer ou SmartClient.

## Executar

Abra `index.html` em um navegador e pressione **Executar tela** (ou `Ctrl+Enter`). Não há dependências nem etapa de compilação.

## Escopo atual

- `DEFINE MSDIALOG` com `TITLE`, `FROM`, `TO` e `PIXEL`;
- `ACTIVATE MSDIALOG ... CENTERED`;
- controles `SAY`, `GET`, `CHECKBOX` e `BUTTON`;
- cláusulas `VAR`, `PROMPT`, `SIZE` e `OF`;
- atualização simples de variáveis ligadas a `GET` e `CHECKBOX`;
- `ACTION MsgInfo(...)` com concatenação simples;
- `ACTION oDlg:End()`.

O protótipo interpreta apenas um subconjunto controlado da sintaxe AdvPL. Ele não executa código arbitrário e ainda não implementa pré-processamento real dos arquivos `.ch`, `VALID`, `WHEN`, máscaras `PICTURE`, fontes, recursos ou classes da LIB.

## Direção do projeto

O objetivo é construir uma camada compatível com o comportamento observável dos componentes visuais AdvPL, mantendo o renderizador independente. Componentes e comportamentos adicionais serão incorporados progressivamente.
