/**
 * Migracao idempotente da planilha.
 * Sempre cria backup antes de alterar dados reais.
 */

function criarBackupPlanilha() {
  var ss = abrirPlanilha_();
  var pasta = obterOuCriarSubpasta_(CONFIG.DRIVE.backups);
  var nome = "Inventario_Saude_BACKUP_" + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd_HHmmss"
  );
  var copia = DriveApp.getFileById(ss.getId()).makeCopy(nome, pasta);
  return { id: copia.getId(), url: copia.getUrl(), nome: nome };
}

function resumoVazio_() {
  return {
    modo: "execucao",
    inicio: formatarDataHora_(new Date()),
    fim: "",
    backup: "",
    abasCriadas: [],
    colunasAdicionadas: [],
    duplicados: [],
    unidadesCorrigidas: [],
    embalagensCorrigidas: [],
    validadesCorrigidas: [],
    datasConvertidas: [],
    statusNormalizados: [],
    adminsCriados: [],
    pastasDrive: null,
    avisos: []
  };
}

function simularMigracao() {
  return analisarMigracao_();
}

function analisarMigracao_() {
  var ss = abrirPlanilha_();
  var resumo = {
    modo: "simulacao",
    inicio: formatarDataHora_(new Date()),
    abasFaltantes: [],
    areas: [],
    solicitacoes: null,
    historico: null,
    admins: null,
    avisos: []
  };

  var abasObrigatorias = [CONFIG.SHEETS.solicitacoes, CONFIG.SHEETS.historico];
  abasObrigatorias.forEach(function (nome) {
    if (!ss.getSheetByName(nome)) resumo.abasFaltantes.push(nome);
  });
  CONFIG.AREAS.forEach(function (area) {
    if (!ss.getSheetByName(area)) resumo.abasFaltantes.push(area);
  });
  if (!ss.getSheetByName(CONFIG.SHEETS.admins)) resumo.abasFaltantes.push(CONFIG.SHEETS.admins);
  if (!ss.getSheetByName(CONFIG.SHEETS.logMigracao)) resumo.abasFaltantes.push(CONFIG.SHEETS.logMigracao);

  CONFIG.AREAS.forEach(function (area) {
    var sheet = ss.getSheetByName(area);
    if (!sheet) return;
    var dados = lerSheetComoObjetos_(sheet);
    var col = CONFIG.COLUNAS.estoque;
    var ids = {};
    var unidades = [];
    var embalagens = [];
    var validades = [];
    var estoquesInvalidos = [];

    dados.rows.forEach(function (row) {
      var id = texto_(row[col.id]);
      if (id) {
        var chave = id.toUpperCase();
        if (!ids[chave]) ids[chave] = [];
        ids[chave].push({ id: id, nome: texto_(row[col.nome]), row: row._row });
      }
      var unidade = row[col.unidade];
      if (texto_(unidade) === "" || /^-?\d+([.,]\d+)?$/.test(texto_(unidade))) {
        unidades.push({ id: id, valor: unidade, row: row._row });
      }
      if (/^-?\d+([.,]\d+)?$/.test(texto_(row[col.embalagem]))) {
        embalagens.push({ id: id, valor: row[col.embalagem], row: row._row });
      }
      var validade = row[col.validade];
      if (texto_(validade) && !normalizarData_(validade)) {
        validades.push({ id: id, valor: validade, row: row._row });
      }
      var atual = row[col.atual];
      var minimo = row[col.minimo];
      if (texto_(atual) !== "" && !isFinite(Number(atual))) {
        estoquesInvalidos.push({ id: id, campo: col.atual, valor: atual, row: row._row });
      }
      if (texto_(minimo) !== "" && !isFinite(Number(minimo))) {
        estoquesInvalidos.push({ id: id, campo: col.minimo, valor: minimo, row: row._row });
      }
    });

    var duplicados = Object.keys(ids).filter(function (k) { return ids[k].length > 1; }).map(function (k) {
      return ids[k];
    });

    resumo.areas.push({
      area: area,
      itens: dados.rows.filter(function (r) { return !!texto_(r[col.id]); }).length,
      duplicados: duplicados,
      unidades: unidades,
      embalagens: embalagens,
      validades: validades,
      estoquesInvalidos: estoquesInvalidos
    });
  });

  var solicitacoes = ss.getSheetByName(CONFIG.SHEETS.solicitacoes);
  if (solicitacoes) {
    var sDados = lerSheetComoObjetos_(solicitacoes);
    var sc = CONFIG.COLUNAS.solicitacoes;
    var datasTexto = [];
    var status = [];
    sDados.rows.forEach(function (row) {
      if (texto_(row[sc.data]) && !(row[sc.data] instanceof Date)) {
        datasTexto.push({ id: texto_(row[sc.id]), valor: row[sc.data], row: row._row });
      }
      var st = texto_(row[sc.status]);
      if (st && st !== st.toUpperCase()) status.push({ id: texto_(row[sc.id]), valor: st, row: row._row });
    });
    resumo.solicitacoes = {
      total: sDados.rows.length,
      datasTexto: datasTexto,
      statusNormalizar: status,
      colunasFaltantes: headersSolicitacoes_().filter(function (h) {
        return sDados.headers.indexOf(h) === -1;
      })
    };
  }

  var historico = ss.getSheetByName(CONFIG.SHEETS.historico);
  if (historico) {
    var hDados = lerSheetComoObjetos_(historico);
    var hc = CONFIG.COLUNAS.historico;
    var hDatasTexto = [];
    hDados.rows.forEach(function (row) {
      if (texto_(row[hc.data]) && !(row[hc.data] instanceof Date)) {
        hDatasTexto.push({ id: texto_(row[hc.id]), valor: row[hc.data], row: row._row });
      }
    });
    resumo.historico = {
      total: hDados.rows.length,
      datasTexto: hDatasTexto,
      colunasFaltantes: headersHistorico_().filter(function (h) {
        return hDados.headers.indexOf(h) === -1;
      })
    };
  }

  var admins = ss.getSheetByName(CONFIG.SHEETS.admins);
  resumo.admins = {
    existe: !!admins,
    total: admins ? Math.max(admins.getLastRow() - 1, 0) : 0,
    bootstrapConfigurado: !!texto_(obterBootstrapEmail_())
  };
  if (!texto_(obterBootstrapEmail_())) {
    resumo.avisos.push("ADMIN_BOOTSTRAP_EMAIL nao configurado. O painel ficara sem administrador.");
  }

  resumo.fim = formatarDataHora_(new Date());
  return resumo;
}

function obterBootstrapEmail_() {
  var email = texto_(CONFIG.ADMIN_BOOTSTRAP_EMAIL);
  if (email) return email;
  try {
    return texto_(PropertiesService.getScriptProperties().getProperty("ADMIN_BOOTSTRAP_EMAIL"));
  } catch (e) {
    return "";
  }
}

function migrarEstrutura() {
  var resumo = resumoVazio_();
  var backup = criarBackupPlanilha();
  resumo.backup = backup.url;
  resumo.avisos.push("Backup criado: " + backup.url);

  var ss = abrirPlanilha_();

  if (!ss.getSheetByName(CONFIG.SHEETS.admins)) {
    garantirAba_(CONFIG.SHEETS.admins, headersAdmins_());
    resumo.abasCriadas.push(CONFIG.SHEETS.admins);
  } else {
    var addAdmins = garantirColunas_(ss.getSheetByName(CONFIG.SHEETS.admins), headersAdmins_());
    addAdmins.forEach(function (c) { resumo.colunasAdicionadas.push(CONFIG.SHEETS.admins + ":" + c); });
  }

  if (!ss.getSheetByName(CONFIG.SHEETS.logMigracao)) {
    garantirAba_(CONFIG.SHEETS.logMigracao, headersLogMigracao_());
    resumo.abasCriadas.push(CONFIG.SHEETS.logMigracao);
  } else {
    var addLog = garantirColunas_(ss.getSheetByName(CONFIG.SHEETS.logMigracao), headersLogMigracao_());
    addLog.forEach(function (c) { resumo.colunasAdicionadas.push(CONFIG.SHEETS.logMigracao + ":" + c); });
  }

  CONFIG.AREAS.forEach(function (area) {
    var sheet = ss.getSheetByName(area);
    if (!sheet) {
      resumo.avisos.push("Area ausente: " + area);
      return;
    }
    var adicionadas = garantirColunas_(sheet, headersEstoque_());
    adicionadas.forEach(function (c) { resumo.colunasAdicionadas.push(area + ":" + c); });
    normalizarArea_(area, resumo);
  });

  var solSheet = ss.getSheetByName(CONFIG.SHEETS.solicitacoes);
  if (solSheet) {
    var addSol = garantirColunas_(solSheet, headersSolicitacoes_());
    addSol.forEach(function (c) { resumo.colunasAdicionadas.push(CONFIG.SHEETS.solicitacoes + ":" + c); });
    normalizarSolicitacoes_(resumo);
  } else {
    resumo.avisos.push("Aba ausente: " + CONFIG.SHEETS.solicitacoes);
  }

  var histSheet = ss.getSheetByName(CONFIG.SHEETS.historico);
  if (histSheet) {
    var addHist = garantirColunas_(histSheet, headersHistorico_());
    addHist.forEach(function (c) { resumo.colunasAdicionadas.push(CONFIG.SHEETS.historico + ":" + c); });
    normalizarHistorico_(resumo);
  } else {
    resumo.avisos.push("Aba ausente: " + CONFIG.SHEETS.historico);
  }

  var bootstrap = obterBootstrapEmail_();
  if (bootstrap) {
    if (garantirAdminPorEmail_(bootstrap, "Administrador")) {
      resumo.adminsCriados.push(bootstrap);
    }
  } else {
    resumo.avisos.push("ADMIN_BOOTSTRAP_EMAIL vazio. Adicione um e-mail na aba Admins antes de usar o painel.");
  }

  try {
    resumo.pastasDrive = configurarPastasDrive_();
  } catch (err) {
    logErro_("migrarEstrutura/pastasDrive", err);
    resumo.avisos.push("Nao foi possivel configurar as pastas do Drive: " + mensagemPublica_(err));
  }

  resumo.fim = formatarDataHora_(new Date());
  registrarLogMigracao_(
    "MIGRACAO_CONCLUIDA",
    "",
    "",
    "",
    "",
    "",
    JSON.stringify({
      backup: backup.url,
      duplicados: resumo.duplicados.length,
      unidades: resumo.unidadesCorrigidas.length,
      datas: resumo.datasConvertidas.length
    })
  );
  return resumo;
}

function normalizarArea_(area, resumo) {
  var sheet = obterAba_(area);
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.estoque;
  var headers = dados.headers;
  var idx = {};
  Object.keys(col).forEach(function (k) { idx[k] = obterHeaderIndex_(headers, col[k], area); });

  var ids = {};

  dados.rows.forEach(function (row) {
    var rowNumber = row._row;
    var idOriginal = texto_(row[col.id]);
    var id = idOriginal;
    var nome = texto_(row[col.nome]);
    var unidade = normalizarUnidade_(row[col.unidade]);
    var embalagemBruta = texto_(row[col.embalagem]);
    var embalagem = /^-?\d+([.,]\d+)?$/.test(embalagemBruta) ? "" : embalagemBruta;
    var atual = numero_(row[col.atual]);
    var minimo = numero_(row[col.minimo]);
    var lote = texto_(row[col.lote]);
    var validade = row[col.validade];

    if (!id) {
      resumo.avisos.push(area + ": linha " + rowNumber + " sem ID_Insumo.");
      return;
    }

    if (id !== idOriginal) {
      sheet.getRange(rowNumber, idx.id + 1).setValue(id);
      registrarLogMigracao_("ID_TRIM", area, id, col.id, idOriginal, id, "Espacos removidos");
    }
    if (nome !== texto_(row[col.nome])) {
      sheet.getRange(rowNumber, idx.nome + 1).setValue(nome);
      registrarLogMigracao_("NOME_TRIM", area, id, col.nome, row[col.nome], nome, "Espacos removidos");
    }
    if (unidade !== texto_(row[col.unidade])) {
      sheet.getRange(rowNumber, idx.unidade + 1).setValue(unidade);
      resumo.unidadesCorrigidas.push({ area: area, id: id, anterior: row[col.unidade], novo: unidade });
      registrarLogMigracao_("UNIDADE", area, id, col.unidade, row[col.unidade], unidade, "Normalizada");
    }
    if (embalagem !== texto_(row[col.embalagem])) {
      sheet.getRange(rowNumber, idx.embalagem + 1).setValue(embalagem);
      resumo.embalagensCorrigidas.push({ area: area, id: id, anterior: row[col.embalagem], novo: embalagem });
      registrarLogMigracao_("EMBALAGEM", area, id, col.embalagem, row[col.embalagem], embalagem, "Normalizada");
    }
    var rawAtual = texto_(row[col.atual]);
    if (rawAtual !== "" && !/^-?\d+([.,]\d+)?$/.test(rawAtual)) {
      resumo.avisos.push(area + ": estoque invalido em " + id + " (" + rawAtual + "). Valor mantido para revisao.");
    } else if (rawAtual !== "" && atual !== Number(rawAtual.replace(",", "."))) {
      sheet.getRange(rowNumber, idx.atual + 1).setValue(atual);
      registrarLogMigracao_("ESTOQUE", area, id, col.atual, row[col.atual], atual, "Convertido para numero");
    }
    var rawMinimo = texto_(row[col.minimo]);
    if (rawMinimo !== "" && !/^-?\d+([.,]\d+)?$/.test(rawMinimo)) {
      resumo.avisos.push(area + ": estoque minimo invalido em " + id + " (" + rawMinimo + "). Valor mantido para revisao.");
    } else if (rawMinimo !== "" && minimo !== Number(rawMinimo.replace(",", "."))) {
      sheet.getRange(rowNumber, idx.minimo + 1).setValue(minimo);
      registrarLogMigracao_("MINIMO", area, id, col.minimo, row[col.minimo], minimo, "Convertido para numero");
    }
    if (lote !== texto_(row[col.lote])) {
      sheet.getRange(rowNumber, idx.lote + 1).setValue(lote);
    }

    if (texto_(validade)) {
      var validadeNormalizada = normalizarData_(validade);
      if (!validadeNormalizada) {
        sheet.getRange(rowNumber, idx.validade + 1).setValue("");
        resumo.validadesCorrigidas.push({ area: area, id: id, anterior: validade, novo: "" });
        registrarLogMigracao_("VALIDADE", area, id, col.validade, validade, "", "Valor invalido removido");
      } else if (!(validade instanceof Date) || validade.getTime() !== validadeNormalizada.getTime()) {
        var cell = sheet.getRange(rowNumber, idx.validade + 1);
        cell.setValue(validadeNormalizada);
        cell.setNumberFormat("dd/MM/yyyy");
        resumo.datasConvertidas.push({ area: area, id: id, campo: col.validade, anterior: validade });
        registrarLogMigracao_("VALIDADE", area, id, col.validade, validade, formatarData_(validadeNormalizada), "Convertida para data");
      }
    }

    var chave = id.toUpperCase();
    if (!ids[chave]) ids[chave] = [];
    ids[chave].push({ id: id, nome: nome, row: rowNumber });
  });

  Object.keys(ids).forEach(function (chave) {
    var lista = ids[chave];
    if (lista.length <= 1) return;

    var usados = {};
    Object.keys(ids).forEach(function (k) { usados[k] = true; });

    for (var i = 1; i < lista.length; i++) {
      var atualItem = lista[i];
      var novoId = gerarIdComSufixo_(atualItem.id, usados);
      sheet.getRange(atualItem.row, idx.id + 1).setValue(novoId);
      usados[novoId.toUpperCase()] = true;
      resumo.duplicados.push({
        area: area,
        idOriginal: atualItem.id,
        nome: atualItem.nome,
        linha: atualItem.row,
        novoId: novoId
      });
      registrarLogMigracao_(
        "ID_DUPLICADO",
        area,
        novoId,
        col.id,
        atualItem.id,
        novoId,
        "ID duplicado renomeado. Produto: " + atualItem.nome
      );
    }
  });

  sheet.getRange(2, idx.validade + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat("dd/MM/yyyy");
}

function gerarIdComSufixo_(id, usados) {
  var base = texto_(id);
  var letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (var i = 0; i < letras.length; i++) {
    var candidato = base + letras.charAt(i);
    if (!usados[candidato.toUpperCase()]) return candidato;
  }
  return base + String(Date.now()).slice(-4);
}

function normalizarSolicitacoes_(resumo) {
  var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.solicitacoes;
  var idx = {};
  Object.keys(col).forEach(function (k) { idx[k] = obterHeaderIndex_(dados.headers, col[k], CONFIG.SHEETS.solicitacoes); });

  dados.rows.forEach(function (row) {
    var rowNumber = row._row;
    var id = texto_(row[col.id]);
    var status = texto_(row[col.status]).toUpperCase();
    if (status !== texto_(row[col.status])) {
      sheet.getRange(rowNumber, idx.status + 1).setValue(status);
      resumo.statusNormalizados.push({ id: id, anterior: row[col.status], novo: status });
    }
    var data = row[col.data];
    if (texto_(data) && !(data instanceof Date)) {
      var convertida = normalizarData_(data);
      if (!convertida) {
        resumo.avisos.push("Pedido " + id + " com data invalida: " + data);
      } else {
        var cellData = sheet.getRange(rowNumber, idx.data + 1);
        cellData.setValue(convertida);
        cellData.setNumberFormat("dd/MM/yyyy HH:mm");
        resumo.datasConvertidas.push({ area: CONFIG.SHEETS.solicitacoes, id: id, campo: col.data, anterior: data });
      }
    }
    var dataStatus = row[col.dataStatus];
    if (texto_(dataStatus) && !(dataStatus instanceof Date)) {
      var convertidaStatus = normalizarData_(dataStatus);
      if (convertidaStatus) {
        var cellStatus = sheet.getRange(rowNumber, idx.dataStatus + 1);
        cellStatus.setValue(convertidaStatus);
        cellStatus.setNumberFormat("dd/MM/yyyy HH:mm");
      }
    }
  });

  sheet.getRange(2, idx.data + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sheet.getRange(2, idx.dataStatus + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat("dd/MM/yyyy HH:mm");
}

function normalizarHistorico_(resumo) {
  var sheet = obterAba_(CONFIG.SHEETS.historico);
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.historico;
  var idx = {};
  Object.keys(col).forEach(function (k) { idx[k] = obterHeaderIndex_(dados.headers, col[k], CONFIG.SHEETS.historico); });

  dados.rows.forEach(function (row) {
    var data = row[col.data];
    if (texto_(data) && !(data instanceof Date)) {
      var convertida = normalizarData_(data);
      if (convertida) {
        var cell = sheet.getRange(row._row, idx.data + 1);
        cell.setValue(convertida);
        cell.setNumberFormat("dd/MM/yyyy HH:mm");
        resumo.datasConvertidas.push({
          area: CONFIG.SHEETS.historico,
          id: texto_(row[col.id]),
          campo: col.data,
          anterior: data
        });
      } else {
        resumo.avisos.push("Historico com data invalida na linha " + row._row + ": " + data);
      }
    }
  });

  sheet.getRange(2, idx.data + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sheet.getRange(2, idx.validade + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat("dd/MM/yyyy");
}

function menuSimularMigracao() {
  try {
    var resumo = simularMigracao();
    SpreadsheetApp.getUi().alert(
      "Simulação concluída.\n\n" +
      "Abas faltantes: " + resumo.abasFaltantes.length + "\n" +
      "Áreas analisadas: " + resumo.areas.length + "\n" +
      "Duplicados: " + resumo.areas.reduce(function (t, a) { return t + a.duplicados.length; }, 0) + "\n" +
      "Unidades a corrigir: " + resumo.areas.reduce(function (t, a) { return t + a.unidades.length; }, 0) + "\n" +
      "Datas em texto: " + (resumo.solicitacoes ? resumo.solicitacoes.datasTexto.length : 0) +
      (resumo.historico ? " + " + resumo.historico.datasTexto.length : "") + "\n\n" +
      "Nada foi alterado. Use o menu Executar migração para aplicar."
    );
  } catch (err) {
    logErro_("menuSimularMigracao", err);
    SpreadsheetApp.getUi().alert("Erro na simulação: " + mensagemPublica_(err));
  }
}

function menuExecutarMigracao() {
  var ui = SpreadsheetApp.getUi();
  var resposta = ui.alert(
    "Executar migração",
    "Será criado um backup e a estrutura será ajustada. Deseja continuar?",
    ui.ButtonSet.YES_NO
  );
  if (resposta !== ui.Button.YES) return;

  try {
    var resumo = migrarEstrutura();
    ui.alert(
      "Migração concluída.\n\n" +
      "Backup:\n" + resumo.backup + "\n\n" +
      "Duplicados renomeados: " + resumo.duplicados.length + "\n" +
      "Unidades corrigidas: " + resumo.unidadesCorrigidas.length + "\n" +
      "Validades corrigidas: " + resumo.validadesCorrigidas.length + "\n" +
      "Datas convertidas: " + resumo.datasConvertidas.length + "\n" +
      "Avisos: " + resumo.avisos.length
    );
  } catch (err) {
    logErro_("menuExecutarMigracao", err);
    ui.alert("Erro na migração: " + mensagemPublica_(err));
  }
}

function menuGerarTermoPedido() {
  var ui = SpreadsheetApp.getUi();
  var resposta = ui.prompt(
    "Gerar termo de retirada",
    "Informe o código do pedido aprovado (ex.: PED-20261114-A1B2C3):",
    ui.ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui.Button.OK) return;

  try {
    var resultado = gerarTermoPedidoInterno_(resposta.getResponseText());
    ui.alert("Termo gerado com sucesso!\n\n" + resultado.docUrl);
  } catch (err) {
    logErro_("menuGerarTermoPedido", err);
    ui.alert("Erro ao gerar termo: " + mensagemPublica_(err));
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Inventário Saúde")
    .addItem("Simular migração", "menuSimularMigracao")
    .addItem("Executar migração", "menuExecutarMigracao")
    .addSeparator()
    .addItem("Configurar pastas do Drive", "menuConfigurarPastasDrive")
    .addItem("Gerar termo de um pedido", "menuGerarTermoPedido")
    .addSeparator()
    .addItem("Relatório geral do almoxarifado", "menuGerarRelatorioGeral")
    .addItem("Relatório por área", "menuGerarRelatorioPorArea")
    .addItem("Relatório de saídas mensais", "menuGerarRelatorioSaidasMensais")
    .addItem("Relatório de críticos", "menuGerarRelatorioCriticos")
    .addItem("Inventário de todas as áreas", "menuGerarInventariosPorArea")
    .addToUi();
}
