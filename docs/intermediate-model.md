# Modelo intermediário 0.1

O modelo intermediário é o contrato entre o executor AdvPL e qualquer backend. Ele não contém elementos DOM e pode ser consumido por HTML/CSS, headless JSON, Canvas/SVG, PDF ou integrações futuras.

## Envelope comum

Toda execução bem-sucedida retornada pelas APIs públicas `parse()`, `parseReport()`, `parseAxCadastro()` e `parseFWMBrowse()` contém:

```json
{
  "modelVersion": "0.1",
  "outputType": "message | console | dialog | grid | report",
  "events": [],
  "controls": [],
  "diagnostics": [],
  "variables": {},
  "preprocessor": {}
}
```

| Campo | Contrato |
|---|---|
| `modelVersion` | Versão do formato, independente da versão do pacote e da API pública. |
| `outputType` | Família de saída que o backend deve renderizar. |
| `events` | Sequência modal e temporal observável. |
| `controls` | Controles de uma tela; vazio quando não aplicável. |
| `diagnostics` | Erros e advertências associados ao fonte. |
| `variables` | Estado calculado pelo subconjunto executável. |
| `preprocessor` | Fonte processado, definições, diagnósticos, mapa para o texto original e, desde a distribuição `0.9.0`, identificação `artifact` do PPO didático ou do fonte original no fallback legado. |

O campo aditivo `preprocessor.artifact` não altera `modelVersion`. Consulte o [contrato do PPO didático](integration.md#contrato-do-ppo-didático) para discriminação, limitações e resultados com erros.

As coleções comuns sempre existem. Um resultado inexistente continua sendo `null`; erros de interpretação continuam sendo exceções ou diagnósticos do pipeline e não são convertidos em uma falsa saída.

## Famílias de saída

| `outputType` | Payload específico | Origem atual |
|---|---|---|
| `message` | `message`, `messages`, `console` | `MsgInfo`, `MsgStop`, `MsgAlert`, `Alert` |
| `console` | `console` | `ConOut` sem outra saída visual |
| `dialog` | `dialog`, `controls` | `DEFINE DIALOG`, `DEFINE MSDIALOG`, `MSDialog():New()` |
| `grid` | `kind`, `rows`, `columns` e callbacks específicos | `AxCadastro`, `FWMBrowse` |
| `report` | `report`, `setup`, `confirmation` | `FWMSPrinter`, `TMSPrinter` |

O campo legado `kind` é preservado. Em grades, ele continua distinguindo `axcadastro` de `fwmbrowse`; `outputType: "grid"` permite que um backend selecione a família antes de tratar a variante.

## Eventos

O formato `0.1` reconhece:

- `message` — apresentar uma mensagem modal;
- `console` — acrescentar texto ao console;
- `dialog` — ativar o diálogo modelado;
- `report-create` — criar o contexto de impressão;
- `report-setup` — apresentar ou processar configuração;
- `report-preview` — apresentar a pré-visualização.

A ordem do array é semântica. Backends não devem antecipar eventos posteriores nem reordenar mensagens, console, diálogo e impressão.

## Uso

No navegador, carregue `src/advpl-model.js` antes de `src/advpl-core.js`. Em CommonJS, o núcleo carrega o módulo automaticamente.

```js
const program = AdvPLCore.parse(source, options);
const result = AdvPLCore.validateModel(program);
if (!result.valid) throw new Error(result.errors.join("; "));
```

O módulo também pode ser consumido diretamente:

```js
const model = require("./src/advpl-model.js");
const finalized = model.finalize(program);
const validation = model.validate(finalized);
```

## Evolução

- Campos opcionais podem ser acrescentados dentro da série `0.1`.
- Backends devem ignorar campos que não conheçam.
- Remoção, renomeação, mudança de significado ou mudança incompatível de tipo exige uma nova versão do modelo.
- A versão da distribuição pode avançar sem alterar `modelVersion`.
- Um novo tipo de saída ou evento deve ser documentado e coberto por teste de contrato antes de ser publicado.
