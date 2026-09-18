# Contrato experimental da AST do Language Core

## Estado e objetivo

A AST `0.1` é um contrato experimental para iniciar o Language Core sobre texto PPO. Ela não substitui o executor leve, não representa a AST interna de `@totvs/tds-parsers` e não afirma compatibilidade com toda a gramática AdvPL. A evidência inicial é a fixture sintética `test/fixtures/ppo-input/message.ppo`; pares oficiais PRW/PPO continuam pendentes.

O módulo `src/advpl-language-core.js` separa três operações:

1. `tokenize(source, options)` cria tokens posicionados e diagnósticos léxicos;
2. `parse(source, options)` cria a AST sem executar efeitos;
3. `bind(program)` registra funções, parâmetros e variáveis locais sem resolver APIs Protheus.

## Envelope do programa

```js
{
  type: "Program",
  astVersion: "0.1",
  sourceType: "ppo",
  experimental: true,
  body: [],
  diagnostics: [],
  loc: { start, end }
}
```

Cada posição contém `file`, `line`, `column` e `offset`. Linhas e colunas começam em 1; offset começa em 0.

## Nós cobertos

| Nó | Cobertura inicial |
|---|---|
| `FunctionDeclaration` | `User Function` e `Static Function`, nome, parâmetros e corpo |
| `LocalDeclaration` | uma variável e inicializador opcional |
| `ReturnStatement` | retorno vazio ou com expressão |
| `ExpressionStatement` | chamada ou expressão em uma linha |
| `CallExpression` | identificador como callee e argumentos posicionais |
| `BinaryExpression` | `==`, `!=`, `+`, `-`, `*` e `/`, com precedência |
| `UnaryExpression` | sinais unários `+` e `-` |
| `IfStatement` | condição, bloco consequente e bloco alternativo opcional |
| `ParenthesizedExpression` | expressão explicitamente agrupada |
| `Identifier` | nome preservado como escrito |
| `Literal` | texto, número e `Nil` |

O parser cobre inicialmente `If`/`Else`/`EndIf`, inclusive blocos aninhados, e comparações `==`, `!=`, `<`, `<=`, `>` e `>=`. Ainda não cobre `ElseIf`, `For`, arrays, code blocks, métodos, atribuição geral, operadores completos ou construções visuais. Essas ausências são limitações, não interpretação aproximada.

## Binder inicial

O binder devolve uma tabela de funções e, para cada função, símbolos de parâmetros e locais. Duplicidades recebem `LC0201` ou `LC0202`. Chamadas como `MsgInfo` e `ConOut` não são declaradas implicitamente: a resolução de built-ins e APIs Protheus pertence aos futuros contratos do Core Runtime e da camada de compatibilidade.

## Relação com contratos existentes

- AST descreve o programa.
- Bytecode/ISA `0.1` descreve a primeira fatia experimental de execução; veja [ISA, compiler e VM](language-core-isa.md).
- Modelo intermediário `0.1` descreve a saída visual e eventos.
- AST do TDS continua encapsulada pelo adaptador opcional e não é exposta como este contrato.

O executor leve continua sendo o caminho de produção. As versões `0.22.0` e `0.23.0` entregam compiler/VM e equivalência para console e mensagem condicional. A migração só avançará capacidade por capacidade, com equivalência comprovada e sem retirar prematuramente o fallback atual.
