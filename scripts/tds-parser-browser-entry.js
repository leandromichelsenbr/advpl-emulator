const { parser_token_advpl } = require("@totvs/tds-parsers/lib/parser");

function parser(source) {
  return parser_token_advpl(source);
}

module.exports = { parser };
