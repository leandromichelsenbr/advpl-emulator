# Inventário de impressão do DANFEII

Fonte analisado: `danfeii.prw`, com 5.824 linhas físicas e 219.129 bytes, revisado em 22/03/2023. O arquivo foi usado somente como referência de compatibilidade; seu conteúdo não faz parte deste repositório.

## Perfil encontrado

O fluxo principal recebe um objeto de impressão pronto, configura um `FWMSPrinter` e desenha DANFE completo e simplificado. Também existe um caminho interno que instancia `FWMSPrinter():New("DANFE", IMP_SPOOL)` e abre `Setup()`.

| Categoria | Objeto, método ou propriedade | Ocorrências | Situação no emulador |
| --- | --- | ---: | --- |
| Motor | `FWMSPrinter():New()` | 1 | Implementado para exemplos simples; o arquivo completo ainda não é interpretável |
| Configuração | `SetResolution(78)` | 1 | Parcial: valor entra no modelo, sem calibração fiel de DPI |
| Configuração | `SetPortrait()` | 2 | Implementado |
| Configuração | `SetPaperSize(DMPAPER_A4)` | 1 | Implementado para A4 |
| Configuração | `SetMargin(60,60,60,60)` | 1 | Parcial: armazenado, mas não aplicado integralmente ao layout absoluto |
| Destino | `lServer`, `nDevice`, `cPathPDF`, `cPrinter` | 5 atribuições | Não implementado |
| Setup | `Setup()` e propriedades `oSetup` | 1 setup | Parcial: diálogo simulado, sem todas as propriedades e destinos |
| Saída | `Preview()` | 2 | Parcial: preview no navegador, sem equivalência completa com spool/PDF |
| Paginação | `StartPage()` | 7 | Reconhecido conceitualmente, mas sem fluxo multipágina real |
| Paginação | `EndPage()` | 8 | Reconhecido conceitualmente, mas sem fluxo multipágina real |
| Texto | `Say()` | 470 | Parcial: texto e coordenadas literais; expressões, fontes e alinhamentos complexos pendentes |
| Quadros | `Box()` | 222 | Parcial: retângulo simples; espessura, sobreposição e escala precisam de calibração |
| Código de barras | `Code128C()` | 16 | Não implementado |
| Imagem | `SayBitmap()` | 14 | Parcial: chamada analisada, mas bitmap local fica oculto |
| Tipografia | `TFontEx():New()` | 13 | Não implementado |

## Fontes utilizadas

Todas as 13 definições usam `Times New Roman`, com tamanhos entre 6 e 17 e variações normal/negrito. O fonte passa `oFontEx:oFont` para `Say()`. Para reprodução fiel, o modelo deve preservar família, largura, altura, negrito, sublinhado/itálico conforme a assinatura real e vincular a referência ao elemento de texto.

## Composição e dados

- Layout absoluto em uma grade aproximada de 603 unidades de largura e até 865 de altura.
- DANFE normal, DANFE simplificado, continuação e verso no mesmo fonte.
- Seções extensas formadas por quadros sobrepostos e textos posicionados.
- Colunas de itens calculadas dinamicamente por conteúdo e fonte.
- Paginação controlada por quantidade de itens e mensagens complementares.
- Logotipos do emitente e TOTVS carregados por caminhos/recursos externos.
- Chave da NF-e e contingência impressas em Code 128 C.
- Dados originados de XML da NF-e, arrays derivados e parâmetros do ambiente.
- Ramos condicionais para NFC-e, contingência, retirada, entrega, fatura, transporte, tributos, complemento e DANFE simplificado.

## Limitação estrutural atual

O analisador atual procura chamadas de impressão no texto inteiro. Em um fonte grande, isso mistura caminhos mutuamente exclusivos, repetições e diferentes páginas em uma única coleção. Antes de tentar renderizar o DANFE completo, o modelo de relatório precisa preservar:

1. ordem das instruções;
2. início e fim de cada página;
3. função chamada e caminho de execução escolhido;
4. variáveis, laços e condicionais necessários ao layout;
5. referências de fontes, imagens e dados.

## Critério de validação

O marco DANFE deverá usar um fixture reduzido e autorizado, dados fictícios de NF-e e um PDF/imagem de referência. A conclusão exige comparação de coordenadas, paginação, tipografia, quadros, logotipos e Code 128 C, sem depender de AppServer ou dados fiscais reais.
