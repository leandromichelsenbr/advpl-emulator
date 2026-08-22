(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  root.AdvPLSampleData = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const tables = {
    SA1: [
      { A1_COD: "000001", A1_LOJA: "01", A1_NOME: "CLIENTE EXEMPLO 001" },
      { A1_COD: "000002", A1_LOJA: "01", A1_NOME: "CLIENTE EXEMPLO 002" },
      { A1_COD: "000003", A1_LOJA: "02", A1_NOME: "CLIENTE EXEMPLO 003" },
      { A1_COD: "000004", A1_LOJA: "01", A1_NOME: "CLIENTE EXEMPLO 004" },
      { A1_COD: "000005", A1_LOJA: "03", A1_NOME: "CLIENTE EXEMPLO 005" }
    ],
    SB1: [
      { B1_COD: "PROD001", B1_DESC: "PRODUTO EXEMPLO 001", B1_TIPO: "PA" },
      { B1_COD: "PROD002", B1_DESC: "PRODUTO EXEMPLO 002", B1_TIPO: "MP" },
      { B1_COD: "PROD003", B1_DESC: "PRODUTO EXEMPLO 003", B1_TIPO: "PA" }
    ],
    SBM: [
      { BM_GRUPO: "0001", BM_DESC: "GRUPO EXEMPLO 001" },
      { BM_GRUPO: "0002", BM_DESC: "GRUPO EXEMPLO 002" },
      { BM_GRUPO: "0003", BM_DESC: "GRUPO EXEMPLO 003" }
    ]
  };

  return Object.freeze({ version: "1.0.0", tables: Object.freeze(tables) });
});
