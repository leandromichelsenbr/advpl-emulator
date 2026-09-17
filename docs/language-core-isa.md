# ISA e VM experimentais do Language Core

## Estado

A ISA `0.1` é uma representação própria, didática e stack-based. Não corresponde a APO, RPO, bytecode ou máquina virtual TOTVS. A versão 0.22.0 executa somente uma fatia sintética em paralelo ao executor leve; o playground não foi migrado.

## Artefato compilado

```js
{
  bytecodeVersion: "0.1",
  entry: "DEMO",
  constants: [],
  functions: {},
  diagnostics: []
}
```

Cada função declara quantidade de parâmetros/locais, slots estáveis e instruções. Cada instrução preserva `loc` da AST para trace e diagnósticos.

## Instruções 0.1

| Opcode | Efeito |
|---|---|
| `PUSH_CONST` | empilha uma constante |
| `LOAD_LOCAL` | empilha o valor de um slot local |
| `STORE_LOCAL` | remove e armazena o topo em um slot |
| `ADD` | soma números ou concatena quando algum operando não é numérico |
| `SUB`, `MUL`, `DIV` | operações numéricas |
| `EQ`, `NE` | igualdade e diferença estritas do recorte atual |
| `CALL_RUNTIME` | chama serviço nominal permitido e empilha seu retorno |
| `POP` | descarta o topo |
| `RETURN` | encerra o frame com o valor do topo |

Não existem ainda saltos, frames aninhados ou chamada de função AdvPL. Isso impede representar `If`, laços e funções auxiliares na VM nova.

## Runtime permitido

`advpl-core-runtime.js` registra explicitamente serviços. A fonte nunca é avaliada como JavaScript. O conjunto inicial contém:

- `CVALTOCHAR`: converte um valor para texto didático;
- `CONOUT`: registra um evento e uma linha de console.

Uma chamada ausente gera `LC_RUNTIME_UNKNOWN_CALL`. Integrações podem fornecer handlers adicionais por configuração do host, mas o código AdvPL não pode registrar JavaScript.

## Limites e diagnósticos

- `LC_RUNTIME_STEP_LIMIT`: teto de passos excedido;
- `LC_VM_STACK_UNDERFLOW`: bytecode tentou remover item inexistente;
- `LC_VM_UNKNOWN_OPCODE`: instrução desconhecida;
- `LC_VM_ENTRY`: função inicial ausente;
- `LC0301`–`LC0305`: falhas de compilação.

O limite padrão é 10.000 passos e pode ser reduzido pelo host. A VM devolve resultado e diagnósticos; não lança erros de fonte para fora do contrato.

## Evidência inicial

O teste de equivalência executa o mesmo PPO sintético no executor leve e na VM e compara `events` e `console`. A equivalência cobre somente a fatia testada, não toda a linguagem.
