# PPO e o pipeline do AdvPL: conclusões para o emulador

## Implementação do primeiro passo — 03/09/2026

O P0 foi implementado na distribuição `0.9.0`: a API de pré-processamento identifica o texto com `artifact.kind: "didactic-ppo"`, `label: "PPO didático — subconjunto do emulador"` e `compatibility: "partial"`. O modo legado sem o módulo é identificado como `original-source`, com compatibilidade `none`, para não anunciar pré-processamento inexistente. O campo é preservado no modelo e na análise do pipeline, inclusive em análises bloqueadas por erro.

O [contrato de integração](integration.md#contrato-do-ppo-didático) documenta o uso. O painel visual Fonte × PPO, `capabilities` e `applied` foram implementados na versão 0.13.0; a resolução controlada de includes e a proveniência por arquivo chegaram na 0.14.0; a 0.15.0 incorporou um catálogo educacional com carregamento sob demanda; a 0.16.0 implementou macros parametrizadas; a 0.17.0 passou a aplicar traduções em formato de chamada, validadas com regras reais do `COMMON.CH`; e a 0.18.0 acrescentou sequências literais e marcadores de identificador, validados com `BYREF` de `APWEBSRV.CH`. Pontuação, expressões, padrões opcionais/listas e regras de comando permanecem como próximas etapas. A descrição da arquitetura do estudo permanece como registro do diagnóstico inicial.

## Resposta curta

Sim. No fluxo tradicional do AdvPL, o **pré-processador gera um PPO** (*Pre-Processed Output*): uma representação textual do fonte depois da resolução das diretivas, dos includes e das traduções conhecidas pelo pré-processador. O PPO ainda é código-fonte AdvPL; ele **não é bytecode**, não é um APO e não é o RPO.

O modelo conceitual é:

```text
fonte .PRW + includes .CH + símbolos/opções do ambiente
                         ↓ pré-processador
                 fonte pré-processado (PPO)
                         ↓ compilador
                 bytecode / objeto (APO)
                         ↓ armazenamento
              repositório de objetos (RPO)
                         ↓ carregamento sob demanda
             máquina virtual do AppServer / runtime
```

A palavra “gera” merece uma precisão: PPO designa a **saída lógica da pré-compilação**. A ferramenta pode materializá-la como arquivo para inspeção ou encaminhá-la internamente à compilação. Portanto, não se deve deduzir que toda compilação necessariamente deixará um `.ppo` persistente ao lado do `.prw`.

## O que acontece na pré-compilação

O fonte que o programador escreve não é, em muitos casos, o texto que o compilador recebe. A pré-compilação pode:

1. carregar o conteúdo trazido por `#include`;
2. criar e remover definições com `#define` e `#undef`;
3. selecionar trechos com diretivas condicionais como `#ifdef`, `#ifndef`, `#else` e `#endif`;
4. expandir macros textuais;
5. aplicar regras de `#translate`/`#xtranslate` e `#command`/`#xcommand`;
6. transformar construções de mais alto nível em chamadas e expressões que o compilador entende.

Essa última etapa explica por que boa parte do que parece ser “sintaxe nativa” do AdvPL é, na verdade, uma camada definida em headers. Um comando de abertura de tabela, por exemplo, pode aparecer no PPO como uma chamada a `DbUseArea()`. O mesmo princípio aparece no Embedded SQL: a documentação da TOTVS mostra um bloco `BeginSql`/`EndSql` convertido no PPO em uma chamada a `__execSql(...)`, com expansão das marcações `%table`, `%xfilial`, `%exp`, `%notDel` e `%order`.

As estruturas fundamentais de controle — como `If`, `For` e `While` — permanecem linguagem do compilador. Não é correto tratar toda a linguagem como simples substituição textual.

## PPO, APO e RPO não são sinônimos

| Conceito | Natureza | Papel |
|---|---|---|
| PRW | texto escrito pelo desenvolvedor | fonte de entrada |
| PPO | texto transformado | saída do pré-processador e entrada conceitual do compilador |
| bytecode/APO | objeto compilado proprietário | unidade executável pela máquina virtual |
| RPO | repositório de objetos | armazena objetos compilados e outros recursos do ambiente |
| runtime | máquina virtual e contexto de execução | carrega objetos sob demanda e executa as funções |

O artigo sobre o runtime descreve o código compilado sendo armazenado no repositório e carregado sob demanda pelo AppServer. A documentação da linguagem também chama as unidades compiladas de APOs e deixa claro que elas ficam no repositório, sem uma etapa clássica de linkedição que produza um executável independente para cada aplicação.

Consequentemente, gerar ou mostrar PPO no emulador aumenta a fidelidade da **fronteira de pré-processamento**, mas não equivale a compilar como o AppServer nem a emular o RPO.

## Como isso se relaciona com a arquitetura atual

O projeto já possui uma separação saudável entre fases:

```text
fonte original
    ↓ AdvPLPreprocessor.process()
fonte processado + definições + diagnósticos + mapa de linhas
    ↓ análise sintática TDS (sem efeitos)
    ↓ executor controlado do subconjunto
modelo intermediário 0.1
    ↓ backend HTML/CSS
saída visual
```

O retorno atual de `src/advpl-preprocessor.js` já é um **precursor de um artefato PPO observável**:

- `source`: texto após as transformações suportadas;
- `definitions`: tabela final de macros;
- `diagnostics`: problemas próprios da fase;
- `map`: correspondência entre linhas geradas e originais.

Também está correta a decisão do pipeline de enviar o texto processado ao analisador sintático. Um erro localizado em um ramo condicional inativo não deve bloquear o programa. A preservação de linhas vazias onde havia diretivas ou código excluído mantém diagnósticos simples alinhados ao fonte original.

Entretanto, **a saída atual não deve ser apresentada como PPO integralmente compatível com a TOTVS**. O emulador já resolve includes virtuais, macros simples e parametrizadas, condicionais e traduções em formato de chamada. Ainda não há expansão de grupos opcionais/listas de `#translate`, `#command`, `#xcommand`, Embedded SQL ou de todas as demais regras fornecidas pelos `.ch`. Chamar o resultado atual de “PPO TOTVS” sem o qualificador didático criaria uma expectativa falsa.

## Como os conceitos enriquecem o projeto

### 1. Tornar o pré-processamento uma fase de primeira classe

O emulador deve adotar um contrato explícito de **PPO didático**, separado do modelo executável. Isso permite inspecionar “o que o parser recebeu” e deixa claro se um problema nasceu no fonte original, na expansão ou no parser.

Nome sugerido para uma futura API:

```js
const result = AdvPLCore.preprocess(source, options);

result.source       // PPO didático
result.definitions  // macros finais
result.diagnostics  // diagnósticos da fase
result.map          // origem do texto gerado
result.capabilities // transformações efetivamente aplicadas
```

`capabilities` evita uma declaração binária de compatibilidade. Um resultado poderia informar, por exemplo, `conditionalCompilation: true`, `includes: false` e `commands: false`.

### 2. Oferecer a visualização “Fonte × PPO didático”

Uma aba ou painel lado a lado seria valioso para ensino e diagnóstico:

- destacar linhas removidas por compilação condicional;
- mostrar uma macro e o texto resultante;
- revelar que um comando de alto nível vira chamada de função;
- navegar do diagnóstico no texto expandido de volta ao `.prw` ou `.ch` de origem;
- exportar o resultado para anexar a um caso de teste.

Essa visualização deve sempre exibir o rótulo **“PPO didático — subconjunto do emulador”** enquanto não houver equivalência verificada com o pré-processador TOTVS.

### 3. Implementar includes com resolução controlada

O próximo salto de fidelidade é resolver `.ch`, pois comandos e constantes reais dependem deles. O resolvedor deve:

- aceitar somente raízes de include configuradas;
- normalizar caminhos e impedir fuga dessas raízes;
- detectar ciclos de includes;
- registrar a pilha de inclusão;
- definir uma política determinística para nomes repetidos;
- produzir diagnóstico claro para arquivo ausente;
- funcionar no navegador por meio de um mapa/manifesto de arquivos, sem pressupor acesso livre ao disco.

O conteúdo dos includes não deve ser embutido silenciosamente no projeto sem observar licença e origem. Uma opção segura é permitir que o usuário forneça seus próprios headers e manter fixtures mínimas, autorais, para os testes.

### 4. Evoluir do mapa de linhas para proveniência por segmento

Quando uma linha de `.prw` expande uma regra declarada em `.ch`, o mapeamento 1:1 deixa de ser suficiente. O mapa precisa relacionar intervalos gerados com:

- arquivo, linha e coluna do uso no `.prw`;
- arquivo, linha e coluna da definição no `.ch`;
- tipo de transformação (`define`, `command`, `translate`, include ou SQL);
- cadeia de expansões, para macros aninhadas.

Isso melhora erros, depuração, inspeção visual e testes diferenciais.

### 5. Tratar `#command` e `#translate` como regras, não como substituição ingênua

Essas construções envolvem padrões, marcadores, partes opcionais e precedência. A expansão deve trabalhar com tokens e regras compiladas. Uma sequência segura de evolução é:

1. tokenizar preservando strings, comentários e continuação de linha;
2. representar cada regra como padrão e template de saída;
3. implementar marcadores simples e somente depois os opcionais/repetições;
4. estabelecer ordem, escopo e limite de expansão;
5. detectar ciclos e explosão de expansão;
6. guardar um *trace* de cada regra aplicada.

O scanner atual que protege strings e comentários é uma boa base, mas não basta para reproduzir a gramática de comandos.

### 6. Separar três níveis de compatibilidade

A matriz do projeto deve distinguir:

- **pré-processamento**: transforma o mesmo conjunto de construções?
- **compilação/análise**: aceita e diagnostica o texto resultante de modo comparável?
- **runtime**: reproduz efeitos, escopos, carregamento, memória, UI e dados?

Essa divisão impede que a aceitação de um fonte pelo pré-processador seja confundida com equivalência de execução. O projeto é hoje uma camada educacional no navegador, não uma máquina virtual do AppServer.

### 7. Usar PPO como instrumento de teste diferencial

Quando houver acesso legítimo a PPOs produzidos por uma ferramenta TOTVS, pares pequenos de `PRW → PPO` podem virar casos de caracterização. O teste deve comparar por construção, não apenas arquivos enormes:

- condicionais e símbolos externos;
- macros recursivas;
- um comando por fixture;
- continuação de linha;
- strings e comentários;
- includes aninhados;
- um bloco de Embedded SQL.

Diferenças devem ser classificadas como espaços/formatação, expansão semântica, proveniência ou diagnóstico. PPOs e headers proprietários não devem ser publicados no repositório sem autorização.

### 8. Inspirar o runtime sem fingir reproduzi-lo

O texto sobre o runtime sugere conceitos úteis para fases posteriores:

- contexto isolado por execução;
- carregamento de funções/dependências sob demanda;
- pilha de chamadas e ciclo de vida explícitos;
- cancelamento cooperativo entre blocos de instruções;
- separação entre AppServer (execução) e SmartClient (apresentação/interação);
- recursos liberados ao término do contexto;
- atenção a closures/codeblocks e referências circulares.

No navegador, isso pode se traduzir em uma `ExecutionSession` isolada, um registro de funções carregadas, limites de tempo/passos, cancelamento e um backend de UI que apenas consome eventos. São analogias arquiteturais; não constituem reprodução do protocolo, do escalonamento ou do gerenciamento de memória do AppServer.

## Prioridade recomendada

| Prioridade | Entrega | Motivo |
|---|---|---|
| P0 | documentar e rotular a saída atual como PPO didático parcial | corrige o modelo mental sem mudar semântica |
| P1 | painel Fonte × PPO e `capabilities` | torna a fase observável e testável |
| P1 | resolução controlada de includes e proveniência por arquivo | habilita headers e diagnósticos reais |
| P2 | tokenizer e subconjunto incremental de `#translate/#command` | amplia a compatibilidade de fontes Protheus |
| P2 | fixtures diferenciais PRW → PPO com origem autorizada | mede fidelidade em vez de presumir equivalência |
| P3 | transformação de Embedded SQL | importante, porém exige regras e runtime de dados próprios |
| P3 | sessões, carregamento sob demanda e cancelamento cooperativo | aproxima o modelo de execução sem depender do AppServer |
| fora do escopo atual | gerar bytecode APO ou ler/escrever RPO | formatos proprietários e objetivo distinto do emulador educacional |

## Decisões registradas

1. **PPO é a saída textual da pré-compilação**, não o resultado final da compilação.
2. O resultado atual do projeto é um **PPO didático parcial**, ainda sem compatibilidade declarada com o PPO TOTVS.
3. O pipeline continuará separando pré-processamento, análise sem efeitos, execução controlada e renderização.
4. Includes e regras de comando devem ser resolvidos antes do parser, com proveniência e limites de segurança.
5. Compatibilidade de pré-processador, compilador e runtime será medida e documentada separadamente.
6. PPOs reais serão usados somente como fixtures autorizadas e minimizadas; materiais proprietários não serão incorporados por conveniência.
7. APO/RPO e protocolo real do AppServer não fazem parte do escopo desta etapa.

## Fontes consultadas e limites do estudo

- Daniel Mendes, [“PPO — O que que é isso?”](https://medium.com/totvsdevelopers/ppo-o-que-que-%C3%A9-isso-2fb0ae4c133c), TOTVS Developers, 14 out. 2020. A página define PPO como o fonte AdvPL após a pré-compilação; a coleta pública do Medium não expôs todo o corpo do artigo durante este estudo.
- Júlio Wittwer, [“RunTime do AdvPL”](https://siga0984.wordpress.com/2016/02/02/runtime-do-advpl/), Tudo em AdvPL, 2 fev. 2016. É a principal fonte para a sequência fonte/includes → PPO → compilação → bytecode/RPO → execução e para o modelo conceitual de runtime.
- Júlio Wittwer, [arquivo da tag “Básico”](https://siga0984.wordpress.com/tag/basico/), Tudo em AdvPL. Foi usado como índice contextual; não é uma especificação normativa.
- TOTVS TDN, [“AdvPL”](https://tdn.totvs.com/display/tec/AdvPL). Confirma APOs como unidades compiladas mantidas em repositório e carregadas pelo Application Server.
- TOTVS TDN, [“Embedded SQL”](https://tdn.totvs.com/display/framework/Embedded%2BSQL). Fornece um exemplo oficial de fonte e do código gerado no PPO.
- TOTVS TDN, [“Estrutura da Linguagem”](https://tdn.totvs.com/display/framework/Estrutura%2Bda%2BLinguagem). Contextualiza diretivas do pré-processador como parte da estrutura dos programas AdvPL.

Os artigos de blog são explicações técnicas valiosas, mas não uma especificação formal e versionada do pré-processador. Detalhes de implementação podem variar entre versões das ferramentas e do AppServer. Por isso, as conclusões acima separam fatos documentados, analogias arquiteturais e propostas do projeto.
