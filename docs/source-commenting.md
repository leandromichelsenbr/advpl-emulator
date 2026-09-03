# Comentários didáticos nos fontes

Os módulos internos devem ser escritos também como material de estudo. O leitor deve conseguir entender não apenas **o que** o código faz, mas **por que** a solução foi estruturada daquela maneira, quais estados percorre, que invariantes protege e quais limitações foram aceitas. Comentários podem ser detalhados e extensos sempre que ajudarem a reconstruir o raciocínio do desenvolvimento.

Não é necessário traduzir instruções triviais como `index += 1`. Em algoritmos densos, porém, deve-se explicar o papel desse avanço dentro da máquina de estados, as condições que já foram consumidas e o motivo de não usar uma expressão regular única, por exemplo.

## Comentar

- o propósito do módulo e sua posição no fluxo;
- contratos de entrada, saída e estados especiais;
- motivos de segurança, compatibilidade ou desempenho;
- estratégias de fallback e controle de concorrência;
- limitações conscientes e diferenças em relação ao AdvPL real;
- funções internas cujo nome não explica completamente o algoritmo.
- o formato e o significado das estruturas de dados intermediárias;
- exemplos curtos de como uma entrada atravessa o algoritmo;
- invariantes que precisam permanecer verdadeiros durante loops e recursões;
- decisões que preservam compatibilidade com versões anteriores;
- alternativas consideradas e por que não foram usadas quando isso for instrutivo;
- pontos em que uma implementação didática difere de um compilador ou runtime de produção.

## Nível de detalhe esperado

- Todo módulo arquitetural começa com uma visão geral de sua responsabilidade e de sua posição no fluxo.
- Toda função pública documenta entrada, saída, efeitos observáveis, erros e estados especiais.
- Algoritmos com recursão, pilha, scanner, concorrência ou normalização descrevem seu funcionamento em etapas.
- Estruturas como `conditions`, `trail`, `events` e mapas de origem explicam o significado de cada campo.
- Limitações relevantes aparecem perto do código e também na documentação ou no backlog.
- O comentário deve ensinar conceitos reutilizáveis: envelope, discriminador, máquina de estados, pilha, detecção de ciclos, fallback e controle de concorrência.

## Evitar

- repetir literalmente a instrução seguinte;
- manter comentários que descrevem comportamento antigo;
- chamar um diagnóstico local de compilação oficial;
- esconder limitações importantes em comentários sem registrá-las também na documentação ou no backlog.

Comentários de contrato usam o formato `/** ... */`. Visões gerais de módulo podem usar blocos `/* ... */`. Notas locais curtas usam `//`. Cada mudança funcional deve revisar os comentários próximos para evitar documentação divergente do comportamento. Código correto com comentário desatualizado é considerado incompleto.
