/**
 * Acesso a planilha sempre por nome de cabecalho.
 * Nunca use indices fixos como data[i][5].
 */

function abrirPlanilha_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw erroApp_("PLANILHA_INDISPONIVEL", "Planilha nao encontrada.");
  return ss;
}

function existeAba_(nome) {
  return !!abrirPlanilha_().getSheetByName(nome);
}

function obterAba_(nome, obrigatoria) {
  var sheet = abrirPlanilha_().getSheetByName(nome);
  if (!sheet && obrigatoria !== false) {
    throw erroApp_("ABA_NAO_ENCONTRADA", "A aba \"" + nome + "\" nao foi encontrada. Execute a migracao.");
  }
  return sheet;
}

function normalizarCabecalhos_(headers) {
  return (headers || []).map(function (h) { return texto_(h); });
}

function lerAbaComoObjetos_(nome) {
  var sheet = obterAba_(nome);
  return lerSheetComoObjetos_(sheet);
}

function lerSheetComoObjetos_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    return { sheet: sheet, headers: [], rows: [] };
  }
  var headers = normalizarCabecalhos_(values[0]);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = values[i][j];
    }
    rows.push(obj);
  }
  return { sheet: sheet, headers: headers, rows: rows };
}

function obterHeaderIndex_(headers, nome, aba) {
  var alvo = texto_(nome);
  for (var i = 0; i < headers.length; i++) {
    if (texto_(headers[i]) === alvo) return i;
  }
  throw erroApp_(
    "ESTRUTURA_INVALIDA",
    "Coluna \"" + alvo + "\" nao encontrada" + (aba ? " na aba " + aba : "") + ". Execute a migracao."
  );
}

function garantirAba_(nome, headersDesejados) {
  var ss = abrirPlanilha_();
  var sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.getRange(1, 1, 1, headersDesejados.length).setValues([headersDesejados]);
    formatarCabecalho_(sheet, headersDesejados.length);
    sheet.setFrozenRows(1);
    return sheet;
  }
  garantirColunas_(sheet, headersDesejados);
  return sheet;
}

function garantirColunas_(sheet, headersDesejados) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = normalizarCabecalhos_(sheet.getRange(1, 1, 1, lastCol).getValues()[0]);
  var existentes = {};
  headers.forEach(function (h) {
    if (h) existentes[h] = true;
  });

  var adicionadas = [];
  headersDesejados.forEach(function (desejado) {
    if (!existentes[desejado]) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(desejado);
      existentes[desejado] = true;
      adicionadas.push(desejado);
    }
  });
  if (adicionadas.length) formatarCabecalho_(sheet, lastCol);
  return adicionadas;
}

function formatarCabecalho_(sheet, numColunas) {
  if (numColunas <= 0) return;
  sheet.getRange(1, 1, 1, numColunas)
    .setFontWeight("bold")
    .setBackground("#334155")
    .setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);
}

function appendObjeto_(sheet, headers, obj) {
  var row = headers.map(function (h) {
    var valor = obj[h];
    return valor === undefined || valor === null ? "" : valor;
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function atualizarCelulas_(sheet, rowNumber, headers, valores) {
  Object.keys(valores || {}).forEach(function (nome) {
    var idx = obterHeaderIndex_(headers, nome);
    sheet.getRange(rowNumber, idx + 1).setValue(valores[nome]);
  });
}

function buscarLinhasPorId_(sheet, headers, colunaId, id) {
  var idx = obterHeaderIndex_(headers, colunaId);
  var values = sheet.getDataRange().getValues();
  var alvo = texto_(id).toUpperCase();
  var encontrados = [];
  for (var i = 1; i < values.length; i++) {
    if (texto_(values[i][idx]).toUpperCase() === alvo) {
      encontrados.push({ row: i + 1, values: values[i] });
    }
  }
  return encontrados;
}

function listarNomesUnicos_(nomeAba, nomeColuna) {
  var sheet = obterAba_(nomeAba, false);
  if (!sheet) return [];
  var dados = lerSheetComoObjetos_(sheet);
  if (!dados.headers.length) return [];
  var idx = -1;
  for (var i = 0; i < dados.headers.length; i++) {
    if (texto_(dados.headers[i]).toUpperCase() === texto_(nomeColuna).toUpperCase()) {
      idx = i;
      break;
    }
  }
  if (idx === -1) idx = 0;
  var vistos = {};
  var nomes = [];
  dados.rows.forEach(function (row) {
    var nome = texto_(row[dados.headers[idx]]);
    var chave = nome.toUpperCase();
    if (nome && !vistos[chave]) {
      vistos[chave] = true;
      nomes.push(nome);
    }
  });
  nomes.sort(function (a, b) { return a.localeCompare(b, "pt-BR", { sensitivity: "base" }); });
  return nomes;
}

function registrarLogMigracao_(etapa, area, idInsumo, campo, anterior, novo, detalhe) {
  var sheet = obterAba_(CONFIG.SHEETS.logMigracao, false);
  if (!sheet) return;
  var headers = normalizarCabecalhos_(sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]);
  var obj = {};
  obj[CONFIG.COLUNAS.log.data] = new Date();
  obj[CONFIG.COLUNAS.log.etapa] = etapa;
  obj[CONFIG.COLUNAS.log.area] = area || "";
  obj[CONFIG.COLUNAS.log.id] = idInsumo || "";
  obj[CONFIG.COLUNAS.log.campo] = campo || "";
  obj[CONFIG.COLUNAS.log.anterior] = anterior === undefined || anterior === null ? "" : String(anterior);
  obj[CONFIG.COLUNAS.log.novo] = novo === undefined || novo === null ? "" : String(novo);
  obj[CONFIG.COLUNAS.log.detalhe] = detalhe || "";
  appendObjeto_(sheet, headers, obj);
}

/**
 * Garante que a migracao ja criou as colunas usadas pelas gravacoes.
 * Evita baixa de estoque seguida de falha ao gravar auditoria.
 */
function exigirEstruturaAtualizada_() {
  var ss = abrirPlanilha_();
  var faltantes = [];

  var verificacoes = [
    { nome: CONFIG.SHEETS.solicitacoes, headers: headersSolicitacoes_() },
    { nome: CONFIG.SHEETS.historico, headers: headersHistorico_() }
  ];

  CONFIG.AREAS.forEach(function (area) {
    verificacoes.push({ nome: area, headers: headersEstoque_() });
  });

  verificacoes.forEach(function (item) {
    var sheet = ss.getSheetByName(item.nome);
    if (!sheet) {
      faltantes.push(item.nome + " (aba ausente)");
      return;
    }
    var dados = lerSheetComoObjetos_(sheet);
    item.headers.forEach(function (header) {
      if (dados.headers.indexOf(header) === -1) faltantes.push(item.nome + ":" + header);
    });

    if (CONFIG.AREAS.indexOf(item.nome) !== -1) {
      var vistos = {};
      dados.rows.forEach(function (row) {
        var id = texto_(row[CONFIG.COLUNAS.estoque.id]).toUpperCase();
        if (!id) return;
        if (vistos[id]) {
          faltantes.push(item.nome + ":ID duplicado " + id);
        } else {
          vistos[id] = true;
        }
      });
    }
  });

  if (faltantes.length) {
    throw erroApp_(
      "MIGRACAO_NECESSARIA",
      "A estrutura da planilha ainda nao foi atualizada. Abra a planilha e use o menu Inventário Saúde > Executar migração.",
      faltantes
    );
  }
}
