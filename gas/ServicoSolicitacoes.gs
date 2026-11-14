/**
 * Solicitacoes: criacao, aprovacao, rejeicao, consulta e painel.
 */

function mapaProdutosDoCatalogo_(catalogo) {
  var mapa = {};
  (catalogo.areas || []).forEach(function (area) {
    (catalogo.estoque[area] || []).forEach(function (item) {
      mapa[chaveItem_(area, item.id)] = item;
    });
  });
  return mapa;
}

function enriquecerItensArmazenados_(itens, catalogo) {
  var mapa = mapaProdutosDoCatalogo_(catalogo);
  var agregados = {};
  var ordem = [];

  (itens || []).forEach(function (raw) {
    var area = texto_(raw && raw.area);
    var idInsumo = texto_(raw && raw.idInsumo);
    var qtd = numero_(raw && raw.quantidade);
    if (!area || !idInsumo || qtd <= 0) return;
    var chave = chaveItem_(area, idInsumo);
    if (!agregados[chave]) {
      agregados[chave] = {
        area: area,
        idInsumo: idInsumo,
        quantidade: 0,
        nomeFallback: texto_(raw && raw.nome),
        unidadeFallback: normalizarUnidade_(raw && raw.unidade)
      };
      ordem.push(chave);
    }
    agregados[chave].quantidade += qtd;
  });

  return ordem.map(function (chave) {
    var base = agregados[chave];
    var produto = mapa[chave];
    return {
      area: base.area,
      idInsumo: base.idInsumo,
      nome: produto ? produto.nome : (base.nomeFallback || base.idInsumo),
      unidade: produto ? produto.unidade : base.unidadeFallback,
      quantidade: base.quantidade,
      estoqueAtual: produto ? produto.atual : 0,
      suficiente: !!produto && base.quantidade <= produto.atual
    };
  });
}

function gerarProtocoloUnico_(sheet, headers) {
  var col = CONFIG.COLUNAS.solicitacoes;
  var idx = obterHeaderIndex_(headers, col.id, CONFIG.SHEETS.solicitacoes);
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var existentes = {};
  var ids = sheet.getRange(2, idx + 1, Math.max(lastRow - 1, 1), 1).getValues();
  ids.forEach(function (row) {
    var id = texto_(row[0]).toUpperCase();
    if (id) existentes[id] = true;
  });

  for (var tentativa = 0; tentativa < 8; tentativa++) {
    var protocolo = novoProtocolo_();
    if (!existentes[protocolo]) return protocolo;
  }
  return novoProtocolo_() + "-" + String(Date.now()).slice(-3);
}

function criarSolicitacao_(params) {
  var validacao = validarSolicitacaoBasica_(params);
  if (!validacao.ok) {
    throw erroApp_("VALIDACAO", juntarErros_(validacao.erros), validacao.erros);
  }
  var dados = validacao.dados;

  exigirEstruturaAtualizada_();
  var catalogo = obterCatalogoInterno_();
  var mapa = mapaProdutosDoCatalogo_(catalogo);
  var errosItens = [];
  var itens = dados.itens.map(function (item) {
    var produto = mapa[item.chave];
    if (!produto) {
      errosItens.push({
        area: item.area,
        idInsumo: item.idInsumo,
        mensagem: "Insumo " + item.idInsumo + " nao encontrado na area " + item.area + "."
      });
      return null;
    }
    return {
      area: item.area,
      idInsumo: produto.id,
      nome: produto.nome,
      unidade: produto.unidade,
      quantidade: item.quantidade,
      chave: item.chave
    };
  }).filter(function (item) { return !!item; });

  if (errosItens.length) {
    throw erroApp_("ITEM_NAO_ENCONTRADO", "Um ou mais itens nao foram encontrados. Atualize a pagina e tente novamente.", errosItens);
  }

  var saldos = obterSaldosDoCatalogo_(catalogo);
  var estoque = validarEstoqueItens_(itens, saldos);
  if (!estoque.ok) {
    throw erroApp_(
      "ESTOQUE_INSUFICIENTE",
      "Pedido nao enviado: o estoque disponivel e insuficiente para um ou mais itens. Ajuste as quantidades e tente novamente.",
      estoque.erros
    );
  }

  var resultado = comLock_(function () {
    var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
    var headers = normalizarCabecalhos_(
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    );
    var protocolo = gerarProtocoloUnico_(sheet, headers);
    var itensGravacao = itens.map(function (item) {
      return {
        area: item.area,
        idInsumo: item.idInsumo,
        nome: item.nome,
        unidade: item.unidade,
        quantidade: item.quantidade
      };
    });

    var col = CONFIG.COLUNAS.solicitacoes;
    var obj = {};
    obj[col.id] = protocolo;
    obj[col.data] = new Date();
    obj[col.solicitante] = dados.solicitante;
    obj[col.setor] = dados.setor;
    obj[col.itens] = serializarItens_(itensGravacao);
    obj[col.status] = CONFIG.STATUS.PENDENTE;
    obj[col.observacao] = dados.observacao;
    obj[col.dataStatus] = "";
    obj[col.processadoPor] = "";
    obj[col.docUrl] = "";
    obj[col.motivoRejeicao] = "";
    appendObjeto_(sheet, headers, obj);

    return { protocolo: protocolo, itens: itensGravacao };
  });

  return {
    protocolo: resultado.protocolo,
    solicitante: dados.solicitante,
    setor: dados.setor,
    itens: resultado.itens
  };
}

function localizarPedido_(sheet, headers, protocolo) {
  var col = CONFIG.COLUNAS.solicitacoes;
  var idx = obterHeaderIndex_(headers, col.id, CONFIG.SHEETS.solicitacoes);
  var alvo = normalizarProtocolo_(protocolo);
  if (!alvo) throw erroApp_("VALIDACAO", "Informe o codigo do pedido.");

  var dados = lerSheetComoObjetos_(sheet);
  for (var i = 0; i < dados.rows.length; i++) {
    if (normalizarProtocolo_(dados.rows[i][col.id]) === alvo) {
      return dados.rows[i];
    }
  }
  throw erroApp_("PEDIDO_NAO_ENCONTRADO", "Pedido " + alvo + " nao encontrado. Confira o codigo e tente novamente.");
}

function montarPedidoSaida_(row, catalogo, publico) {
  var col = CONFIG.COLUNAS.solicitacoes;
  var itens = enriquecerItensArmazenados_(parseItens_(row[col.itens]), catalogo);
  var saida = {
    protocolo: texto_(row[col.id]),
    status: texto_(row[col.status]).toUpperCase(),
    data: formatarDataHora_(row[col.data]),
    solicitante: texto_(row[col.solicitante]),
    setor: texto_(row[col.setor]),
    observacao: texto_(row[col.observacao]),
    itens: itens,
    dataStatus: formatarDataHora_(row[col.dataStatus]),
    motivoRejeicao: texto_(row[col.motivoRejeicao]),
    docUrl: texto_(row[col.docUrl])
  };
  if (!publico) {
    saida.processadoPor = texto_(row[col.processadoPor]);
  }
  return saida;
}

function listarPendentesComCatalogo_(catalogo) {
  var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.solicitacoes;
  return dados.rows
    .filter(function (row) {
      return texto_(row[col.status]).toUpperCase() === CONFIG.STATUS.PENDENTE;
    })
    .map(function (row) {
      return montarPedidoSaida_(row, catalogo, false);
    });
}

function consultarPedido_(protocolo, solicitante) {
  var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
  var headers = normalizarCabecalhos_(
    sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
  );
  var row = localizarPedido_(sheet, headers, protocolo);
  var col = CONFIG.COLUNAS.solicitacoes;
  var protocoloNormalizado = normalizarProtocolo_(protocolo);

  // Codigos antigos (PED-1234) sao faceis de enumerar. Exigir o nome do solicitante.
  // Codigos novos tem alta entropia; o nome e opcional, mas se informado precisa conferir.
  var nomeInformado = texto_(solicitante);
  if (!protocoloAltaEntropia_(protocoloNormalizado) && !nomeInformado) {
    throw erroApp_(
      "VALIDACAO",
      "Para pedidos com código antigo, informe também o nome do solicitante."
    );
  }
  if (nomeInformado && normalizarNomeComparacao_(nomeInformado) !== normalizarNomeComparacao_(row[col.solicitante])) {
    throw erroApp_("NAO_AUTORIZADO", "O nome informado não confere com o solicitante deste pedido.");
  }

  var catalogo = obterCatalogoInterno_();
  return montarPedidoSaida_(row, catalogo, true);
}

function aprovarSolicitacao_(protocolo) {
  var admin = exigirAdmin_();
  var alvo = normalizarProtocolo_(protocolo);
  if (!alvo) throw erroApp_("VALIDACAO", "Informe o codigo do pedido.");
  exigirEstruturaAtualizada_();

  var pedidoAprovado = comLock_(function () {
    var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
    var headers = normalizarCabecalhos_(
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    );
    var row = localizarPedido_(sheet, headers, alvo);
    var col = CONFIG.COLUNAS.solicitacoes;
    var status = texto_(row[col.status]).toUpperCase();

    if (status !== CONFIG.STATUS.PENDENTE) {
      throw erroApp_("CONFLITO_STATUS", "Este pedido ja esta " + (status || "processado") + " e nao pode ser aprovado novamente.");
    }

    var itensBrutos = parseItens_(row[col.itens]);
    var itensValidados = validarItensPedido_(itensBrutos);
    if (!itensValidados.ok) {
      throw erroApp_("VALIDACAO", "O pedido possui itens invalidos: " + juntarErros_(itensValidados.erros), itensValidados.erros);
    }

    var catalogo = obterCatalogoInterno_();
    var mapa = mapaProdutosDoCatalogo_(catalogo);
    var saldos = obterSaldosDoCatalogo_(catalogo);
    var itens = [];
    var erros = [];

    itensValidados.itens.forEach(function (item) {
      var produto = mapa[item.chave];
      if (!produto) {
        erros.push({
          area: item.area,
          idInsumo: item.idInsumo,
          mensagem: "Insumo " + item.idInsumo + " nao encontrado na area " + item.area + "."
        });
        return;
      }
      itens.push({
        area: item.area,
        idInsumo: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        quantidade: item.quantidade,
        chave: item.chave,
        atual: produto.atual,
        row: produto._row
      });
    });

    if (erros.length) {
      throw erroApp_("ITEM_NAO_ENCONTRADO", "Nao foi possivel aprovar: um ou mais itens nao existem mais.", erros);
    }

    var estoque = validarEstoqueItens_(itens, saldos);
    if (!estoque.ok) {
      throw erroApp_(
        "ESTOQUE_INSUFICIENTE",
        "Nao foi possivel aprovar: o estoque mudou e ficou insuficiente. Atualize a pagina e ajuste o pedido.",
        estoque.erros
      );
    }

    var cacheAreas = {};
    function obterAreaParaAtualizacao(area) {
      if (!cacheAreas[area]) {
        var areaSheet = obterAba_(area);
        var areaHeaders = normalizarCabecalhos_(
          areaSheet.getRange(1, 1, 1, Math.max(areaSheet.getLastColumn(), 1)).getValues()[0]
        );
        cacheAreas[area] = {
          sheet: areaSheet,
          headers: areaHeaders,
          idxAtual: obterHeaderIndex_(areaHeaders, CONFIG.COLUNAS.estoque.atual, area)
        };
      }
      return cacheAreas[area];
    }

    itens.forEach(function (item) {
      var areaInfo = obterAreaParaAtualizacao(item.area);
      var novoEstoque = numero_(item.atual) - numero_(item.quantidade);
      areaInfo.sheet.getRange(item.row, areaInfo.idxAtual + 1).setValue(novoEstoque);

      registrarHistorico_({
        idInsumo: item.idInsumo,
        nome: item.nome,
        area: item.area,
        tipo: CONFIG.TIPOS_MOVIMENTO.BAIXA,
        quantidade: item.quantidade,
        lote: "",
        validade: null,
        loteValidade: "-",
        observacao: "Pedido: " + alvo + " | Setor: " + texto_(row[col.setor]) + " | Solicitante: " + texto_(row[col.solicitante]),
        idPedido: alvo,
        usuario: admin.email,
        origem: CONFIG.ORIGENS.SOLICITACAO
      });
    });

    var valores = {};
    valores[col.status] = CONFIG.STATUS.APROVADO;
    valores[col.dataStatus] = new Date();
    valores[col.processadoPor] = admin.email;
    valores[col.motivoRejeicao] = "";
    atualizarCelulas_(sheet, row._row, headers, valores);

    return {
      protocolo: alvo,
      dataPedido: formatarDataHora_(row[col.data]),
      solicitante: texto_(row[col.solicitante]),
      setor: texto_(row[col.setor]),
      observacao: texto_(row[col.observacao]),
      itens: itens.map(function (item) {
        return {
          area: item.area,
          idInsumo: item.idInsumo,
          nome: item.nome,
          unidade: item.unidade,
          quantidade: item.quantidade
        };
      })
    };
  });

  var saida = {
    protocolo: pedidoAprovado.protocolo,
    itens: pedidoAprovado.itens,
    docUrl: "",
    avisoTermo: ""
  };

  try {
    var termo = gerarTermoRetirada_(pedidoAprovado);
    saida.docUrl = termo.url;
    var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
    var headers = normalizarCabecalhos_(
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    );
    var rowAtual = localizarPedido_(sheet, headers, pedidoAprovado.protocolo);
    atualizarCelulas_(sheet, rowAtual._row, headers, (function () {
      var obj = {};
      obj[CONFIG.COLUNAS.solicitacoes.docUrl] = termo.url;
      return obj;
    })());
  } catch (err) {
    logErro_("aprovarSolicitacao/termo", err);
    saida.avisoTermo = "O pedido foi aprovado e o estoque foi baixado, mas o termo nao pode ser gerado. Gere-o novamente pela planilha ou acione o suporte.";
  }

  return saida;
}

function rejeitarSolicitacao_(protocolo, motivo) {
  var admin = exigirAdmin_();
  var alvo = normalizarProtocolo_(protocolo);
  if (!alvo) throw erroApp_("VALIDACAO", "Informe o codigo do pedido.");
  exigirEstruturaAtualizada_();

  var motivoValidado = validarMotivoRejeicao_(motivo);
  if (!motivoValidado.ok) throw erroApp_("VALIDACAO", motivoValidado.erro);

  return comLock_(function () {
    var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
    var headers = normalizarCabecalhos_(
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    );
    var row = localizarPedido_(sheet, headers, alvo);
    var col = CONFIG.COLUNAS.solicitacoes;
    var status = texto_(row[col.status]).toUpperCase();

    if (status !== CONFIG.STATUS.PENDENTE) {
      throw erroApp_("CONFLITO_STATUS", "Este pedido ja esta " + (status || "processado") + " e nao pode ser rejeitado.");
    }

    var valores = {};
    valores[col.status] = CONFIG.STATUS.REJEITADO;
    valores[col.dataStatus] = new Date();
    valores[col.processadoPor] = admin.email;
    valores[col.motivoRejeicao] = motivoValidado.valor;
    atualizarCelulas_(sheet, row._row, headers, valores);

    return {
      protocolo: alvo,
      status: CONFIG.STATUS.REJEITADO,
      motivo: motivoValidado.valor
    };
  });
}

function gerarTermoPedidoInterno_(protocolo) {
  exigirEstruturaAtualizada_();
  var alvo = normalizarProtocolo_(protocolo);
  if (!alvo) throw erroApp_("VALIDACAO", "Informe o codigo do pedido.");

  var sheet = obterAba_(CONFIG.SHEETS.solicitacoes);
  var headers = normalizarCabecalhos_(
    sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
  );
  var row = localizarPedido_(sheet, headers, alvo);
  var col = CONFIG.COLUNAS.solicitacoes;
  var status = texto_(row[col.status]).toUpperCase();
  if (status !== CONFIG.STATUS.APROVADO) {
    throw erroApp_("CONFLITO_STATUS", "O termo so pode ser gerado para pedidos aprovados. Status atual: " + (status || "desconhecido") + ".");
  }

  var catalogo = obterCatalogoInterno_();
  var itens = enriquecerItensArmazenados_(parseItens_(row[col.itens]), catalogo);
  var pedido = {
    protocolo: alvo,
    dataPedido: formatarDataHora_(row[col.data]),
    solicitante: texto_(row[col.solicitante]),
    setor: texto_(row[col.setor]),
    observacao: texto_(row[col.observacao]),
    itens: itens
  };

  var termo = gerarTermoRetirada_(pedido);
  var valores = {};
  valores[col.docUrl] = termo.url;
  atualizarCelulas_(sheet, row._row, headers, valores);
  return { protocolo: alvo, docUrl: termo.url };
}

function gerarTermoPedido_(protocolo) {
  exigirAdmin_();
  return gerarTermoPedidoInterno_(protocolo);
}

function listarHistoricoRecente_(limite) {
  var sheet = obterAba_(CONFIG.SHEETS.historico, false);
  if (!sheet) return [];
  var dados = lerSheetComoObjetos_(sheet);
  var col = CONFIG.COLUNAS.historico;
  var max = Math.min(limite || 100, CONFIG.LIMITES.maxBuscaHistorico);
  var rows = dados.rows.slice(-max).reverse();

  return rows.map(function (row) {
    return {
      data: formatarDataHora_(row[col.data]),
      idInsumo: texto_(row[col.id]),
      nome: texto_(row[col.nome]),
      area: texto_(row[col.area]),
      tipo: texto_(row[col.tipo]),
      quantidade: numero_(row[col.quantidade]),
      lote: texto_(row[col.lote]),
      validade: formatarData_(row[col.validade]),
      loteValidade: texto_(row[col.loteValidade]),
      observacao: texto_(row[col.observacao]),
      idPedido: texto_(row[col.idPedido]),
      usuario: texto_(row[col.usuario]),
      origem: texto_(row[col.origem])
    };
  });
}

function obterPainelAdmin_() {
  var catalogo = obterCatalogoInterno_();
  var pendentes = listarPendentesComCatalogo_(catalogo);
  var criticos = itensCriticos_(catalogo);
  var estoque = {};
  var totalItens = 0;

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
    totalItens += estoque[area].length;
  });

  return {
    areas: catalogo.areas,
    estoque: estoque,
    pendentes: pendentes,
    criticos: criticos,
    historico: listarHistoricoRecente_(100),
    solicitantes: listarNomesUnicos_(CONFIG.SHEETS.solicitantes, "Solicitante"),
    setores: listarNomesUnicos_(CONFIG.SHEETS.setores, "Setor"),
    resumo: {
      pendentes: pendentes.length,
      criticos: criticos.length,
      itens: totalItens
    }
  };
}
