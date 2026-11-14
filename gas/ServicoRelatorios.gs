/**
 * Relatorios gerenciais do almoxarifado:
 * - resumo geral;
 * - inventario por area selecionada;
 * - saidas mensais por area, produto, setor e solicitante.
 */

function normalizarPeriodoMensal_(periodo) {
  var s = texto_(periodo);
  var m = s.match(/^(\d{4})-(\d{2})$/);
  var ano;
  var mes;

  if (m) {
    ano = Number(m[1]);
    mes = Number(m[2]);
  } else {
    m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    mes = Number(m[1]);
    ano = Number(m[2]);
  }

  if (!isFinite(ano) || !isFinite(mes) || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
    return null;
  }

  var mesTexto = ("0" + mes).slice(-2);
  return {
    ano: ano,
    mes: mes,
    chave: ano + "-" + mesTexto,
    texto: mesTexto + "/" + ano
  };
}

function obterMapaSolicitacoes_() {
  var sheet = obterAba_(CONFIG.SHEETS.solicitacoes, false);
  if (!sheet) return {};
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.solicitacoes;
  var mapa = {};

  dados.rows.forEach(function (row) {
    var protocolo = normalizarProtocolo_(row[col.id]);
    if (!protocolo) return;
    mapa[protocolo] = {
      solicitante: texto_(row[col.solicitante]),
      setor: texto_(row[col.setor])
    };
  });
  return mapa;
}

function obterInfoSaida_(idPedido, observacao, usuario, mapaSolicitacoes) {
  var protocolo = normalizarProtocolo_(idPedido);
  var info = protocolo && mapaSolicitacoes ? mapaSolicitacoes[protocolo] : null;
  var setor = info ? texto_(info.setor) : "";
  var solicitante = info ? texto_(info.solicitante) : "";
  var protocoloEncontrado = protocolo;

  if (!setor || !solicitante || !protocoloEncontrado) {
    var obs = texto_(observacao);
    var m = obs.match(/Setor:\s*(.+?)\s*\|\s*Solicitante:\s*(.+)$/i);
    if (m) {
      setor = setor || texto_(m[1]);
      solicitante = solicitante || texto_(m[2]);
    }
    if (!protocoloEncontrado) {
      var mp = obs.match(/Pedido:\s*([^|]+)/i);
      if (mp) protocoloEncontrado = normalizarProtocolo_(mp[1]);
    }
  }

  return {
    idPedido: protocoloEncontrado,
    setor: setor || "Movimentação direta",
    solicitante: solicitante || texto_(usuario) || "-"
  };
}

function obterSaidasDoPeriodo_(periodo) {
  var p = normalizarPeriodoMensal_(periodo);
  if (!p) {
    throw erroApp_("VALIDACAO", "Informe o período no formato AAAA-MM ou MM/AAAA.");
  }

  var sheet = obterAba_(CONFIG.SHEETS.historico);
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.historico;
  var mapa = obterMapaSolicitacoes_();
  var rows = [];

  dados.rows.forEach(function (row) {
    var tipo = texto_(row[col.tipo]).toUpperCase();
    if (tipo !== CONFIG.TIPOS_MOVIMENTO.BAIXA) return;

    var data = normalizarData_(row[col.data]);
    if (!data) return;
    if (data.getFullYear() !== p.ano || data.getMonth() + 1 !== p.mes) return;

    var idPedido = texto_(row[col.idPedido]);
    var info = obterInfoSaida_(idPedido, row[col.observacao], row[col.usuario], mapa);

    rows.push({
      data: data,
      dataTexto: formatarDataHora_(data),
      area: texto_(row[col.area]),
      idInsumo: texto_(row[col.id]),
      nome: texto_(row[col.nome]),
      quantidade: numero_(row[col.quantidade]),
      idPedido: info.idPedido || idPedido,
      setor: info.setor,
      solicitante: info.solicitante,
      usuario: texto_(row[col.usuario]),
      loteValidade: texto_(row[col.loteValidade])
    });
  });

  rows.sort(function (a, b) {
    var d = a.data.getTime() - b.data.getTime();
    if (d !== 0) return d;
    if (a.area !== b.area) return a.area.localeCompare(b.area, "pt-BR");
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });

  var porArea = {};
  var porSetor = {};
  var porProduto = {};
  var totalQuantidade = 0;

  rows.forEach(function (item) {
    totalQuantidade += item.quantidade;

    if (!porArea[item.area]) {
      porArea[item.area] = { area: item.area, quantidade: 0, registros: 0, produtos: {} };
    }
    porArea[item.area].quantidade += item.quantidade;
    porArea[item.area].registros += 1;
    porArea[item.area].produtos[item.idInsumo] = true;

    if (!porSetor[item.setor]) {
      porSetor[item.setor] = { setor: item.setor, quantidade: 0, registros: 0 };
    }
    porSetor[item.setor].quantidade += item.quantidade;
    porSetor[item.setor].registros += 1;

    var chaveProduto = chaveItem_(item.area, item.idInsumo);
    if (!porProduto[chaveProduto]) {
      porProduto[chaveProduto] = {
        area: item.area,
        idInsumo: item.idInsumo,
        nome: item.nome,
        quantidade: 0
      };
    }
    porProduto[chaveProduto].quantidade += item.quantidade;
  });

  return {
    periodo: p,
    rows: rows,
    porArea: Object.keys(porArea).map(function (k) {
      var a = porArea[k];
      a.totalProdutos = Object.keys(a.produtos).length;
      return a;
    }).sort(function (a, b) { return a.area.localeCompare(b.area, "pt-BR"); }),
    porSetor: Object.keys(porSetor).map(function (k) { return porSetor[k]; })
      .sort(function (a, b) { return a.setor.localeCompare(b.setor, "pt-BR"); }),
    porProduto: Object.keys(porProduto).map(function (k) { return porProduto[k]; })
      .sort(function (a, b) {
        if (a.area !== b.area) return a.area.localeCompare(b.area, "pt-BR");
        return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
      }),
    totalQuantidade: totalQuantidade,
    totalRegistros: rows.length
  };
}

function adicionarTabelaDoc_(body, cabecalho, linhas, corCabecalho) {
  var dados = [cabecalho].concat(linhas);
  var table = body.appendTable(dados);
  var header = table.getRow(0);
  header.setBackgroundColor(corCabecalho || "#334155");
  for (var c = 0; c < header.getNumCells(); c++) {
    var p = header.getCell(c).getChild(0).asParagraph();
    p.setBold(true);
    p.setForegroundColor("#FFFFFF");
  }
  return table;
}

function adicionarTituloDoc_(body, titulo, subtitulo) {
  var t = body.appendParagraph(titulo);
  t.setBold(true);
  t.setFontSize(16);
  if (subtitulo) {
    var s = body.appendParagraph(subtitulo);
    s.setItalic(true);
    s.setFontSize(10);
  }
  body.appendParagraph("");
}

function gerarRelatorioGeral_() {
  var catalogo = obterCatalogoInterno_();
  var criticos = itensCriticos_(catalogo);
  var pasta = obterPastaConfigurada_("relatorios");
  var nome = "Relatório Geral do Almoxarifado - " + dataParaNomeArquivo_();
  var doc = DocumentApp.create(nome);
  var body = doc.getBody();

  adicionarTituloDoc_(
    body,
    "Secretaria de Saúde - Relatório Geral do Almoxarifado",
    "Gerado em: " + formatarDataHora_(new Date())
  );

  var resumo = [];
  var totalItens = 0;
  var totalEstoque = 0;
  var totalCriticos = 0;
  var totalZerados = 0;

  catalogo.areas.forEach(function (area) {
    var itens = catalogo.estoque[area] || [];
    var estoqueArea = 0;
    var criticosArea = 0;
    var zeradosArea = 0;

    itens.forEach(function (item) {
      estoqueArea += item.atual;
      if (item.atual <= item.minimo) criticosArea += 1;
      if (item.atual <= 0) zeradosArea += 1;
    });

    totalItens += itens.length;
    totalEstoque += estoqueArea;
    totalCriticos += criticosArea;
    totalZerados += zeradosArea;

    resumo.push([
      area,
      String(itens.length),
      String(estoqueArea),
      String(criticosArea),
      String(zeradosArea)
    ]);
  });

  body.appendParagraph("Resumo por área").setBold(true).setFontSize(13);
  adicionarTabelaDoc_(
    body,
    ["Área", "Itens cadastrados", "Estoque total", "Itens críticos", "Itens zerados"],
    resumo,
    "#334155"
  );
  body.appendParagraph("");

  body.appendParagraph("Total geral").setBold(true).setFontSize(13);
  body.appendParagraph("Itens cadastrados: " + totalItens);
  body.appendParagraph("Estoque total: " + totalEstoque);
  body.appendParagraph("Itens críticos: " + totalCriticos);
  body.appendParagraph("Itens zerados: " + totalZerados);
  body.appendParagraph("");

  if (criticos.length) {
    body.appendParagraph("Itens críticos (no ou abaixo do mínimo)").setBold(true).setFontSize(13);
    var linhasCriticas = criticos.map(function (item) {
      return [
        item.area,
        item.id,
        item.nome,
        normalizarUnidade_(item.unidade),
        String(item.atual),
        String(item.minimo),
        String(item.faltando)
      ];
    });
    adicionarTabelaDoc_(
      body,
      ["Área", "ID", "Insumo", "Unidade", "Atual", "Mínimo", "Faltando"],
      linhasCriticas,
      "#D9534F"
    );
    body.appendParagraph("");
  } else {
    body.appendParagraph("Nenhum insumo abaixo do estoque mínimo no momento.");
    body.appendParagraph("");
  }

  body.appendParagraph("Inventário completo por área").setBold(true).setFontSize(13);
  catalogo.areas.forEach(function (area) {
    var itens = catalogo.estoque[area] || [];
    body.appendParagraph("Área: " + area).setBold(true).setFontSize(12);

    if (!itens.length) {
      body.appendParagraph("Nenhum insumo cadastrado nesta área.");
      body.appendParagraph("");
      return;
    }

    var linhasArea = [];
    var criticasArea = [];
    itens.forEach(function (item) {
      var critico = item.atual <= item.minimo;
      linhasArea.push([
        item.id,
        item.nome,
        normalizarUnidade_(item.unidade),
        String(item.atual),
        String(item.minimo),
        critico ? "CRÍTICO" : "Normal"
      ]);
      if (critico) criticasArea.push(linhasArea.length - 1);
    });

    var tabelaArea = adicionarTabelaDoc_(
      body,
      ["ID", "Insumo", "Unidade", "Atual", "Mínimo", "Status"],
      linhasArea,
      "#334155"
    );

    criticasArea.forEach(function (linha) {
      var row = tabelaArea.getRow(linha);
      for (var c = 0; c < row.getNumCells(); c++) {
        var cell = row.getCell(c);
        cell.setBackgroundColor("#FEE2E2");
        var para = cell.getChild(0).asParagraph();
        para.setForegroundColor("#991B1B");
        para.setBold(true);
      }
    });
    body.appendParagraph("");
  });

  doc.saveAndClose();
  moverDocumentoParaPasta_(doc, pasta);

  return {
    id: doc.getId(),
    url: doc.getUrl(),
    totalAreas: catalogo.areas.length,
    totalItens: totalItens,
    totalEstoque: totalEstoque,
    totalCriticos: totalCriticos,
    totalZerados: totalZerados
  };
}

function gerarInventarioDaArea_(area) {
  var areaNome = texto_(area);
  if (!ehAreaValida_(areaNome)) {
    throw erroApp_("VALIDACAO", "Selecione uma área válida.");
  }

  var catalogo = obterCatalogoInterno_();
  var itens = catalogo.estoque[areaNome] || [];
  var pasta = obterPastaConfigurada_("relatorios");
  var nome = "Inventário - " + nomeArquivoSeguro_(areaNome) + " - " + dataParaNomeArquivo_();
  var doc = DocumentApp.create(nome);
  var body = doc.getBody();

  adicionarTituloDoc_(
    body,
    "Secretaria de Saúde - Inventário por Área",
    "Área: " + areaNome.toUpperCase() + " | Gerado em: " + formatarDataHora_(new Date())
  );

  var totalEstoque = 0;
  var totalCriticos = 0;
  var linhas = [];
  var linhasCriticas = [];

  itens.forEach(function (item) {
    var critico = item.atual <= item.minimo;
    totalEstoque += item.atual;
    if (critico) totalCriticos += 1;

    linhas.push([
      item.id,
      item.nome,
      normalizarUnidade_(item.unidade),
      String(item.atual),
      String(item.minimo),
      critico ? "CRÍTICO" : "Normal"
    ]);
    if (critico) linhasCriticas.push(linhas.length - 1);
  });

  if (!linhas.length) {
    body.appendParagraph("Nenhum insumo cadastrado nesta área.");
  } else {
    var table = adicionarTabelaDoc_(
      body,
      ["ID", "Insumo", "Unidade", "Estoque Atual", "Estoque Mínimo", "Status"],
      linhas,
      "#334155"
    );

    linhasCriticas.forEach(function (linha) {
      var row = table.getRow(linha);
      for (var c = 0; c < row.getNumCells(); c++) {
        var cell = row.getCell(c);
        cell.setBackgroundColor("#FEE2E2");
        var para = cell.getChild(0).asParagraph();
        para.setForegroundColor("#991B1B");
        para.setBold(true);
      }
    });
  }

  body.appendParagraph("");
  body.appendParagraph("Itens cadastrados: " + itens.length);
  body.appendParagraph("Estoque total: " + totalEstoque);
  body.appendParagraph("Itens críticos: " + totalCriticos);

  doc.saveAndClose();
  moverDocumentoParaPasta_(doc, pasta);

  return {
    id: doc.getId(),
    url: doc.getUrl(),
    area: areaNome,
    totalItens: itens.length,
    totalEstoque: totalEstoque,
    totalCriticos: totalCriticos
  };
}

function gerarRelatorioSaidasMensais_(periodo) {
  var resultado = obterSaidasDoPeriodo_(periodo);
  var pasta = obterPastaConfigurada_("relatorios");
  var nome = "Saídas Mensais - " + resultado.periodo.chave + " - " + dataParaNomeArquivo_();
  var doc = DocumentApp.create(nome);
  var body = doc.getBody();

  adicionarTituloDoc_(
    body,
    "Secretaria de Saúde - Relatório de Saídas Mensais",
    "Período: " + resultado.periodo.texto + " | Gerado em: " + formatarDataHora_(new Date())
  );

  body.appendParagraph("Resumo geral").setBold(true).setFontSize(13);
  body.appendParagraph("Registros de baixa: " + resultado.totalRegistros);
  body.appendParagraph("Quantidade total de itens retirados: " + resultado.totalQuantidade);
  body.appendParagraph("");

  if (!resultado.rows.length) {
    body.appendParagraph("Nenhuma saída registrada no período selecionado.");
  } else {
    body.appendParagraph("Resumo por área").setBold(true).setFontSize(13);
    adicionarTabelaDoc_(
      body,
      ["Área", "Produtos distintos", "Registros", "Quantidade total"],
      resultado.porArea.map(function (a) {
        return [a.area, String(a.totalProdutos), String(a.registros), String(a.quantidade)];
      }),
      "#334155"
    );
    body.appendParagraph("");

    body.appendParagraph("Resumo por setor").setBold(true).setFontSize(13);
    adicionarTabelaDoc_(
      body,
      ["Setor", "Registros", "Quantidade total"],
      resultado.porSetor.map(function (s) {
        return [s.setor, String(s.registros), String(s.quantidade)];
      }),
      "#334155"
    );
    body.appendParagraph("");

    body.appendParagraph("Resumo por produto").setBold(true).setFontSize(13);
    adicionarTabelaDoc_(
      body,
      ["Área", "ID", "Produto", "Quantidade total"],
      resultado.porProduto.map(function (p) {
        return [p.area, p.idInsumo, p.nome, String(p.quantidade)];
      }),
      "#334155"
    );
    body.appendParagraph("");

    body.appendParagraph("Detalhamento das saídas").setBold(true).setFontSize(13);
    var detalhes = resultado.rows.map(function (item) {
      return [
        item.dataTexto,
        item.area,
        item.idInsumo,
        item.nome,
        item.setor,
        item.solicitante,
        String(item.quantidade),
        item.idPedido || "-"
      ];
    });
    adicionarTabelaDoc_(
      body,
      ["Data", "Área", "ID", "Produto", "Setor", "Solicitante", "Qtd.", "Pedido"],
      detalhes,
      "#334155"
    );
  }

  doc.saveAndClose();
  moverDocumentoParaPasta_(doc, pasta);

  return {
    id: doc.getId(),
    url: doc.getUrl(),
    periodo: resultado.periodo.texto,
    totalRegistros: resultado.totalRegistros,
    totalQuantidade: resultado.totalQuantidade
  };
}

function menuGerarRelatorioGeral() {
  try {
    var r = gerarRelatorioGeral_();
    SpreadsheetApp.getUi().alert(
      "Relatório geral gerado.\n\n" +
      "Itens: " + r.totalItens + "\n" +
      "Estoque total: " + r.totalEstoque + "\n" +
      "Itens críticos: " + r.totalCriticos + "\n\n" + r.url
    );
  } catch (err) {
    logErro_("menuGerarRelatorioGeral", err);
    SpreadsheetApp.getUi().alert("Erro ao gerar relatório: " + mensagemPublica_(err));
  }
}

function menuGerarRelatorioPorArea() {
  var ui = SpreadsheetApp.getUi();
  var resposta = ui.prompt(
    "Relatório por área",
    "Informe a área: " + areasConfiguradas_().join(", "),
    ui.ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui.Button.OK) return;

  try {
    var r = gerarInventarioDaArea_(resposta.getResponseText());
    ui.alert(
      "Relatório de " + r.area + " gerado.\n\n" +
      "Itens: " + r.totalItens + "\n" +
      "Estoque total: " + r.totalEstoque + "\n" +
      "Itens críticos: " + r.totalCriticos + "\n\n" + r.url
    );
  } catch (err) {
    logErro_("menuGerarRelatorioPorArea", err);
    ui.alert("Erro ao gerar relatório: " + mensagemPublica_(err));
  }
}

function menuGerarRelatorioSaidasMensais() {
  var ui = SpreadsheetApp.getUi();
  var resposta = ui.prompt(
    "Saídas mensais",
    "Informe o período no formato MM/AAAA ou AAAA-MM:",
    ui.ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui.Button.OK) return;

  try {
    var r = gerarRelatorioSaidasMensais_(resposta.getResponseText());
    ui.alert(
      "Relatório de saídas de " + r.periodo + " gerado.\n\n" +
      "Registros: " + r.totalRegistros + "\n" +
      "Quantidade total: " + r.totalQuantidade + "\n\n" + r.url
    );
  } catch (err) {
    logErro_("menuGerarRelatorioSaidasMensais", err);
    ui.alert("Erro ao gerar relatório: " + mensagemPublica_(err));
  }
}
