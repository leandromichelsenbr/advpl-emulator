# Próximos passos

Este documento orienta a evolução do AdvPL Emulator. O objetivo não é somente prever caixas de diálogo: o projeto deve interpretar um subconjunto crescente de AdvPL e simular, no navegador, seus resultados visuais — interfaces, componentes, gráficos e relatórios.

## Princípios do projeto

- Calibrar cada componente a partir de fontes AdvPL reais, capturas de tela e HTML inspecionado no WebApp.
- Reproduzir com fidelidade dimensões, coordenadas, fontes, cores, bordas, estados, eventos e comportamento.
- Separar interpretação, modelo intermediário e renderização para permitir outros integradores e interfaces.
- Manter execução segura: interpretar somente o subconjunto suportado, sem executar AdvPL arbitrário.
- Registrar exemplos de referência e testes de regressão antes de considerar um componente concluído.
- Indicar claramente limitações e diferenças conhecidas em relação ao SmartClient e ao WebApp.

## Prioridade imediata

- [ ] Criar uma matriz de fidelidade para cada componente: fonte, captura, HTML de referência, propriedades observadas e diferenças pendentes.
- [ ] Calibrar `MSDialog`/`TDialog`: título, área útil, coordenadas, centralização, cores, fontes e ciclo de ativação.
- [ ] Calibrar `TWBrowse`/`TCBrowse`: cabeçalho, linhas alternadas, seleção, imagens, rolagem, navegação e duplo clique.
- [ ] Completar a calibração de `BrGetDDB`/`TGetDados`: edição por célula, exclusão, navegação e alimentação por dados de referência.
- [ ] Calibrar mensagens (`MsgInfo`, `MsgStop`, `MsgAlert`, confirmações) e seus fluxos modais.
- [ ] Unificar a ação principal como **Executar código** em todas as interfaces e integrações.
- [ ] Criar testes visuais com tolerância definida para impedir regressões de layout.

## Componentes visuais

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

## Interpretador

- [ ] Ampliar expressões, operadores, funções, arrays e blocos de código necessários aos exemplos visuais.
- [ ] Implementar pré-processamento controlado de constantes e arquivos `.ch` relevantes.
- [ ] Melhorar resolução de variáveis `Local`, `Private`, `Public` e propriedades de objetos.
- [ ] Suportar chamadas encadeadas, atribuições, condicionais e laços usados na montagem visual.
- [ ] Produzir diagnósticos com linha, coluna e sugestão quando uma construção não for suportada.
- [ ] Exibir no resultado quais instruções foram interpretadas, aproximadas ou ignoradas.

## Experiência do laboratório

- [ ] Oferecer exemplos selecionáveis para diálogos, browses, impressão, códigos de barras, QR Code e gráficos.
- [ ] Permitir compartilhar um exercício por URL ou arquivo, sem incluir dados sensíveis.
- [ ] Adicionar modo lado a lado: referência real versus resultado emulado.
- [ ] Tornar editor, preview e setups responsivos e acessíveis por teclado.
- [ ] Preservar o código localmente no navegador e oferecer restauração do exemplo.
- [ ] Disponibilizar documentação de construções suportadas diretamente no laboratório.

## Qualidade e integração

- [ ] Criar fixtures versionadas para cada fonte, HTML, imagem e PDF de referência autorizado.
- [ ] Cobrir parser, modelo intermediário, eventos e renderizadores com testes automatizados.
- [ ] Executar testes de integração do laboratório incorporado, além da versão local.
- [x] Disponibilizar modo `headless` para incorporar somente a saída e executar fontes dinamicamente.
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
