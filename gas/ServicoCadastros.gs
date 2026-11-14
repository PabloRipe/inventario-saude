/**
 * Cadastros administrativos: produtos e listas auxiliares.
 */

function cadastrarProduto_(params) {
  var validacao = validarProduto_(params);
  if (!validacao.ok) {
    throw erroApp_("VALIDACAO", juntarErros_(validacao.erros), validacao.erros);
  }
  var dados = validacao.dados;

  exigirEstruturaAtualizada_();
  return comLock_(function () {
    var sheet = obterAba_(dados.area);
    var headers = normalizarCabecalhos_(
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    );
    var col = CONFIG.COLUNAS.estoque;
    obterHeaderIndex_(headers, col.id, dados.area);

    var existentes = lerSheetComoObjetos_(sheet).rows;
    var alvo = dados.idInsumo.toUpperCase();
    var duplicado = existentes.some(function (row) {
      return texto_(row[col.id]).toUpperCase() === alvo;
    });
    if (duplicado) {
      throw erroApp_("PRODUTO_DUPLICADO", "Ja existe um insumo com o ID " + dados.idInsumo + " na area " + dados.area + ".");
    }

    var obj = {};
    obj[col.id] = dados.idInsumo;
    obj[col.nome] = dados.nome;
    obj[col.unidade] = dados.unidadeBase;
    obj[col.embalagem] = dados.tipoEmbalagem;
    obj[col.fator] = 1;
    obj[col.atual] = 0;
    obj[col.minimo] = dados.estoqueMinimo;
    obj[col.lote] = "";
    obj[col.validade] = "";
    appendObjeto_(sheet, headers, obj);

    return {
      area: dados.area,
      idInsumo: dados.idInsumo,
      nome: dados.nome,
      unidade: dados.unidadeBase,
      estoqueMinimo: dados.estoqueMinimo
    };
  });
}

function obterCadastros_() {
  return {
    solicitantes: listarNomesUnicos_(CONFIG.SHEETS.solicitantes, "Solicitante"),
    setores: listarNomesUnicos_(CONFIG.SHEETS.setores, "Setor"),
    admins: listarAdmins_()
  };
}
