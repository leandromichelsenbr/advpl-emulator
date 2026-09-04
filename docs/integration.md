# Integração em páginas de treinamento

O núcleo não depende do DOM. No navegador, carregue o modelo e o pré-processador antes do núcleo e do seu renderizador:

```html
<script src="/advpl-emulator/src/advpl-model.js"></script>
<script src="/advpl-emulator/src/advpl-preprocessor.js"></script>
<script src="/advpl-emulator/src/advpl-core.js"></script>
<script>
  const program = AdvPLCore.parse(source);
  console.log(program.kind, program.dialog, program.controls, program.variables);
</script>
```

Integrações antigas que carregam somente `advpl-core.js` continuam operacionais em modo de compatibilidade. Nesse modo, o executor preserva o comportamento anterior, mas não oferece as diretivas condicionais do pré-processador completo. Para novos projetos, carregue sempre os três módulos na ordem acima.

A saída de `parse()` é um modelo neutro. A página pode renderizá-lo com HTML/CSS, React, Canvas ou uma biblioteca desktop.

O contrato continuará evoluindo dentro da arquitetura de camada de compatibilidade descrita no [direcionamento do projeto](compatibility-layer-roadmap.md). Pré-processador, runtime, bibliotecas Protheus e backends devem permanecer separados para que integrações headless não dependam do renderizador HTML.

## API 0.1

- `AdvPLCore.VERSION`: versão do contrato público;
- `AdvPLCore.API_VERSION`: linha compatível da API (`0.1`);
- `AdvPLCore.PACKAGE_VERSION`: versão atual da distribuição;
- `AdvPLCore.MODEL_VERSION`: versão do modelo intermediário (`0.1`);
- `AdvPLCore.parse(source, options)`: transforma AdvPL em um modelo de diálogo, mensagem, console, relatório ou cadastro;
- `AdvPLCore.preprocess(source, options)`: processa diretivas e retorna identificação do artefato, fonte, definições, diagnósticos e mapa de origem;
- `AdvPLCore.validateModel(program)`: valida o envelope intermediário produzido pelo núcleo;
- `AdvPLCore.evaluate(expression, variables)`: avalia o subconjunto suportado;
- `AdvPLCore.parseAction(action)`: converte uma ação em comandos ordenados;
- `AdvPLCore.diagnose(source)`: retorna diagnósticos locais sem executar o fonte;
- `AdvPLCore.statements(source)`: aplica comentários e continuações com `;`;
- `AdvPLCore.splitTopLevel(expression, separator)`: separa expressões respeitando strings e parênteses.
- `AdvPLCore.editorNewline(source, start, end)`: calcula a quebra de linha e indentação AdvPL sem depender do DOM;
- `AdvPLCore.editorTab(source, start, end, outdent)`: indenta ou recua a linha/seleção.
- `AdvPLParserAdapter.analyze(source, options)`: executa análise sintática opcional em Web Worker e retorna AST, diagnósticos, duração e informação de fallback.
- `AdvPLEmulator.runAsync(source, data, options)`: analisa, aguarda o parser e só então executa o código quando não houver erro sintático.

O renderizador deve manter as variáveis da sessão, refletir alterações dos campos e executar os comandos retornados por `parseAction()` na ordem apresentada.

### Contrato do PPO didático

A partir da distribuição `0.9.0`, o resultado de `preprocess()` acrescenta `artifact` ao contrato `0.1`, sem renomear campos existentes:

```js
const result = AdvPLCore.preprocess('#define VALOR 42\nConOut(VALOR)');
// result.artifact:
// { kind: "didactic-ppo",
//   label: "PPO didático — subconjunto do emulador",
//   compatibility: "partial" }
// result.source: '\nConOut(42)'
// result.capabilities.objectMacros: "supported"
// result.applied: ["object-macro-definition", "object-macro-expansion"]
```

`kind` é o discriminador para integrações; `label` é o rótulo destinado à apresentação; `compatibility` descreve o alcance da etapa de pré-processamento, não a validade daquele programa nem a compatibilidade do runtime. `partial` significa apenas o subconjunto documentado: não certifica equivalência com o PPO TOTVS. Includes ausentes geram advertência, e regras de comando/tradução ainda não são implementadas.

### Includes virtuais por execução

Na distribuição `0.14.0`, headers podem ser fornecidos por um manifesto em memória. O pré-processador nunca lê o sistema de arquivos nem a rede:

```js
const preprocessor = {
  filename: "exemplo.prw",
  maxIncludeDepth: 16,
  includes: {
    "TOTVS.CH": '#include "CORES.CH"\n#define TITULO "Usina.BR"',
    "CORES.CH": "#define CLR_DESTAQUE 16711680"
  }
};

const result = await AdvPLEmulator.runAsync(source, dados, { preprocessor });
```

O mesmo objeto pode ser enviado em `options.preprocessor` pelo protocolo `postMessage`, ou definido para todas as execuções do frame:

```js
window.ADVPL_EMULATOR_CONFIG = {
  headless: true,
  preprocessor: { filename: "exercicio.prw", includes: headers }
};
```

`map` passa a incluir `originalFile`, além da linha e coluna. Diagnósticos sintáticos produzidos sobre o PPO são remapeados para `file` e `line`; `generatedLine` preserva a posição no PPO. Caminhos absolutos e segmentos `..` são recusados. Ciclos e profundidade excessiva bloqueiam a execução. Headers não fornecidos continuam não bloqueantes por meio de `PP0006`.

#### Catálogo distribuído

Desde a versão `0.15.0`, `runAsync()` carrega automaticamente headers conhecidos do catálogo `imsys/Protheus-Include`. O índice é pequeno e cada `.CH` é solicitado somente quando pertence à árvore iniciada pelo fonte. Conteúdos já obtidos são mantidos em cache durante a sessão.

Um manifesto informado por `options.preprocessor.includes` tem prioridade total e impede o carregamento automático. Para executar sem o catálogo incorporado:

```js
await AdvPLEmulator.runAsync(source, dados, {
  preprocessor: { builtinIncludes: false }
});
```

Para hospedar o catálogo em outro caminho relativo à página:

```js
window.ADVPL_EMULATOR_CONFIG = {
  preprocessor: { catalogUrl: "/assets/protheus-includes" }
};
```

`includeCatalog` identifica versão, origem e commit do catálogo usado. `#command`, `#xcommand`, `#translate`, `#xtranslate` e macros parametrizadas existentes nesses headers geram advertências de reconhecimento; suas regras ainda não são aplicadas ao fonte. A execução síncrona `run()` não realiza I/O e, portanto, exige manifesto explícito quando precisa expandir includes.

Um resultado com erros continua contendo `artifact` para inspeção. Antes de executar, verifique `diagnostics` ou use o pipeline assíncrono, que bloqueia erros. Metadados são independentes por chamada e serializáveis em JSON.

`capabilities` declara o alcance estável do pré-processador: `supported`, `recognized`, `unsupported` ou, no mapa, granularidade `line`. `applied` lista somente transformações realmente observadas naquela execução. O mesmo contrato está disponível em `program.preprocessor` e `analysis.preprocessing`. O laboratório apresenta esses dados no painel recolhível **Fonte × PPO didático**; exportação de arquivo ainda não faz parte desta etapa.

No navegador legado sem `advpl-preprocessor.js`, o fallback retorna `artifact.kind: "original-source"`, `compatibility: "none"`, `capabilities: {}` e `applied: []`. Ele repassa o texto original; não gera PPO. Consumidores de distribuições anteriores devem tolerar a ausência desses campos, sem inferir compatibilidade a partir dela.

### Tipos de saída

O campo `outputType` diferencia as famílias `message`, `console`, `dialog`, `grid` e `report`. O campo legado `kind` permanece disponível para distinguir variantes e preservar integrações existentes:

- `message`: `message` contém a primeira modal e `messages` preserva toda a fila;
- `console`: `console` contém as linhas registradas por `ConOut()`;
- `report`: `report` contém página, orientação, elementos e dados do relatório.
- `axcadastro`: contém `alias`, `title`, `rows`, `columns`, `callbacks`, `additionalActions` e `customButtons` para uma manutenção interativa.
- `fwmbrowse`: contém `alias`, `title`, `rows`, `columns` e `activated` para navegação sobre uma tabela fictícia.

No modelo `axcadastro`, os registros são obtidos de `options.tables[alias]`. Os callbacks já são normalizados como listas de eventos de mensagem, permitindo que outro renderizador reproduza `bPre`, confirmação, exclusão e as fases da transação sem interpretar novamente os blocos de código.

No modelo `fwmbrowse`, `SetAlias()` escolhe a tabela JSON e `SetDescription()` define o título. A emulação não consulta SX3 nem banco real e não cria ações de manutenção que não estejam declaradas no fonte.

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

### Parser sintático TDS opcional

A versão 0.3.0 incorpora `@totvs/tds-parsers@0.1.5` atrás de `AdvPLParserAdapter`. O executor leve continua responsável pelos efeitos emulados; a AST avançada é usada inicialmente apenas para análise estrutural e erros sintáticos. No navegador, o pacote é carregado sob demanda por `src/tds-parser-worker.js`, evitando incluir seus aproximadamente 117 KB minificados no carregamento inicial.

```js
const analysis = await AdvPLEmulator.analyze(source, { mode: "auto" });
// { version, parser, ast, diagnostics, elapsedMs, fallbackUsed, fallbackReason }
```

Os modos disponíveis são `light`, `tds` e `auto`. `auto` usa o parser avançado e recua para o leve quando o worker ou bundle não estiver disponível. `tds` torna uma falha de carregamento explícita. Erros reconhecidos pelo pacote usam `origin: "tds-parser"`; eles são diagnósticos sintáticos locais, não resultados oficiais de compilação do AppServer ou TDS.

Na versão 0.3.1, a interface e o protocolo headless usam o pipeline coordenado. Novas integrações devem preferir:

```js
const result = await frame.contentWindow.AdvPLEmulator.runAsync(codigoAdvPL, dados);
// { executed, stale, program, analysis }
```

`executed` é falso quando há erro sintático; nesse caso `program` é nulo e nenhum efeito visual é produzido. `stale` identifica uma análise descartada porque uma execução mais nova começou. `AdvPLEmulator.run()` permanece disponível como caminho síncrono legado e não aguarda a análise avançada.

O arquivo `msdialog.js` aceita shells legados sem os elementos opcionais de realce de sintaxe e impressão. Para integrações novas, prefira consumir `src/advpl-model.js`, `src/advpl-preprocessor.js` e `src/advpl-core.js`, mantendo um renderizador próprio.

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

O frame responde somente após análise e eventual execução. Os tipos são `advpl-emulator:rendered`, `advpl-emulator:diagnostics`, `advpl-emulator:stale` ou `advpl-emulator:error`. Uma integração de mesma origem também pode chamar diretamente:

```js
await frame.contentWindow.AdvPLEmulator.runAsync(codigoAdvPL);
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
