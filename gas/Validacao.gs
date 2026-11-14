/**
 * Regras de validacao puras (sem planilha), reutilizadas pelos servicos.
 * Toda funcao retorna { ok, ... } e nunca lanca excecao de negocio.
 */

function validarTextoObrigatorio_(valor, campo, max) {
  var s = texto_(valor);
  if (!s) return { ok: false, erro: campo + " e obrigatorio." };
  if (max && s.length > max) return { ok: false, erro: campo + " deve ter no maximo " + max + " caracteres." };
  return { ok: true, valor: s };
}

function validarQuantidadeInteira_(valor, campo) {
  var n = Number(valor);
  if (!isFinite(n) || n <= 0) {
    return { ok: false, erro: campo + " deve ser maior que zero." };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, erro: campo + " deve ser um numero inteiro. Quantidades fracionadas nao sao permitidas." };
  }
  if (n > CONFIG.LIMITES.maxQuantidade) {
    return { ok: false, erro: campo + " excede o limite permitido." };
  }
  return { ok: true, valor: n };
}

function validarItensPedido_(itens) {
  var erros = [];
  if (!Array.isArray(itens) || itens.length === 0) {
    return { ok: false, erros: ["Adicione pelo menos um item ao pedido."], itens: [] };
  }
  if (itens.length > CONFIG.LIMITES.maxItensPedido) {
    return { ok: false, erros: ["O pedido pode ter no maximo " + CONFIG.LIMITES.maxItensPedido + " itens."], itens: [] };
  }

  var mapa = {};
  var ordem = [];

  itens.forEach(function (item, index) {
    var area = texto_(item && item.area);
    var idInsumo = texto_(item && item.idInsumo);
    var qtd = validarQuantidadeInteira_(item && item.quantidade, "Quantidade do item " + (index + 1));

    if (!ehAreaValida_(area)) {
      erros.push("Area invalida no item " + (index + 1) + ".");
      return;
    }
    if (!idInsumo) {
      erros.push("ID do insumo ausente no item " + (index + 1) + ".");
      return;
    }
    if (!qtd.ok) {
      erros.push(qtd.erro);
      return;
    }

    var chave = chaveItem_(area, idInsumo);
    if (!mapa[chave]) {
      mapa[chave] = { area: area, idInsumo: idInsumo, quantidade: qtd.valor, chave: chave };
      ordem.push(chave);
    } else {
      mapa[chave].quantidade += qtd.valor;
      if (mapa[chave].quantidade > CONFIG.LIMITES.maxQuantidade) {
        erros.push("Quantidade total do insumo " + idInsumo + " excede o limite permitido.");
      }
    }
  });

  var normalizados = ordem.map(function (chave) { return mapa[chave]; });
  return { ok: erros.length === 0, erros: erros, itens: normalizados };
}

function validarSolicitacaoBasica_(params) {
  var erros = [];
  var solicitante = validarTextoObrigatorio_(params && params.solicitante, "Solicitante", CONFIG.LIMITES.maxSolicitante);
  var setor = validarTextoObrigatorio_(params && params.setor, "Setor", CONFIG.LIMITES.maxSetor);
  var itens = validarItensPedido_(params && params.itens);

  if (!solicitante.ok) erros.push(solicitante.erro);
  if (!setor.ok) erros.push(setor.erro);
  erros = erros.concat(itens.erros || []);

  var observacao = limitarTexto_(params && params.observacao, CONFIG.LIMITES.maxObservacao);

  return {
    ok: erros.length === 0,
    erros: erros,
    dados: {
      solicitante: solicitante.ok ? solicitante.valor : "",
      setor: setor.ok ? setor.valor : "",
      observacao: observacao,
      itens: itens.itens || []
    }
  };
}

/**
 * saldos: objeto { "AREA::ID": numero }
 */
function validarEstoqueItens_(itens, saldos) {
  var erros = [];
  (itens || []).forEach(function (item) {
    var chave = item.chave || chaveItem_(item.area, item.idInsumo);
    var disponivel = numero_(saldos && saldos[chave]);
    var solicitado = numero_(item.quantidade);
    if (solicitado > disponivel) {
      erros.push({
        area: item.area,
        idInsumo: item.idInsumo,
        nome: item.nome || item.idInsumo,
        quantidade: solicitado,
        disponivel: disponivel,
        mensagem: "Estoque insuficiente para " + (item.nome || item.idInsumo) + " (" + item.area + "): solicitado " + solicitado + ", disponivel " + disponivel + "."
      });
    }
  });
  return { ok: erros.length === 0, erros: erros };
}

function validarProduto_(params) {
  var erros = [];
  var area = texto_(params && params.area);
  var idInsumo = validarTextoObrigatorio_(params && params.idInsumo, "ID do insumo", 40);
  var nome = validarTextoObrigatorio_(params && params.nome, "Nome do produto", CONFIG.LIMITES.maxNome);
  var minimoBruto = texto_(params && params.estoqueMinimo);
  var minimo = Number(params && params.estoqueMinimo);

  if (!ehAreaValida_(area)) erros.push("Area invalida.");
  if (!idInsumo.ok) erros.push(idInsumo.erro);
  if (!nome.ok) erros.push(nome.erro);
  if (!minimoBruto) {
    erros.push("Estoque minimo e obrigatorio.");
  } else if (!isFinite(minimo) || minimo < 0 || !Number.isInteger(minimo)) {
    erros.push("Estoque minimo deve ser um numero inteiro maior ou igual a zero.");
  }

  return {
    ok: erros.length === 0,
    erros: erros,
    dados: {
      area: area,
      idInsumo: idInsumo.ok ? idInsumo.valor : "",
      nome: nome.ok ? nome.valor : "",
      unidadeBase: normalizarUnidade_(params && params.unidadeBase),
      tipoEmbalagem: limitarTexto_(params && params.tipoEmbalagem, 60),
      estoqueMinimo: isFinite(minimo) ? minimo : 0
    }
  };
}

function validarMovimento_(params) {
  var erros = [];
  var area = texto_(params && params.area);
  var idInsumo = validarTextoObrigatorio_(params && params.idInsumo, "ID do insumo", 40);
  var tipo = texto_(params && params.tipo).toUpperCase();
  var qtd = validarQuantidadeInteira_(params && params.quantidade, "Quantidade");
  var lote = limitarTexto_(params && params.lote, 60);
  var validadeTexto = texto_(params && params.validade);
  var validade = validadeTexto ? normalizarData_(validadeTexto) : null;
  var observacao = limitarTexto_(params && params.observacao, CONFIG.LIMITES.maxObservacao);

  if (!ehAreaValida_(area)) erros.push("Area invalida.");
  if (!idInsumo.ok) erros.push(idInsumo.erro);
  if (tipo !== CONFIG.TIPOS_MOVIMENTO.ENTRADA && tipo !== CONFIG.TIPOS_MOVIMENTO.BAIXA) {
    erros.push("Tipo de movimentacao invalido.");
  }
  if (!qtd.ok) erros.push(qtd.erro);
  if (validadeTexto && !validade) erros.push("Validade invalida. Use o formato dd/mm/aaaa.");

  return {
    ok: erros.length === 0,
    erros: erros,
    dados: {
      area: area,
      idInsumo: idInsumo.ok ? idInsumo.valor : "",
      tipo: tipo,
      quantidade: qtd.ok ? qtd.valor : 0,
      lote: lote || CONFIG.LOTE_SEM_LOTE,
      validade: validade,
      observacao: observacao
    }
  };
}

function validarMotivoRejeicao_(motivo) {
  return validarTextoObrigatorio_(motivo, "Motivo da rejeicao", CONFIG.LIMITES.maxMotivo);
}

function juntarErros_(erros) {
  return (erros || []).join(" ");
}
