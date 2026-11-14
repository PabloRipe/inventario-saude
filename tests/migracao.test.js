const test = require("node:test");
const assert = require("node:assert/strict");
const { carregarGas } = require("./helpers/gas-loader.js");

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows || 1;
    this.numCols = numCols || 1;
  }

  getValues() {
    const saida = [];
    for (let r = 0; r < this.numRows; r++) {
      const linha = this.sheet.data[this.row - 1 + r] || [];
      const valores = [];
      for (let c = 0; c < this.numCols; c++) {
        valores.push(linha[this.col - 1 + c] === undefined ? "" : linha[this.col - 1 + c]);
      }
      saida.push(valores);
    }
    return saida;
  }

  setValue(valor) {
    this.sheet.garantir(this.row, this.col);
    this.sheet.data[this.row - 1][this.col - 1] = valor;
    return this;
  }

  setValues(valores) {
    valores.forEach((linha, r) => {
      linha.forEach((valor, c) => this.setValue.call(
        { sheet: this.sheet, row: this.row + r, col: this.col + c },
        valor
      ));
    });
    return this;
  }

  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
}

class FakeSheet {
  constructor(nome, data) {
    this.nome = nome;
    this.data = (data || []).map((linha) => linha.slice());
  }

  getName() { return this.nome; }

  garantir(row, col) {
    while (this.data.length < row) this.data.push([]);
    const linha = this.data[row - 1];
    while (linha.length < col) linha.push("");
  }

  getLastRow() { return this.data.length; }

  getLastColumn() {
    return Math.max(1, ...this.data.map((linha) => linha.length));
  }

  getDataRange() {
    return this.getRange(1, 1, Math.max(this.data.length, 1), this.getLastColumn());
  }

  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows || 1, numCols || 1);
  }

  appendRow(valores) {
    this.data.push(valores.slice());
  }

  setFrozenRows() {}
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = {};
    sheets.forEach((sheet) => { this.sheets[sheet.getName()] = sheet; });
  }
  getSheetByName(nome) { return this.sheets[nome] || null; }
  insertSheet(nome) {
    const sheet = new FakeSheet(nome, []);
    this.sheets[nome] = sheet;
    return sheet;
  }
}

function carregarMigracao(sheets) {
  const ss = new FakeSpreadsheet(sheets);
  return carregarGas(["Config.gs", "Formatos.gs", "Planilha.gs", "Migracao.gs"], {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Utilities: { formatDate: () => "27/07/2026", getUuid: () => "abcdef12-3456-7890-abcd-ef1234567890" },
    Session: { getScriptTimeZone: () => "America/Sao_Paulo" },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "" }) },
    ss
  });
}

test("migracao normaliza unidades, validade e IDs duplicados", () => {
  const enfermagem = new FakeSheet("Enfermagem", [
    ["ID_Insumo", "Nome", "Unidade_Base", "Tipo_Embalagem", "Fator_Conversao", "Estoque_Atual", "Estoque_Minimo", "Lote", "Validade"],
    ["E-41", "Soro A", 1, 1, 1, 10, 5, "", ""],
    ["E-41", "Soro B", "Unidade", "", 1, 5, 5, "", "2026-07-27"],
    ["E-06", "Cateter", "Unidade", "", 1, 2, 1, "", "1.0"]
  ]);
  const log = new FakeSheet("Log_Migracao", [
    ["Data_Hora", "Etapa", "Area", "ID_Insumo", "Campo", "Valor_Anterior", "Valor_Novo", "Detalhe"]
  ]);

  const gas = carregarMigracao([enfermagem, log]);
  const resumo = gas.resumoVazio_();
  gas.normalizarArea_("Enfermagem", resumo);

  const rows = enfermagem.data;
  assert.equal(rows[1][0], "E-41");
  assert.equal(rows[2][0], "E-41A");
  assert.equal(rows[1][2], "Unidade");
  assert.equal(rows[1][3], "");
  assert.equal(rows[3][8], "");
  assert.equal(resumo.duplicados.length, 1);
  assert.equal(resumo.duplicados[0].novoId, "E-41A");
  assert.equal(log.data.length > 1, true);
});

test("migracao adiciona colunas e converte datas e status", () => {
  const solicitacoes = new FakeSheet("Solicitacoes_Pendentes", [
    ["ID_Pedido", "Data_Hora", "Solicitante", "Setor", "Itens", "Status"],
    ["PED-6734", "2026-12-11 08:52:00", "Leydiane", "Plantonista", "[]", "Pendente"],
    ["PED-2652", "13/11/2026 15:41", "Izabella", "ESF Sede", "[]", "aprovado"]
  ]);
  const historico = new FakeSheet("Historico_Movimentacoes", [
    ["Data_Hora", "ID_Insumo", "Nome_Insumo", "Area", "Tipo", "Quantidade", "Lote_Validade", "Observacao"],
    ["2026-11-12 08:53:23", "E-11", "Luva", "Enfermagem", "BAIXA", 5, "-", ""]
  ]);
  const log = new FakeSheet("Log_Migracao", [
    ["Data_Hora", "Etapa", "Area", "ID_Insumo", "Campo", "Valor_Anterior", "Valor_Novo", "Detalhe"]
  ]);

  const gas = carregarMigracao([solicitacoes, historico, log]);
  const resumo = gas.resumoVazio_();

  gas.garantirColunas_(solicitacoes, gas.headersSolicitacoes_());
  gas.garantirColunas_(historico, gas.headersHistorico_());
  gas.normalizarSolicitacoes_(resumo);
  gas.normalizarHistorico_(resumo);

  assert.equal(solicitacoes.data[0].includes("Observacao"), true);
  assert.equal(solicitacoes.data[0].includes("Data_Status"), true);
  assert.equal(historico.data[0].includes("Usuario"), true);
  assert.equal(solicitacoes.data[1][5], "PENDENTE");
  assert.equal(solicitacoes.data[2][5], "APROVADO");
  assert.ok(solicitacoes.data[2][1] instanceof Date);
  assert.ok(historico.data[1][0] instanceof Date);
  assert.equal(resumo.datasConvertidas.length >= 2, true);
});
