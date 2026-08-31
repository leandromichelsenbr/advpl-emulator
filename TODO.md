# Próximos passos

Este documento orienta a evolução do AdvPL Emulator. O objetivo não é somente prever caixas de diálogo: o projeto deve interpretar um subconjunto crescente de AdvPL e simular, no navegador, seus resultados visuais — interfaces, componentes, gráficos e relatórios.

## Princípios do projeto

- Calibrar cada componente a partir de fontes AdvPL reais, capturas de tela e HTML inspecionado no WebApp.
- Reproduzir com fidelidade dimensões, coordenadas, fontes, cores, bordas, estados, eventos e comportamento.
- Separar interpretação, modelo intermediário e renderização para permitir outros integradores e interfaces.
- Manter execução segura: interpretar somente o subconjunto suportado, sem executar AdvPL arbitrário.
- Registrar exemplos de referência e testes de regressão antes de considerar um componente concluído.
- Indicar claramente limitações e diferenças conhecidas em relação ao SmartClient e ao WebApp.
- Manter comentários didáticos nos módulos internos, priorizando propósito, contratos e decisões não evidentes.

## Prioridade imediata

- [ ] Criar uma matriz de fidelidade para cada componente: fonte, captura, HTML de referência, propriedades observadas e diferenças pendentes.
- [ ] Calibrar `MSDialog`/`TDialog`: título, área útil, coordenadas, centralização, cores, fontes e ciclo de ativação.
- [ ] Completar a calibração de `TWBrowse`/`TCBrowse`: o cabeçalho, linhas alternadas, seleção, imagens, navegação, clique no cabeçalho e duplo clique já possuem suporte inicial; faltam rolagem fiel, teclado, foco e demais callbacks.
- [ ] Completar a calibração de `BrGetDDB`/`TGetDados`: edição por célula, exclusão, navegação e alimentação por dados de referência.
- [ ] Completar a calibração de mensagens: `MsgInfo`, `MsgStop`, `MsgAlert` e `Alert` já possuem suporte inicial; faltam confirmações adicionais e calibração de todos os estados.
- [x] Unificar a ação principal como **Executar código** nas interfaces atuais.
- [ ] Criar testes visuais com tolerância definida para impedir regressões de layout.

## Componentes visuais

- [x] Implementar a primeira versão interativa de `AxCadastro()`, incluindo dados fictícios por alias e callbacks principais.
- [ ] Calibrar formulários de inclusão/alteração de `AxCadastro()` a partir dos campos SX3 fornecidos em dados de exemplo.
- [ ] Ampliar permissões, legendas, filtros avançados, detalhes e ações de menu de `AxCadastro()`.
- [x] Implementar a primeira versão de `FWMBrowse()` com `SetAlias()`, `SetDescription()`, `Activate()`, pesquisa, seleção, detalhes e tabelas JSON.
- [ ] Calibrar `FWMBrowse()` com ordens, legenda, menus, impressão do browse, navegação lateral e metadados SX3 fictícios.

- [ ] `SAY`, `GET`, `MSGET`, `CHECKBOX` e `BUTTON`: completar `PICTURE`, `VALID`, `WHEN`, estados desabilitados e foco.
- [ ] Botões de imagem, bitmaps, ícones e recursos retornados por `GetResources()`/`LoadBitmap()`.
- [ ] Radio buttons, combos, listas, abas, grupos, painéis e barras de ferramentas.
- [ ] Grades e browses adicionais, incluindo colunas editáveis, alinhamento, freeze e callbacks.
- [ ] Fontes (`TFont`), brushes (`TBrush`), cores, medidas e conversões entre `PIXEL` e coordenadas legadas.
- [ ] Eventos de teclado e mouse, fechamento, validação, inicialização e redimensionamento.
- [ ] Formulários maiores e composição de múltiplos diálogos/modais.

## Impressões, relatórios e gráficos

- [ ] Tratar impressão como saída principal do emulador, no mesmo nível das caixas de diálogo.
- [ ] Consolidar `FWMSPrinter` e `TMSPrinter` em um modelo intermediário comum de página.
- [ ] Reproduzir setup, preview, resultado modal, dispositivo e fluxo de impressão.
- [ ] Calibrar A4 e outros papéis, margens, DPI, escala, retrato e paisagem.
- [ ] Completar paginação: `StartPage`, `EndPage`, múltiplas páginas, cabeçalho e rodapé.
- [ ] Calibrar `Say`, `SayAlign`, `Line`, `Box`, `FillRect`, fontes, cores e espessuras.
- [ ] Aprimorar imagens, `SayBitmap`, EAN13, QR Code e outros códigos de barras.
- [ ] Adicionar primitivas gráficas: linhas, retângulos, elipses, preenchimentos, legendas e gráficos.
- [ ] Exportar e comparar PDF gerado com PDFs de referência.
- [ ] Simular spool/preview sem depender de caminhos locais do ambiente Protheus.

### Marco DANFEII

O inventário detalhado e a comparação com o suporte atual estão em [`docs/danfeii-print-inventory.md`](docs/danfeii-print-inventory.md).

#### Fase 1 — Modelo de execução e páginas

- [ ] Substituir a coleta global de chamadas por um fluxo ordenado de instruções de impressão.
- [ ] Modelar documento, páginas e elementos separadamente, preservando cada `StartPage()` e `EndPage()`.
- [ ] Selecionar a função de entrada e seguir chamadas como `PrtDanfe`, `DanfeCpl`, `SimpDanfe`, `ImpItem` e `RiscaItem`.
- [ ] Interpretar os condicionais e laços mínimos necessários sem misturar DANFE normal, simplificado, continuação e verso.
- [ ] Permitir fornecer um JSON fictício de NF-e e transformar seus dados em variáveis/objetos acessíveis ao fonte.

#### Fase 2 — Geometria e tipografia

- [ ] Calibrar a grade DANFE de 603 × 865 unidades para A4 com resolução 78 e margens 60.
- [ ] Implementar `TFontEx` e a passagem de `oFontEx:oFont` para `Say()`.
- [ ] Reproduzir `Times New Roman` nos tamanhos 6 a 17, incluindo negrito e demais flags.
- [ ] Avaliar expressões usadas em coordenadas, dimensões e textos, em vez de convertê-las silenciosamente para zero.
- [ ] Implementar medição de texto compatível com o cálculo de colunas e alinhamento numérico.
- [ ] Calibrar `Say()` e `Box()` com sobreposição, bordas, recortes e ordem de desenho.

#### Fase 3 — Recursos e códigos

- [ ] Implementar `Code128C()` com validação, largura e altura equivalentes ao FWMSPrinter.
- [ ] Resolver `SayBitmap()` por mapa seguro de recursos fornecido pelo exercício, sem acessar caminhos arbitrários.
- [ ] Suportar os logotipos do emitente e institucionais com fallback visual explícito.
- [ ] Preservar cores, estilos e propriedades gráficas adicionais quando presentes.

#### Fase 4 — Fluxo de impressão

- [ ] Modelar `lServer`, `nDevice`, `cPathPDF` e `cPrinter` sem realizar escrita arbitrária no servidor.
- [ ] Completar `Setup()` para destinos PDF, spool e impressora simulada.
- [ ] Completar `Preview()` com navegação entre todas as páginas; fechamento e retomada do fluxo já possuem suporte.
- [ ] Gerar PDF multipágina com dimensões e orientação consistentes com o preview.

#### Fase 5 — Fixture e fidelidade

- [ ] Extrair um exemplo DANFE mínimo, sem dados ou regras proprietárias desnecessárias.
- [ ] Criar dados fiscais inteiramente fictícios para emitente, destinatário, itens, totais, transporte e mensagens.
- [ ] Registrar PDF e imagens de referência autorizados para DANFE normal, continuação e simplificado.
- [ ] Adicionar testes unitários por primitiva, testes multipágina e comparação visual automatizada.
- [ ] Documentar diferenças residuais antes de marcar o marco DANFEII como calibrado.

## Interpretador

- [x] Criar um fluxo ordenado de eventos para combinar console e mensagens em uma mesma execução.
- [x] Incorporar abertura/fechamento de diálogos e callbacks ao fluxo unificado.
- [x] Incorporar criação, setup, preview e fechamento de relatórios ao fluxo unificado.
- [x] Estender o fluxo unificado para chamadas entre funções, com parâmetros, retorno e propagação ordenada de eventos.
- [x] Coordenar análise sintática assíncrona e execução visual, impedindo efeitos quando o parser TDS encontrar erro.
- [x] Descartar respostas atrasadas e sincronizar o protocolo headless com o término da análise.
- [ ] Permitir que funções chamadas criem e manipulem diálogos e relatórios usando o mesmo contexto de objetos da função principal.
- [x] Iniciar o épico [`@totvs/tds-parsers`: AST e diagnósticos sintáticos opcionais](#épico-tds-parsers-ast-e-diagnósticos-sintáticos-opcionais) com adaptador neutro, Web Worker, bundle sob demanda, diagnóstico posicionado e fallback.
- [x] Iniciar um catálogo de assinaturas AdvPL para diagnósticos rápidos, com `W0008`, origem, linha e coluna.
- [ ] Versionar e ampliar o catálogo de assinaturas para tipos, símbolos desconhecidos e variações de LIB.
- [ ] Criar um adaptador opcional para TDS-Cli/Language Server que normalize diagnósticos oficiais por versão da LIB, sem expor AppServer ou credenciais ao navegador.
- [ ] Exibir separadamente diagnósticos do emulador e do compilador TDS; os diagnósticos locais já mostram código, severidade, origem, linha e coluna.
- [ ] Ampliar expressões, operadores, funções, arrays e blocos de código; já há suporte inicial a comparações, aritmética, arrays aninhados, `Abs`, `Len`, `Chr`, `ACopy` e `AClone`.
- [ ] Implementar pré-processamento controlado de constantes e arquivos `.ch` relevantes.
- [ ] Melhorar resolução de variáveis `Local`, `Private`, `Public` e propriedades de objetos.
- [ ] Completar chamadas encadeadas, atribuições, condicionais e laços; `+=`, `If/Else` e `For/To/Step/Next` possuem suporte inicial em fluxos independentes.
- [ ] Produzir diagnósticos com linha, coluna e sugestão quando uma construção não for suportada.
- [ ] Exibir no resultado quais instruções foram interpretadas, aproximadas ou ignoradas.

### Épico `tds-parsers`: AST e diagnósticos sintáticos opcionais

**Objetivo:** usar `@totvs/tds-parsers` para compreender a estrutura do fonte e localizar erros sintáticos, sem substituir de uma vez o executor atual, sem exigir AppServer e sem impedir o laboratório de funcionar quando a camada avançada estiver indisponível.

#### 1. Viabilidade e governança

- [x] Confirmar que o projeto está publicado pela organização oficial TOTVS e oferece API embarcada para AdvPL.
- [x] Confirmar licença Apache-2.0 no repositório e no pacote NPM.
- [x] Registrar a referência inicial do NPM: versão `0.1.5`, 42 arquivos e aproximadamente 1,47 MB descompactados, verificada em 28/08/2026.
- [x] Verificar se a distribuição possui arquivo `NOTICE` ou atribuições adicionais que devam acompanhar o emulador.
- [x] Criar inventário de dependências efetivamente incorporadas ao bundle e respectivas licenças.
- [x] Registrar decisão arquitetural sobre versão fixada, política de atualização e manutenção do adaptador.

#### 2. Prova de conceito no navegador

- [ ] Criar experimento isolado em `experiments/tds-parser-browser/`, sem alterar o caminho de execução atual.
- [x] Gerar bundle IIFE com esbuild e medir o tamanho minificado; o bundle inicial possui aproximadamente 117 KB.
- [x] Verificar dependências de APIs exclusivas do Node.js, como `fs`, `path`, `process` e carregamento de módulos.
- [x] Executar o parser dentro de Web Worker para evitar bloqueio do editor.
- [ ] Validar nos navegadores suportados pelo laboratório local, GitHub Pages e página incorporada da Usina.BR.
- [ ] Medir tempo e memória para fontes de aproximadamente 100, 1.000 e 10.000 linhas.
- [ ] Definir limites de tempo, tamanho de fonte e recuperação segura após falha do worker.

#### 3. Corpus de compatibilidade AdvPL

- [ ] Criar fixtures mínimas para `MsgAlert`, diálogo, browse, `AxCadastro`, relatório e chamada entre funções.
- [ ] Testar continuações com `;`, comentários, strings com vírgulas, arrays e blocos de código aninhados.
- [ ] Testar `User Function`, `Static Function`, parâmetros, `Return`, `If`, `For`, `While` e `Do Case`.
- [ ] Testar fontes válidos e inválidos, registrando linha, coluna, mensagem e comportamento observado.
- [ ] Avaliar limites com `#include`, `#define`, macros, embedded SQL e construções dependentes de versão da LIB.
- [ ] Comparar a AST com o inventário do `danfeii.prw` sem publicar código ou dados proprietários.

#### 4. Adaptador e contrato neutro

- [x] Criar `AdvPLParserAdapter` para impedir que o restante do projeto dependa diretamente do formato da AST da TOTVS.
- [x] Normalizar resultado como `{ parser, ast, diagnostics, elapsedMs, fallbackUsed }`.
- [x] Definir modos `light`, `tds` e `auto`, com `auto` ativo na prova de conceito integrada.
- [x] Carregar o bundle avançado sob demanda, mantendo o primeiro carregamento do laboratório leve.
- [x] Manter fallback automático para o parser atual quando o pacote não carregar.
- [ ] Versionar o formato da AST normalizada e documentar alterações incompatíveis.

#### 5. Integração gradual no interpretador

- [ ] Usar inicialmente a AST apenas para separar funções, instruções, argumentos, blocos e posições no fonte.
- [ ] Preservar o executor e o modelo neutro atuais durante a primeira integração.
- [ ] Migrar um recurso por vez, começando por chamadas de função e caixas de mensagem.
- [ ] Migrar a descoberta estrutural de diálogos, callbacks, `AxCadastro` e impressão somente após testes de equivalência.
- [ ] Executar parser leve e parser TDS em modo de comparação durante o desenvolvimento, sem duplicar efeitos visuais.
- [ ] Registrar divergências como fixtures antes de substituir qualquer caminho estável.

#### 6. Diagnósticos e experiência do laboratório

- [x] Normalizar erros sintáticos com linha, coluna, severidade, mensagem e origem `tds-parser`.
- [ ] Manter `emulator-signatures` separado para advertências aproximadas como `W0008`.
- [ ] Reservar `tds-compiler` para diagnósticos oficiais futuros do TDS-Cli, Language Server ou AppServer.
- [ ] Exibir claramente quando a análise avançada estiver indisponível e o fallback tiver sido usado.
- [ ] Permitir clicar no diagnóstico para posicionar o editor na linha e coluna correspondentes.
- [ ] Nunca apresentar um diagnóstico do parser local como resultado oficial de compilação Protheus.

#### 7. Critérios de aceite do épico

- [x] O laboratório continua funcional sem `@totvs/tds-parsers` e sem conexão externa, recorrendo ao parser leve se o worker ou bundle não carregar.
- [x] Erros sintáticos interrompem a execução antes de mensagens, diálogos ou relatórios serem renderizados.
- [ ] O parser avançado não bloqueia a interface durante fontes grandes ou inválidos.
- [ ] O bundle e o tempo de inicialização permanecem dentro dos limites definidos na prova de conceito.
- [ ] Todos os exemplos existentes produzem modelo e saída equivalentes antes e depois da ativação da AST.
- [ ] Falhas, incompatibilidades e fallback possuem testes automatizados.
- [ ] Licença, atribuições, versão fixada e processo de atualização estão documentados.
- [ ] O modo avançado funciona no laboratório local, no GitHub Pages e na incorporação da Usina.BR.

## Experiência do laboratório

- [x] Calibrar `MsgAlert()` como caixa modal de advertência, com título e ícone próprios.
- [x] Calibrar `Alert()` como caixa modal crítica, com título padrão `TOTVS` e ícone vermelho.
- [x] Exibir a saída de `ConOut()` em um console recolhível, inclusive junto de mensagens no mesmo fluxo.
- [x] Oferecer **Executar novamente** após concluir uma fila de mensagens ou encerrar um diálogo.
- [ ] Oferecer exemplos selecionáveis para diálogos, browses, impressão, códigos de barras, QR Code e gráficos.
- [ ] Permitir compartilhar um exercício por URL ou arquivo, sem incluir dados sensíveis.
- [ ] Adicionar modo lado a lado: referência real versus resultado emulado.
- [ ] Tornar editor, preview e setups responsivos e acessíveis por teclado.
- [ ] Preservar o código localmente no navegador e oferecer restauração do exemplo.
- [x] Indentar automaticamente blocos, continuações e seleções durante a digitação.
- [ ] Disponibilizar documentação de construções suportadas diretamente no laboratório.

## Qualidade e integração

- [x] Definir um padrão inicial de comentários didáticos para funções e módulos internos.
- [ ] Ampliar gradualmente os comentários de arquitetura no renderizador, modelo de relatórios e interpretador leve.
- [ ] Criar fixtures versionadas para cada fonte, HTML, imagem e PDF de referência autorizado.
- [ ] Cobrir parser, modelo intermediário, eventos e renderizadores com testes automatizados.
- [ ] Executar testes de integração do laboratório incorporado, além da versão local.
- [x] Disponibilizar modo `headless` para incorporar somente a saída e executar fontes dinamicamente.
- [x] Permitir que cada chamada de teste forneça suas próprias tabelas em JSON.
- [ ] Versionar o contrato público do núcleo e documentar migrações incompatíveis.
- [ ] Automatizar publicação e invalidação de cache dos arquivos incorporados.
- [ ] Manter exemplos sem dependência de AppServer, banco Protheus ou arquivos privados.

## Critério de conclusão de um componente

Um componente só deve ser marcado como calibrado quando possuir:

1. fonte AdvPL mínimo e fonte representativo;
2. captura e, quando disponível, HTML ou PDF da execução real;
3. propriedades e interações documentadas;
4. teste funcional automatizado;
5. comparação visual revisada;
6. limitações conhecidas registradas.
