# Integração em páginas de treinamento

O núcleo não depende do DOM. Carregue-o antes do seu renderizador:

```html
<script src="/advpl-emulator/src/advpl-core.js"></script>
<script>
  const program = AdvPLCore.parse(source);
  console.log(program.dialog, program.controls, program.variables);
</script>
```

A saída de `parse()` é um modelo neutro. A página pode renderizá-lo com HTML/CSS, React, Canvas ou uma biblioteca desktop.

## API 0.1

- `AdvPLCore.VERSION`: versão do contrato público;
- `AdvPLCore.API_VERSION`: linha compatível da API (`0.1`);
- `AdvPLCore.PACKAGE_VERSION`: versão atual da distribuição;
- `AdvPLCore.parse(source)`: transforma AdvPL no modelo de diálogo;
- `AdvPLCore.evaluate(expression, variables)`: avalia o subconjunto suportado;
- `AdvPLCore.parseAction(action)`: converte uma ação em comandos ordenados;
- `AdvPLCore.statements(source)`: aplica comentários e continuações com `;`;
- `AdvPLCore.splitTopLevel(expression, separator)`: separa expressões respeitando strings e parênteses.

O renderizador deve manter as variáveis da sessão, refletir alterações dos campos e executar os comandos retornados por `parseAction()` na ordem apresentada.

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

Para ativação programática sem parâmetro de URL, defina antes do carregamento de `msdialog.js`:

```js
window.ADVPL_EMULATOR_CONFIG = { headless: true };
```
