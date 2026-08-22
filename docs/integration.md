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
