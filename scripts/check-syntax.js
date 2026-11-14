const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
let falhas = 0;

function listar(diretorio, extensao) {
  const base = path.join(root, diretorio);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter((nome) => nome.endsWith(extensao))
    .map((nome) => path.join(base, nome));
}

function checarScript(caminho, conteudo) {
  try {
    new vm.Script(conteudo || fs.readFileSync(caminho, "utf8"), { filename: caminho });
    return true;
  } catch (err) {
    falhas += 1;
    console.error("ERRO DE SINTAXE:", path.relative(root, caminho));
    console.error(err.message);
    return false;
  }
}

function checarModulo(caminho) {
  const temp = path.join(os.tmpdir(), "inventario-check-" + Date.now() + "-" + Math.random().toString(16).slice(2) + ".mjs");
  try {
    fs.writeFileSync(temp, fs.readFileSync(caminho, "utf8"), "utf8");
    const resultado = spawnSync(process.execPath, ["--check", temp], { encoding: "utf8" });
    if (resultado.status !== 0) {
      falhas += 1;
      console.error("ERRO DE SINTAXE:", path.relative(root, caminho));
      console.error((resultado.stderr || "").trim());
      return false;
    }
    return true;
  } finally {
    try { fs.unlinkSync(temp); } catch (e) { /* ignorar */ }
  }
}

function checarJson(caminho) {
  try {
    JSON.parse(fs.readFileSync(caminho, "utf8"));
    return true;
  } catch (err) {
    falhas += 1;
    console.error("JSON INVALIDO:", path.relative(root, caminho));
    console.error(err.message);
    return false;
  }
}

function checarHtmlComScript(caminho) {
  const html = fs.readFileSync(caminho, "utf8");
  const regex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let indice = 0;
  while ((match = regex.exec(html)) !== null) {
    indice += 1;
    let conteudo = match[1];
    if (conteudo.indexOf("<?") !== -1) {
      conteudo = conteudo.replace(/<\?[\s\S]*?\?>/g, "null");
    }
    if (!conteudo.trim()) continue;
    if (!checarScript(caminho + "#script" + indice, conteudo)) return false;
  }
  return true;
}

const gs = listar("gas", ".gs");
const js = listar(path.join("assets", "js"), ".js");
const jsAdicionais = listar(path.join("tests"), ".js").concat(listar(path.join("scripts"), ".js"));
const htmlAdmin = listar("gas", ".html").filter((nome) => /Admin/.test(nome));

gs.forEach((arquivo) => checarScript(arquivo));
js.forEach(checarModulo);
jsAdicionais.forEach((arquivo) => checarScript(arquivo));
htmlAdmin.forEach(checarHtmlComScript);
["package.json", ".clasp.json", path.join("gas", "appsscript.json")].forEach(checarJson);

if (falhas > 0) {
  console.error("\n" + falhas + " arquivo(s) com erro.");
  process.exit(1);
}

console.log(
  "Sintaxe OK: " + gs.length + " arquivos .gs, " + js.length + " modulos JS, " +
  htmlAdmin.length + " HTML do Admin e JSON/config."
);
