# Integração em páginas de treinamento

O núcleo não depende do DOM. Carregue-o antes do seu renderizador:

```html
<script src="/advpl-emulator/src/advpl-core.js"></script>
<script>
  const program = AdvPLCore.parse(source);
  console.log(program.kind, program.dialog, program.controls, program.variables);
</script>
```

A saída de `parse()` é um modelo neutro. A página pode renderizá-lo com HTML/CSS, React, Canvas ou uma biblioteca desktop.

## API 0.1

- `AdvPLCore.VERSION`: versão do contrato público;
- `AdvPLCore.API_VERSION`: linha compatível da API (`0.1`);
- `AdvPLCore.PACKAGE_VERSION`: versão atual da distribuição;
- `AdvPLCore.parse(source, options)`: transforma AdvPL em um modelo de diálogo, mensagem, console, relatório ou cadastro;
- `AdvPLCore.evaluate(expression, variables)`: avalia o subconjunto suportado;
- `AdvPLCore.parseAction(action)`: converte uma ação em comandos ordenados;
- `AdvPLCore.diagnose(source)`: retorna diagnósticos locais sem executar o fonte;
- `AdvPLCore.statements(source)`: aplica comentários e continuações com `;`;
- `AdvPLCore.splitTopLevel(expression, separator)`: separa expressões respeitando strings e parênteses.

O renderizador deve manter as variáveis da sessão, refletir alterações dos campos e executar os comandos retornados por `parseAction()` na ordem apresentada.

### Tipos de saída

O campo `kind` diferencia as saídas que não são diálogos:

- `message`: `message` contém a primeira modal e `messages` preserva toda a fila;
- `console`: `console` contém as linhas registradas por `ConOut()`;
- `report`: `report` contém página, orientação, elementos e dados do relatório.
- `axcadastro`: contém `alias`, `title`, `rows`, `columns`, `callbacks`, `additionalActions` e `customButtons` para uma manutenção interativa.

No modelo `axcadastro`, os registros são obtidos de `options.tables[alias]`. Os callbacks já são normalizados como listas de eventos de mensagem, permitindo que outro renderizador reproduza `bPre`, confirmação, exclusão e as fases da transação sem interpretar novamente os blocos de código.

Fontes executáveis também podem retornar `events`, uma lista ordenada preservando a sequência observável:

```js
[
  { type: "console", text: "Processando 1" },
  { type: "console", text: "Processando 2" },
  { type: "message", kind: "info", text: "Concluído", title: "TOTVS" },
  { type: "dialog" },
  { type: "report-create" },
  { type: "report-setup" },
  { type: "report-preview" }
]
```

O renderizador deve consumir a lista em ordem. Eventos de console podem continuar imediatamente; mensagens suspendem o avanço até a confirmação do usuário; `dialog` suspende em `ACTIVATE` e retoma após fechamento ou `oDlg:End()`. `report-setup` aguarda aceite/cancelamento e `report-preview` retoma somente após o fechamento do preview. Callbacks podem registrar console, abrir mensagens e encerrar o diálogo dentro da mesma sessão de variáveis. Os campos agregados `console`, `message` e `messages` permanecem disponíveis para compatibilidade.

Diálogos mantêm `dialog`, `controls` e `variables` para compatibilidade com a API 0.1.

### Diagnósticos

```js
const diagnostics = AdvPLCore.diagnose(source);
// [{ code, severity, message, line, column, origin, ... }]
```

Atualmente `origin: "emulator-signatures"` identifica advertências aproximadas pelo catálogo local, como `W0008`. Elas não devem ser apresentadas como resultado oficial do compilador TDS. A integração futura deverá manter origens distintas para permitir comparar ou priorizar os diagnósticos.

O arquivo `msdialog.js` aceita shells legados sem os elementos opcionais de realce de sintaxe e impressão. Para integrações novas, prefira consumir apenas `src/advpl-core.js` e manter um renderizador próprio.

## Modo headless para incorporação

Acrescente `?headless=1` ao endereço do emulador para mostrar somente a saída, sem editor, cabeçalho, botão ou barra de status:

```html
<iframe id="advplOutput" src="/emulator-frame.php?lang=pt&headless=1"></iframe>
```

Em páginas da mesma origem, envie o fonte quando o emulador informar que está pronto:

```js
const frame = document.getElementById("advplOutput");

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === "advpl-emulator:ready") {
    frame.contentWindow.postMessage({
      type: "advpl-emulator:run",
      source: codigoAdvPL
    }, window.location.origin);
  }
});
```

O frame responde com `advpl-emulator:rendered` ou `advpl-emulator:error`. Uma integração de mesma origem também pode chamar diretamente:

```js
frame.contentWindow.AdvPLEmulator.run(codigoAdvPL);
```

### Dados de exemplo na chamada

O segundo argumento de `run()` pode ser um objeto de tabelas, um objeto `{ tables: ... }` ou uma string JSON. Os aliases fornecidos substituem os conjuntos padrão somente naquela execução:

```js
const dados = {
  SA1: [
    { A1_COD: "900001", A1_LOJA: "01", A1_NOME: "CLIENTE DO EXERCÍCIO" },
    { A1_COD: "900002", A1_LOJA: "02", A1_NOME: "OUTRO CLIENTE" }
  ]
};

frame.contentWindow.AdvPLEmulator.run(codigoAdvPL, dados);
```

Para definir os dados das próximas execuções do frame:

```js
frame.contentWindow.AdvPLEmulator.setData(dados);
frame.contentWindow.AdvPLEmulator.run(codigoAdvPL);
```

No protocolo `postMessage`, envie a propriedade `data` junto do fonte:

```js
frame.contentWindow.postMessage({
  type: "advpl-emulator:run",
  source: codigoAdvPL,
  data: dados
}, window.location.origin);
```

O formato com uma raiz `tables` também é aceito:

```json
{
  "tables": {
    "SA1": [
      { "A1_COD": "900001", "A1_LOJA": "01", "A1_NOME": "CLIENTE DO EXERCÍCIO" }
    ]
  }
}
```

Para ativação programática sem parâmetro de URL, defina antes do carregamento de `msdialog.js`:

```js
window.ADVPL_EMULATOR_CONFIG = { headless: true, data: dados };
```
