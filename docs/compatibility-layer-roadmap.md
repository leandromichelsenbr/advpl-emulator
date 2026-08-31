# Direcionamento: camada de compatibilidade AdvPL/Protheus para Web

## Decisão arquitetural

O AdvPL Emulator deixa de ser orientado apenas à previsão de caixas de diálogo. O desenvolvimento passa a ser guiado pela construção incremental de uma **camada de compatibilidade AdvPL/Protheus para navegadores**, voltada a treinamento, documentação, experimentação e visualização segura de interfaces, dados fictícios e relatórios.

A analogia com o Wine ajuda a explicar a direção: em vez de reproduzir a implementação interna da plataforma original, reimplementamos contratos e comportamentos observáveis sobre recursos do ambiente hospedeiro. No projeto, comandos, funções e classes AdvPL são reconhecidos e convertidos em modelos neutros, depois apresentados com HTML/CSS, Canvas, SVG, PDF ou JSON headless.

Essa analogia não significa compatibilidade binária nem execução integral do Protheus. O emulador:

- recebe fonte AdvPL, não APO compilado;
- não incorpora nem substitui Application Server, DBAccess, RPO, SmartClient ou WebApp;
- não pretende reproduzir o ERP, seus módulos, licenciamento ou dados reais;
- executa somente um subconjunto documentado dentro de um runtime controlado;
- usa dados, includes e recursos fictícios ou explicitamente fornecidos à execução;
- deve informar quando um comportamento é suportado, aproximado ou não suportado.

Definição de produto adotada:

> O AdvPL Emulator é uma camada de compatibilidade educacional e visual para executar, no navegador, um subconjunto controlado de AdvPL/Protheus, sem exigir AppServer, banco Protheus ou autenticação.

## Princípios de desenvolvimento

1. **Contrato antes da aparência:** reproduzir entrada, estado, eventos, retorno e ciclo de vida, além do desenho.
2. **Modelo neutro:** parser e runtime não devem criar DOM diretamente.
3. **Compatibilidade incremental:** implementar recursos motivados por fontes e resultados reais autorizados.
4. **Segurança por construção:** nunca encaminhar AdvPL, macros ou SQL para `eval()` ou acesso externo arbitrário.
5. **Observabilidade:** mostrar o que foi interpretado, expandido, aproximado, ignorado ou rejeitado.
6. **Fidelidade comprovável:** cada contrato precisa de exemplo, referência, teste e diferenças conhecidas.
7. **Execução independente:** exemplos devem funcionar sem infraestrutura Protheus e sem arquivos privados.
8. **Perfis explícitos:** diferenças dependentes de LIB, SmartClient ou WebApp devem ser versionadas.

## Arquitetura-alvo em camadas

```text
Fonte AdvPL / TLPP suportado
            ↓
1. Entrada e contexto do exercício
            ↓
2. Pré-processador controlado
            ↓
3. Parser e diagnósticos
            ↓
4. AST/modelo normalizado da linguagem
            ↓
5. Runtime AdvPL controlado
            ↓
6. Bibliotecas de compatibilidade Protheus
            ↓
7. Modelo intermediário de saídas
            ↓
8. Backends: DOM/CSS · Canvas/SVG · PDF · headless JSON
```

### 1. Entrada e contexto do exercício

Responsável por reunir, sem acessar recursos arbitrários:

- fonte principal;
- tabelas JSON e metadados fictícios;
- includes virtuais fornecidos pelo exercício;
- mapa seguro de imagens e recursos;
- perfil de compatibilidade e versão de LIB;
- limites de execução e configuração headless.

Contrato proposto:

```js
{
  source,
  profile: "protheus-default",
  tables: {},
  metadata: {},
  includes: {},
  resources: {},
  limits: {}
}
```

### 2. Pré-processador controlado

Responsável por `#define`, `#undef`, condicionais, includes virtuais e traduções de comandos permitidas. Deve produzir fonte expandido, inventário de diretivas, diagnósticos e mapa entre a posição gerada e o fonte original.

Não deve ler o sistema de arquivos do usuário, baixar headers automaticamente ou executar o operador macro com JavaScript. `#command` e `#translate` entram gradualmente por regras testadas; o operador `&` permanece uma capacidade separada do runtime.

Contrato proposto:

```js
{
  source,
  directives,
  includes,
  defines,
  translations,
  diagnostics,
  sourceMap
}
```

### 3. Parser e diagnósticos

Mantém duas implementações coordenadas:

- `@totvs/tds-parsers`, opcional, para AST e erros sintáticos;
- parser leve, obrigatório, como fallback e executor do subconjunto estável.

Diagnósticos devem preservar origens distintas: `preprocessor`, `tds-parser`, `emulator-signatures`, `runtime` e, futuramente, `tds-compiler`. Nenhum diagnóstico local pode ser apresentado como compilação oficial do Protheus.

### 4. AST/modelo normalizado da linguagem

Evita que o restante do projeto dependa do formato interno de um parser. Deve representar funções, declarações, expressões, blocos, chamadas, criação de objetos, invocações de métodos e posições no fonte.

O formato precisa de versão própria e testes de equivalência antes de substituir caminhos existentes.

### 5. Runtime AdvPL controlado

Responsável pela semântica da linguagem:

- tipos caractere, numérico, lógico, data, array, objeto, code block e `Nil`;
- escopos `Local`, `Private`, `Public` e `Static`;
- pilha de chamadas, parâmetros e retornos;
- operadores, condicionais, laços e indexação AdvPL iniciada em 1;
- tabela de objetos, propriedades, métodos e ciclo de vida;
- fila ordenada de eventos e suspensão modal;
- limites de tempo, memória, recursão, iteração e quantidade de eventos.

O runtime executa instruções normalizadas e nunca JavaScript gerado livremente.

### 6. Bibliotecas de compatibilidade Protheus

Reimplementam contratos observáveis em módulos independentes:

| Módulo | Escopo inicial |
|---|---|
| `compat/messages` | `MsgInfo`, `MsgStop`, `MsgAlert`, `Alert`, confirmações |
| `compat/ui` | `MSDialog`, `TDialog`, controles, fontes, brushes e recursos |
| `compat/browse` | `TWBrowse`, `TCBrowse`, `BrGetDDB`, `FWMBrowse`, colunas e eventos |
| `compat/printing` | `FWMSPrinter`, `TMSPrinter`, setup, páginas, desenho e preview |
| `compat/data` | aliases, áreas de trabalho, navegação e consultas seguras sobre fixtures |
| `compat/runtime` | `ConOut`, `FunName`, `SetFunName`, ambiente e ciclo de objetos |

Cada método deve declarar assinatura, estado, efeitos, retorno, limitações e referências usadas na calibração.

### 7. Modelo intermediário de saídas

Representa resultados sem conhecimento de HTML:

- `message`;
- `dialog`;
- `grid`/`browse`;
- `maintenance`;
- `console`;
- `report` e páginas;
- `graphic`;
- eventos de abertura, interação, suspensão e fechamento.

Uma mesma execução pode combinar saídas em ordem, preservando a semântica modal.

### 8. Backends

- DOM/CSS para componentes e laboratório;
- Canvas/SVG para primitivas gráficas e códigos;
- PDF para impressão fiel e multipágina;
- headless JSON para páginas de treinamento e outros integradores;
- backends futuros sem alteração do runtime.

## Matriz de compatibilidade

Todo recurso deve possuir um dos estados abaixo:

| Estado | Significado |
|---|---|
| `supported` | contrato coberto por referência e testes funcionais |
| `partial` | parte do contrato é fiel e as lacunas estão listadas |
| `approximated` | resultado didático equivalente, sem equivalência integral |
| `recognized` | construção identificada, mas ainda não executada |
| `unsupported` | construção rejeitada com diagnóstico explícito |

Ficha mínima de um recurso:

```json
{
  "name": "FWMBrowse",
  "module": "compat/browse",
  "status": "partial",
  "supported": ["New", "SetAlias", "SetDescription", "Activate"],
  "approximated": ["search", "filter", "details"],
  "unsupported": ["SX3 metadata", "index orders", "full menus"],
  "profiles": ["protheus-default"],
  "references": ["source", "WebApp HTML"],
  "tests": []
}
```

## Roteiro de implementação

### Marco A — fundação e inventário

- publicar catálogo inicial das APIs já emuladas;
- classificar cada função, classe e método nos cinco estados;
- versionar o contrato dos modelos intermediários;
- ligar referências, fixtures e testes a cada ficha;
- registrar diferenças entre SmartClient e WebApp.

**Aceite:** toda capacidade anunciada no README aparece na matriz e nenhuma aproximação é apresentada como suporte integral.

### Marco B — pré-processador mínimo observável

- criar `src/advpl-preprocessor.js` sem dependência do DOM;
- implementar `#define`, `#undef`, `#ifdef`, `#ifndef`, `#else` e `#endif`;
- expandir somente tokens, preservando strings e comentários;
- detectar diretivas inválidas, redefinições e ciclos;
- gerar mapa de origem e diagnósticos `preprocessor`;
- integrar sem quebrar o fallback atual.

**Aceite:** exemplos com `CRLF`, título definido e ramos condicionais produzem o mesmo resultado no parser leve e no pipeline assíncrono, com posições reportadas no fonte original.

### Marco C — includes e perfis virtuais

- criar catálogo mínimo de compatibilidade para `TOTVS.CH`, `RPTDEF.CH`, `FWPrintSetup.ch`, `TCBrowse.ch` e headers exigidos pelo corpus;
- permitir includes fornecidos no JSON do exercício;
- impedir caminhos absolutos, `..`, ciclos e profundidade excessiva;
- registrar origem e versão de cada constante;
- definir perfis de LIB sem distribuir headers proprietários completos.

**Aceite:** constantes deixam de depender de exceções espalhadas no executor, e um include ausente produz diagnóstico claro sem acesso ao disco ou à rede.

### Marco D — runtime de linguagem

- centralizar tipos e coerções AdvPL;
- compartilhar escopos e objetos entre funções auxiliares;
- completar arrays, code blocks, propriedades e chamadas encadeadas;
- ampliar `While`, `Do Case`, controle de fluxo e erros de runtime;
- formalizar suspensão/retomada de mensagens, diálogos e previews;
- impor limites seguros e cancelamento.

**Aceite:** o mesmo runtime executa lógica pura, callbacks, objetos visuais e impressão sem caminhos especializados incompatíveis.

### Marco E — bibliotecas de compatibilidade

- extrair mensagens, UI, browse, impressão, dados e runtime para módulos próprios;
- registrar assinaturas e retornos por método;
- adotar tabela de objetos e despacho controlado;
- transformar comandos e classes equivalentes no mesmo contrato neutro;
- ampliar a suíte por módulo.

**Aceite:** adicionar um método compatível não exige modificar o parser e o renderizador ao mesmo tempo.

### Marco F — dados e consultas seguras

- modelar áreas de trabalho virtuais sobre JSON;
- implementar navegação, posição, EOF, filtros e ordens fictícias;
- incorporar metadados SX3 fornecidos pelo exercício;
- emular `FWExecStatement` somente para um subconjunto de `SELECT` sobre fixtures;
- recusar escrita, DDL, acesso externo e SQL não suportado.

**Aceite:** browses e consultas usam a mesma fonte virtual, com resultado determinístico e sem banco real.

### Marco G — backends e fidelidade

- consolidar renderizadores DOM/CSS, Canvas/SVG, PDF e headless;
- tornar relatório e interface consumidores do mesmo fluxo de eventos;
- implementar comparação visual automatizada;
- calibrar componentes por perfil SmartClient/WebApp;
- manter acessibilidade e responsividade.

**Aceite:** um modelo pode ser renderizado em mais de um backend sem reinterpretação do fonte.

### Marco H — conformidade, desempenho e distribuição

- criar corpus público mínimo por camada;
- medir fontes de 100, 1.000 e 10.000 linhas;
- testar limites, falhas, cancelamento e recuperação dos workers;
- validar laboratório local, GitHub Pages e incorporação Usina.BR;
- documentar compatibilidade por versão e processo de atualização.

**Aceite:** publicação reproduzível, matriz verificável e degradação segura quando parser avançado ou recurso opcional não estiver disponível.

## Fora de escopo até decisão futura

- execução de APO ou compatibilidade binária;
- substituição de Application Server, DBAccess ou RPO;
- conexão automática a ambientes ou bancos Protheus;
- execução irrestrita do operador macro `&`;
- reprodução integral e não versionada de todos os headers da LIB;
- escrita SQL, DDL ou acesso arbitrário ao sistema de arquivos;
- alegação de compatibilidade total com aplicações Protheus.

## Ordem imediata

1. criar a primeira matriz de compatibilidade a partir do README e dos testes atuais;
2. definir a versão `0.1` do modelo intermediário unificado;
3. implementar o pré-processador mínimo observável;
4. introduzir includes virtuais por execução;
5. refatorar progressivamente o runtime e as bibliotecas, preservando todos os exemplos existentes.

Esta ordem evita uma reescrita completa: cada camada nasce atrás de um contrato e substitui gradualmente caminhos especializados somente depois de testes de equivalência.
