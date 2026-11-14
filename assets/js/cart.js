export function chaveItem(area, idInsumo) {
  return `${String(area || "").trim().toUpperCase()}::${String(idInsumo || "").trim().toUpperCase()}`;
}

function normalizarItem(item) {
  return {
    area: String(item.area || "").trim(),
    idInsumo: String(item.idInsumo || "").trim(),
    nome: String(item.nome || "").trim(),
    unidade: String(item.unidade || "Unidade").trim(),
    quantidade: Number(item.quantidade) || 0,
    estoque: Number(item.estoque) || 0,
    disponivel: item.disponivel !== false
  };
}

export function criarCarrinho() {
  let itens = [];

  function encontrar(chave) {
    return itens.find((item) => chaveItem(item.area, item.idInsumo) === chave) || null;
  }

  function adicionar(item) {
    const novo = normalizarItem(item);
    const quantidade = Number(novo.quantidade);

    if (!novo.area || !novo.idInsumo) {
      return { ok: false, codigo: "ITEM_INVALIDO", mensagem: "Selecione um insumo válido." };
    }
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return { ok: false, codigo: "QTD_INVALIDA", mensagem: "A quantidade deve ser um número inteiro maior que zero." };
    }
    if (quantidade > novo.estoque) {
      return {
        ok: false,
        codigo: "ESTOQUE_INSUFICIENTE",
        mensagem: `Estoque insuficiente para ${novo.nome}: disponível ${novo.estoque}. Ajuste a quantidade para continuar.`
      };
    }

    const chave = chaveItem(novo.area, novo.idInsumo);
    const existente = encontrar(chave);
    if (existente) {
      const total = existente.quantidade + quantidade;
      if (total > novo.estoque) {
        return {
          ok: false,
          codigo: "ESTOQUE_INSUFICIENTE",
          mensagem: `A soma deste item ultrapassa o estoque. Já existem ${existente.quantidade} no pedido e o disponível é ${novo.estoque}.`
        };
      }
      existente.quantidade = total;
      existente.estoque = novo.estoque;
      existente.nome = novo.nome;
      existente.unidade = novo.unidade;
      existente.disponivel = true;
      return { ok: true, item: { ...existente }, somado: true };
    }

    itens.push(novo);
    return { ok: true, item: { ...novo }, somado: false };
  }

  function alterar(chave, quantidade) {
    const item = encontrar(chave);
    if (!item) return { ok: false, codigo: "ITEM_NAO_ENCONTRADO", mensagem: "Item não encontrado no pedido." };

    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      return { ok: false, codigo: "QTD_INVALIDA", mensagem: "A quantidade deve ser um número inteiro maior que zero." };
    }
    if (qtd > item.estoque) {
      return {
        ok: false,
        codigo: "ESTOQUE_INSUFICIENTE",
        mensagem: `Estoque insuficiente para ${item.nome}: disponível ${item.estoque}.`
      };
    }
    item.quantidade = qtd;
    return { ok: true, item: { ...item } };
  }

  function remover(chave) {
    const antes = itens.length;
    itens = itens.filter((item) => chaveItem(item.area, item.idInsumo) !== chave);
    return itens.length !== antes;
  }

  function limpar() {
    itens = [];
  }

  function restaurar(lista) {
    itens = (Array.isArray(lista) ? lista : [])
      .map(normalizarItem)
      .filter((item) => item.area && item.idInsumo && Number.isFinite(item.quantidade) && item.quantidade > 0);
  }

  function atualizarCatalogo(catalogo) {
    if (!catalogo || !catalogo.estoque) return;
    const mapa = {};
    (catalogo.areas || []).forEach((area) => {
      (catalogo.estoque[area] || []).forEach((produto) => {
        mapa[chaveItem(area, produto.id)] = produto;
      });
    });

    itens = itens.map((item) => {
      const produto = mapa[chaveItem(item.area, item.idInsumo)];
      if (!produto) {
        return { ...item, disponivel: false, estoque: 0 };
      }
      return {
        ...item,
        nome: produto.nome,
        unidade: produto.unidade,
        estoque: Number(produto.atual) || 0,
        disponivel: true
      };
    });
  }

  function validar() {
    const erros = [];
    itens.forEach((item) => {
      const chave = chaveItem(item.area, item.idInsumo);
      if (!item.disponivel) {
        erros.push({
          chave,
          mensagem: `O item ${item.nome || item.idInsumo} (${item.area}) não está mais disponível no catálogo. Remova-o do pedido.`
        });
        return;
      }
      if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
        erros.push({
          chave,
          mensagem: `A quantidade de ${item.nome || item.idInsumo} deve ser um número inteiro maior que zero.`
        });
        return;
      }
      if (item.quantidade > item.estoque) {
        erros.push({
          chave,
          mensagem: `Estoque insuficiente para ${item.nome || item.idInsumo}: disponível ${item.estoque}, solicitado ${item.quantidade}.`
        });
      }
    });
    return erros;
  }

  return {
    listar() {
      return itens.map((item) => ({ ...item }));
    },
    adicionar,
    alterar,
    remover,
    limpar,
    restaurar,
    atualizarCatalogo,
    validar,
    encontrar,
    totalItens() {
      return itens.reduce((total, item) => total + (Number(item.quantidade) || 0), 0);
    },
    quantidadeItens() {
      return itens.length;
    },
    vazio() {
      return itens.length === 0;
    }
  };
}
