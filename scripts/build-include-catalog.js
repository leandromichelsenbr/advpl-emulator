/* Gera somente o índice; o conteúdo dos headers permanece em arquivos separados. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../vendor/protheus-includes/include");
const target = path.resolve(__dirname, "../vendor/protheus-includes/catalog.json");
const files = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.ch$/i.test(entry.name))
  .map(entry => entry.name)
  .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));

const catalog = {
  version: "2016-06-05",
  upstream: "https://github.com/imsys/Protheus-Include",
  commit: "7b56abf9727694f6d91eb3e0be42104d184a1f83",
  files: Object.fromEntries(files.map(name => [name.toUpperCase(), name]))
};

fs.writeFileSync(target, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Catálogo criado com ${files.length} headers.`);
