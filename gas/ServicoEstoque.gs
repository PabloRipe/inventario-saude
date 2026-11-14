/**
 * Estoque: leitura do catalogo, movimentacao direta e itens criticos.
 */

function obterCatalogoInterno_() {
  var areas = areasConfiguradas_();
  var estoque = {};

  areas.forEach(function (area) {
    var sheet = obterAba_(area, false);
    if (!sheet) {
      estoque[area] = [];
      return;
    }
    var dados = lerSheetComoObjetos_(sheet);
    var col = CONFIG.COLUNAS.estoque;
    var itens = [];

    dados.rows.forEach(function (row) {
      var id = texto_(row[col.id]);
      if (!id) return;
      itens.push({
        area: area,
        id: id,
        nome: texto_(row[col.nome]),
        unidade: normalizarUnidade_(row[col.unidade]),
        embalagem: texto_(row[col.embalagem]),
        fator: numero_(row[col.fator]) || 1,
        atual: numero_(row[col.atual]),
        minimo: numero_(row[col.minimo]),
        lote: texto_(row[col.lote]),
        validade: normalizarData_(row[col.validade]),
        _row: row._row
      });
    });

    itens.sort(function (a, b) {
      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });
    estoque[area] = itens;
  });

  return { areas: areas, estoque: estoque };
}

function obterCatalogoPublico_() {
  var interno = obterCatalogoInterno_();
  var estoque = {};
  interno.areas.forEach(function (area) {
    estoque[area] = (interno.estoque[area] || []).map(function (item) {
      return {
        id: item.id,
        nome: item.nome,
        unidade: item.unidade,
        atual: item.atual
      };
    });
  });
  return {
    areas: interno.areas,
    estoque: estoque,
    solicitantes: listarNomesUnicos_(CONFIG.SHEETS.solicitantes, "Solicitante"),
    setores: listarNomesUnicos_(CONFIG.SHEETS.setores, "Setor")
  };
}

function obterSaldosDoCatalogo_(catalogo) {
  var saldos = {};
  (catalogo.areas || []).forEach(function (area) {
    (catalogo.estoque[area] || []).forEach(function (item) {
      saldos[chaveItem_(area, item.id)] = item.atual;
    });
  });
  return saldos;
}

function buscarProdutoNaAba_(sheet, area, idInsumo) {
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.estoque;
  obterHeaderIndex_(dados.headers, col.id, area);
  var alvo = texto_(idInsumo).toUpperCase();
  var encontrados = dados.rows.filter(function (row) {
    return texto_(row[col.id]).toUpperCase() === alvo;
  });

  if (encontrados.length === 0) {
    throw erroApp_("ITEM_NAO_ENCONTRADO", "Insumo " + idInsumo + " nao encontrado na area " + area + ".");
  }
  if (encontrados.length > 1) {
    throw erroApp_(
      "DADOS_DUPLICADOS",
      "Ha mais de um insumo com o ID " + idInsumo + " na area " + area + ". Execute a migracao antes de continuar."
    );
  }

  return { row: encontrados[0]._row, item: encontrados[0], headers: dados.headers };
}

function montarLoteValidade_(lote, validade) {
  var l = texto_(lote);
  if (l === CONFIG.LOTE_SEM_LOTE) l = "";
  var v = normalizarData_(validade);
  var partes = [];
  if (l) partes.push("Lote: " + l);
  if (v) partes.push("Val: " + formatarData_(v));
  return partes.length ? partes.join(" | ") : "-";
}

function registrarHistorico_(dados) {
  var sheet = obterAba_(CONFIG.SHEETS.historico);
  var headers = normalizarCabecalhos_(
    sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
  );
  var col = CONFIG.COLUNAS.historico;
  var obj = {};
  obj[col.data] = new Date();
  obj[col.id] = dados.idInsumo || "";
  obj[col.nome] = dados.nome || "";
  obj[col.area] = dados.area || "";
  obj[col.tipo] = dados.tipo || "";
  obj[col.quantidade] = dados.quantidade || 0;
  obj[col.loteValidade] = dados.loteValidade || "-";
  obj[col.observacao] = dados.observacao || "";
  obj[col.idPedido] = dados.idPedido || "";
  obj[col.idLote] = dados.idLote || "";
  obj[col.lote] = texto_(dados.lote);
  obj[col.validade] = dados.validade || "";
  obj[col.usuario] = dados.usuario || "";
  obj[col.origem] = dados.origem || "";
  appendObjeto_(sheet, headers, obj);
}

function movimentar_(params, usuario) {
  var validacao = validarMovimento_(params);
  if (!validacao.ok) {
    throw erroApp_("VALIDACAO", juntarErros_(validacao.erros), validacao.erros);
  }
  var dados = validacao.dados;
  exigirEstruturaAtualizada_();
  var user = texto_(usuario) || emailUsuarioAtual_() || "sistema";

  return comLock_(function () {
    var sheet = obterAba_(dados.area);
    var produto = buscarProdutoNaAba_(sheet, dados.area, dados.idInsumo);
    var col = CONFIG.COLUNAS.estoque;
    var atual = numero_(produto.item[col.atual]);
    var novoEstoque = atual;

    if (dados.tipo === CONFIG.TIPOS_MOVIMENTO.ENTRADA) {
      novoEstoque = atual + dados.quantidade;
    } else {
      if (atual < dados.quantidade) {
        throw erroApp_(
          "ESTOQUE_INSUFICIENTE",
          "Estoque insuficiente para " + texto_(produto.item[col.nome]) + ": disponivel " + atual + ", solicitado " + dados.quantidade + ".",
          [{
            area: dados.area,
            idInsumo: dados.idInsumo,
            nome: texto_(produto.item[col.nome]),
            quantidade: dados.quantidade,
            disponivel: atual
          }]
        );
      }
      novoEstoque = atual - dados.quantidade;
    }

    var idxAtual = obterHeaderIndex_(produto.headers, col.atual, dados.area);
    sheet.getRange(produto.row, idxAtual + 1).setValue(novoEstoque);

    registrarHistorico_({
      idInsumo: dados.idInsumo,
      nome: texto_(produto.item[col.nome]),
      area: dados.area,
      tipo: dados.tipo,
      quantidade: dados.quantidade,
      lote: dados.lote,
      validade: dados.validade,
      loteValidade: montarLoteValidade_(dados.lote, dados.validade),
      observacao: dados.observacao,
      usuario: user,
      origem: CONFIG.ORIGENS.MOVIMENTO_DIRETO
    });

    return {
      area: dados.area,
      idInsumo: dados.idInsumo,
      nome: texto_(produto.item[col.nome]),
      unidade: normalizarUnidade_(produto.item[col.unidade]),
      tipo: dados.tipo,
      quantidade: dados.quantidade,
      novoEstoque: novoEstoque
    };
  });
}

function itensCriticos_(catalogo) {
  var dados = catalogo || obterCatalogoInterno_();
  var criticos = [];
  dados.areas.forEach(function (area) {
    (dados.estoque[area] || []).forEach(function (item) {
      if (item.atual <= item.minimo) {
        criticos.push({
          area: area,
          id: item.id,
          nome: item.nome,
          unidade: item.unidade,
          atual: item.atual,
          minimo: item.minimo,
          faltando: Math.max(0, item.minimo - item.atual)
        });
      }
    });
  });
  criticos.sort(function (a, b) {
    if (a.area !== b.area) return a.area.localeCompare(b.area, "pt-BR");
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
  return criticos;
}

function obterEstoqueParaAdmin_() {
  var catalogo = obterCatalogoInterno_();
  var estoque = {};
  catalogo.areas.forEach(function (area) {
    estoque[area] = (catalogo.estoque[area] || []).map(function (item) {
      return {
        area: item.area,
        id: item.id,
        nome: item.nome,
        unidade: item.unidade,
        embalagem: item.embalagem,
        atual: item.atual,
        minimo: item.minimo,
        lote: item.lote,
        validade: formatarData_(item.validade)
      };
    });
  });
  return {
    areas: catalogo.areas,
    estoque: estoque,
    criticos: itensCriticos_(catalogo)
  };
}
