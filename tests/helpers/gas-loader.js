const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const raiz = path.resolve(__dirname, "..", "..");

function carregarGas(arquivos, globais) {
  const sandbox = Object.assign({
    console: console,
    JSON: JSON,
    Math: Math,
    Date: Date
  }, globais || {});

  vm.createContext(sandbox);
  arquivos.forEach((arquivo) => {
    const caminho = path.join(raiz, "gas", arquivo);
    vm.runInContext(fs.readFileSync(caminho, "utf8"), sandbox, { filename: caminho });
  });
  return sandbox;
}

function gasPadrao() {
  return carregarGas(["Config.gs", "Formatos.gs", "Validacao.gs"], {
    Utilities: {
      formatDate: () => "20261114",
      getUuid: () => "abcdef12-3456-7890-abcd-ef1234567890"
    },
    Session: {
      getScriptTimeZone: () => "America/Sao_Paulo"
    }
  });
}

module.exports = { carregarGas, gasPadrao, raiz };
