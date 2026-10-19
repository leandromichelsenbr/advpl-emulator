# Integração visual experimental da VM — 0.29.0

## Testar pelo playground

Em `index.html` ou `exercise.html`, selecione **Lógica e blocos (experimental)** no campo **Execução**. Cole o exemplo e pressione **Executar código**:

```advpl
User Function TesteBloco()
Local nTotal := 10
Local bSomar := {|nValor| nTotal += nValor, MsgInfo(cValToChar(nTotal), "Total"), nTotal}

ConOut("Antes das mensagens")
ConOut(cValToChar(Eval(bSomar, 2)))
ConOut(cValToChar(Eval(bSomar, 3)))
ConOut("Teste concluído")
Return nTotal
```

1. A primeira mensagem mostra **12**. O console contém apenas **Antes das mensagens**.
2. Clique em **OK**. A mensagem seguinte mostra **15** e o console acrescenta **12**.
3. Clique em **OK** novamente. O console acrescenta **15** e **Teste concluído**; o status informa conclusão.
4. **Executar novamente** começa uma sessão nova com total inicial 10.
5. Durante uma mensagem, **Interromper** cancela a sessão sem executar as saídas posteriores.

O console fica visível no modo experimental e mantém sua ordem de execução. Os botões de mensagens antigas não retomam uma sessão nova, nem uma segunda resposta ao mesmo OK avança a mensagem seguinte. Uma nova execução ou troca de modo cancela a sessão anterior, inclusive quando há uma análise sintática pendente.

## Cobertura e escolha de modo

**Componentes clássicos** continua sendo o padrão nesta entrega e executa os exemplos existentes de diálogos, browses e relatórios. **Lógica e blocos (experimental)** usa o subconjunto do Language Core, os blocos com `Eval`, console e mensagens `MsgInfo`. Os demais serviços/classes não passam a ser suportados pela VM por existirem no executor clássico. Não há troca automática de executor quando um fonte excede o recorte: os diagnósticos permanecem explícitos.

A direção aceita é tornar a VM o padrão quando estiver estável, mantendo o modo clássico acessível. Essa promoção ainda não faz parte desta entrega: os exemplos iniciais das páginas dependem de componentes clássicos, e a migração de objetos, diálogos e callbacks gerais permanece pendente.

## Pipeline e modelo

O pipeline mantém a fronteira sem efeitos: prepara PRW/PPO, aguarda a análise TDS e, só então, escolhe o executor. O modo VM entrega ao Language Core exatamente o PPO analisado; não reinterpreta o PRW com o executor leve. PPO fornecido mantém seu conteúdo e não carrega includes. Erros de AST/binder/compiler impedem qualquer saída, mesmo uma chamada de console anterior no fonte.

`src/advpl-vm-visual.js` adapta as sessões ao modelo intermediário `0.1`. Console, mensagens, variáveis e diagnósticos são publicados no envelope existente, com `execution: { engine, state, completed, steps, value }`. Os diagnósticos da VM são remapeados pelo mapa de origem do pré-processamento, assim como os diagnósticos sintáticos.

O renderer guarda o índice de eventos já apresentados e consome somente o delta de cada snapshot cumulativo. `MsgInfo` é um serviço de suspensão selecionado; o efeito aparece uma vez e o OK retoma o token daquela pausa. Pilha, frames, capturas e limites ficam na mesma sessão. Nenhuma execução completa é antecipada para depois apenas reproduzir caixas de mensagem.

## API

```javascript
const result = await AdvPLEmulator.runAsync(source, undefined, {
  engine: "vm",       // "legacy" seleciona o caminho clássico
  inputMode: "prw",   // "ppo" recebe texto já pré-processado
  vm: { maxSteps: 10000, maxCallDepth: 128 }
});

// O resultado inicial pode representar uma pausa; a interface continua pelo OK.
console.log(result.program.execution.state);
console.log(result.execution.snapshot().program.execution);

AdvPLEmulator.cancel();
```

`ADVPL_EMULATOR_CONFIG.engine` configura a escolha inicial. `runAsync` resolve após a análise e a primeira apresentação, sem aguardar que o usuário feche todas as mensagens. `result.program` é o snapshot inicial; `result.execution.snapshot().program` consulta o estado atual. A interface administra a retomada; integrações não devem retomar esse controlador em paralelo aos botões do renderer. A API de sessão sem DOM permanece disponível para hosts que administram sua própria apresentação.

`AdvPLEmulator.run` permanece síncrono e clássico; pedir `engine: "vm"` nesse método produz um erro de uso orientando para `runAsync`. O botão **Executar novamente** passa pelo mesmo caminho assíncrono de análise e pela seleção atual de execução.

O protocolo headless existente aceita `options.engine: "vm"` e mantém a notificação inicial após a primeira renderização. Essa notificação não equivale à conclusão do programa enquanto houver uma mensagem aberta. Tokens de sessão não são serializáveis e não são enviados por `postMessage`; notificações de conclusão e callbacks remotos gerais ainda não foram acrescentados.

## Validação e limites

`vm-visual-pipeline.test.js` cobre PPO/PRW, TDS real, bloqueio de efeitos, modelo neutro, diagnósticos, cancelamento e resultados sintáticos atrasados. `vm-visual-dom.test.js` carrega as duas páginas e seus scripts locais em jsdom e testa Executar, OK, interrupção, repetição de cliques, nova execução, troca de modo, erros e regressão de diálogo clássico.

jsdom é uma dependência exclusiva de desenvolvimento; não participa da distribuição no navegador. Esses testes verificam o DOM e o comportamento dos eventos, sem medir geometria ou fidelidade de pixels em um navegador real. A migração de diálogos/objetos/callbacks para a VM e a promoção do modo experimental a padrão permanecem como próximos incrementos.
