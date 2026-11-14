import { CONFIG } from "./config.js";
import { carregarCatalogo, consultarPedido, criarSolicitacao, ApiError } from "./api.js";
import { carregarRascunho, salvarRascunho, limparRascunho, carregarPreferencias, salvarPreferencias } from "./storage.js";
import { criarCarrinho, chaveItem } from "./cart.js";
import {
  qs,
  criar,
  limpar,
  mostrarToast,
  abrirModal,
  fecharModal,
  mostrarAlerta,
  criarBadgeStatus,
  formatarNumero,
  copiarTexto,
  bloquearBotao,
  restaurarBotao,
  rolarPara
} from "./ui.js";

const estado = {
  catalogo: null,
  carrinho: criarCarrinho(),
  itemSelecionado: null,
  resultados: [],
  indiceAtivo: -1,
  enviando: false,
  presencial: false,
  retornoAdmin: null,
  embed: false
};

const el = {};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
async function iniciar() {
  mapearElementos();
  configurarModo();
  ligarEventos();
  preencherPreferencias();
  atualizarContadorObservacao();

  const carregou = await recarregarCatalogo();
  if (carregou) restaurarRascunho();
}

function mapearElementos() {
  el.solicitante = qs("#solicitante");
  el.setor = qs("#setor");
  el.observacao = qs("#observacao");
  el.obsCount = qs("#obsCount");
  el.listaSolicitantes = qs("#listaSolicitantes");
  el.listaSetores = qs("#listaSetores");

  el.area = qs("#area");
  el.buscaInsumo = qs("#buscaInsumo");
  el.resultados = qs("#resultadosInsumo");
  el.quantidade = qs("#quantidade");
  el.btnAdicionar = qs("#btnAdicionar");
  el.itemSelecionado = qs("#itemSelecionado");

  el.carrinhoBody = qs("#carrinhoBody");
  el.carrinhoVazio = qs("#carrinhoVazio");
  el.carrinhoResumo = qs("#carrinhoResumo");
  el.totalItens = qs("#totalItens");
  el.btnLimpar = qs("#btnLimpar");
  el.btnRevisar = qs("#btnRevisar");
  el.tabelaWrap = el.carrinhoBody ? el.carrinhoBody.closest(".table-wrap") : null;

  el.btnAbrirStatus = qs("#btnAbrirStatus");
  el.secaoStatus = qs("#secaoStatus");
  el.formStatus = qs("#formStatus");
  el.protocoloStatus = qs("#protocoloStatus");
  el.solicitanteStatus = qs("#solicitanteStatus");
  el.btnConsultarStatus = qs("#btnConsultarStatus");
  el.statusResultado = qs("#statusResultado");

  el.bannerPresencial = qs("#bannerPresencial");
  el.linkVoltarPainelBanner = qs("#linkVoltarPainelBanner");
  el.bannerConexao = qs("#bannerConexao");
  el.btnTentarNovamente = qs("#btnTentarNovamente");

  el.modalAlerta = qs("#modalAlerta");
  el.btnFecharAlerta = qs("#btnFecharAlerta");
  el.modalConfirmar = qs("#modalConfirmar");
  el.confirmarResumo = qs("#confirmarResumo");
  el.btnCancelarConfirmacao = qs("#btnCancelarConfirmacao");
  el.btnConfirmarEnvio = qs("#btnConfirmarEnvio");
  el.modalSucesso = qs("#modalSucesso");
  el.protocoloSucesso = qs("#protocoloSucesso");
  el.btnCopiarProtocolo = qs("#btnCopiarProtocolo");
  el.sucessoAviso = qs("#sucessoAviso");
  el.btnNovaSolicitacao = qs("#btnNovaSolicitacao");
  el.btnVerStatusSucesso = qs("#btnVerStatusSucesso");
  el.linkVoltarPainelSucesso = qs("#linkVoltarPainelSucesso");
}

function configurarModo() {
  const params = new URLSearchParams(window.location.search);
  estado.presencial = params.get("presencial") === "1";

  let embed = params.get("embed") === "1";
  try {
    embed = embed || window.self !== window.top;
  } catch (erro) {
    embed = true;
  }
  estado.embed = embed;
  document.body.classList.toggle("embed", embed);

  if (estado.presencial) {
    el.bannerPresencial.classList.remove("hidden");
  }

  const retorno = params.get("retorno") || "";
  if (urlRetornoValida(retorno)) {
    estado.retornoAdmin = retorno;
    el.linkVoltarPainelBanner.href = retorno;
    el.linkVoltarPainelBanner.classList.remove("hidden");
    el.linkVoltarPainelSucesso.href = retorno;
    el.linkVoltarPainelSucesso.classList.remove("hidden");
  }
}

function urlRetornoValida(valor) {
  if (!valor) return false;
  try {
    const url = new URL(valor);
    return (
      url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      url.pathname.indexOf("/macros/") !== -1 &&
      url.searchParams.get("page") === "admin"
    );
  } catch (erro) {
    return false;
  }
}

function ligarEventos() {
  el.solicitante.addEventListener("input", salvarRascunhoAtual);
  el.setor.addEventListener("input", salvarRascunhoAtual);
  el.observacao.addEventListener("input", () => {
    atualizarContadorObservacao();
    salvarRascunhoAtual();
  });

  el.area.addEventListener("change", () => {
    limparSelecaoInsumo({ manterBusca: true });
    atualizarResultados();
    el.buscaInsumo.focus();
  });

  el.buscaInsumo.addEventListener("input", aoDigitarBusca);
  el.buscaInsumo.addEventListener("focus", () => {
    if (el.buscaInsumo.value.trim()) atualizarResultados();
  });
  el.buscaInsumo.addEventListener("keydown", navegarResultados);
  el.quantidade.addEventListener("input", atualizarBotaoAdicionar);
  el.quantidade.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      adicionarAoCarrinho();
    }
  });
  el.btnAdicionar.addEventListener("click", adicionarAoCarrinho);

  el.carrinhoBody.addEventListener("change", aoAlterarQuantidadeCarrinho);
  el.carrinhoBody.addEventListener("click", aoClicarCarrinho);
  el.btnLimpar.addEventListener("click", limparCarrinho);
  el.btnRevisar.addEventListener("click", revisarPedido);

  el.btnFecharAlerta.addEventListener("click", () => fecharModal(el.modalAlerta));
  el.btnCancelarConfirmacao.addEventListener("click", () => fecharModal(el.modalConfirmar));
  el.btnConfirmarEnvio.addEventListener("click", enviarPedido);

  el.btnAbrirStatus.addEventListener("click", abrirConsultaStatus);
  el.formStatus.addEventListener("submit", (evento) => {
    evento.preventDefault();
    consultarStatus();
  });

  el.btnTentarNovamente.addEventListener("click", async () => {
    const ok = await recarregarCatalogo();
    if (ok) restaurarRascunho();
  });

  el.btnCopiarProtocolo.addEventListener("click", async () => {
    const protocolo = el.protocoloSucesso.textContent.trim();
    const ok = await copiarTexto(protocolo);
    mostrarToast(ok ? "Código copiado." : "Não foi possível copiar. Selecione o código manualmente.", ok ? "success" : "error");
  });

  el.btnNovaSolicitacao.addEventListener("click", () => {
    fecharModal(el.modalSucesso);
    el.area.value = "";
    limparSelecaoInsumo();
    esconderResultados();
    el.buscaInsumo.focus();
  });

  el.btnVerStatusSucesso.addEventListener("click", async () => {
    const protocolo = el.protocoloSucesso.textContent.trim();
    fecharModal(el.modalSucesso);
    el.protocoloStatus.value = protocolo;
    if (!el.solicitanteStatus.value) el.solicitanteStatus.value = el.solicitante.value.trim();
    rolarPara(el.secaoStatus);
    await consultarStatus();
  });

  el.modalAlerta.addEventListener("click", (evento) => {
    if (evento.target === el.modalAlerta) fecharModal(el.modalAlerta);
  });
  el.modalConfirmar.addEventListener("click", (evento) => {
    if (evento.target === el.modalConfirmar) fecharModal(el.modalConfirmar);
  });
  el.modalSucesso.addEventListener("click", (evento) => {
    if (evento.target === el.modalSucesso) fecharModal(el.modalSucesso);
  });

  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".field-search")) esconderResultados();
  });
}

function preencherPreferencias() {
  const prefs = carregarPreferencias();
  if (!el.solicitante.value && prefs.solicitante) el.solicitante.value = prefs.solicitante;
  if (!el.setor.value && prefs.setor) el.setor.value = prefs.setor;
}

async function recarregarCatalogo(opcoes = {}) {
  const silencioso = opcoes.silencioso === true;
  try {
    const catalogo = await carregarCatalogo();
    estado.catalogo = catalogo || { areas: [], estoque: {}, solicitantes: [], setores: [] };
    estado.catalogo.areas = Array.isArray(estado.catalogo.areas) ? estado.catalogo.areas : [];
    estado.catalogo.estoque = estado.catalogo.estoque || {};
    estandarizarEstoque(estado.catalogo);

    desabilitarFormulario(false);
    preencherAreas();
    preencherListasAuxiliares();
    estado.carrinho.atualizarCatalogo(estado.catalogo);
    renderizarCarrinho();
    if (estado.itemSelecionado) limparSelecaoInsumo({ manterBusca: true });
    if (el.buscaInsumo.value.trim()) atualizarResultados();
    el.bannerConexao.classList.add("hidden");
    return true;
  } catch (erro) {
    if (!silencioso) {
      el.bannerConexao.classList.remove("hidden");
      desabilitarFormulario(true);
    }
    return false;
  }
}

function estandarizarEstoque(catalogo) {
  catalogo.areas.forEach((area) => {
    const itens = Array.isArray(catalogo.estoque[area]) ? catalogo.estoque[area] : [];
    catalogo.estoque[area] = itens
      .map((item) => ({
        id: String(item.id || "").trim(),
        nome: String(item.nome || "").trim(),
        unidade: String(item.unidade || "Unidade").trim(),
        atual: Number(item.atual) || 0
      }))
      .filter((item) => item.id);
  });
}

function preencherAreas() {
  const anterior = el.area.value;
  limpar(el.area);
  el.area.appendChild(criar("option", { texto: "Todas as áreas", atributos: { value: "" } }));
  estado.catalogo.areas.forEach((area) => {
    el.area.appendChild(criar("option", { texto: area, atributos: { value: area } }));
  });
  if (anterior && estado.catalogo.areas.indexOf(anterior) !== -1) {
    el.area.value = anterior;
  }
}

function preencherListasAuxiliares() {
  limpar(el.listaSolicitantes);
  (estado.catalogo.solicitantes || []).forEach((nome) => {
    el.listaSolicitantes.appendChild(criar("option", { atributos: { value: nome } }));
  });

  limpar(el.listaSetores);
  (estado.catalogo.setores || []).forEach((nome) => {
    el.listaSetores.appendChild(criar("option", { atributos: { value: nome } }));
  });
}

function restaurarRascunho() {
  const rascunho = carregarRascunho();
  if (!rascunho) return;

  if (typeof rascunho.solicitante === "string") el.solicitante.value = rascunho.solicitante;
  if (typeof rascunho.setor === "string") el.setor.value = rascunho.setor;
  if (typeof rascunho.observacao === "string") el.observacao.value = rascunho.observacao;
  atualizarContadorObservacao();

  if (Array.isArray(rascunho.itens) && rascunho.itens.length) {
    estado.carrinho.restaurar(rascunho.itens);
    estado.carrinho.atualizarCatalogo(estado.catalogo);
    renderizarCarrinho();
    mostrarToast("Rascunho restaurado. Confira as quantidades antes de enviar.");
  }
}

function salvarRascunhoAtual() {
  salvarRascunho({
    solicitante: el.solicitante.value.trim(),
    setor: el.setor.value.trim(),
    observacao: el.observacao.value,
    itens: estado.carrinho.listar().map((item) => ({
      area: item.area,
      idInsumo: item.idInsumo,
      nome: item.nome,
      unidade: item.unidade,
      quantidade: item.quantidade,
      estoque: item.estoque
    }))
  });
}

function atualizarContadorObservacao() {
  el.obsCount.textContent = String(el.observacao.value.length);
}

function itensDisponiveis() {
  if (!estado.catalogo || !estado.catalogo.estoque) return [];

  const filtroArea = el.area.value;
  const areas = filtroArea ? [filtroArea] : (estado.catalogo.areas || []);
  const lista = [];

  areas.forEach((area) => {
    (estado.catalogo.estoque[area] || []).forEach((item) => {
      lista.push({ ...item, area });
    });
  });

  return lista;
}

function normalizarBusca(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filtrarItens(termo) {
  const alvo = normalizarBusca(termo);
  if (!alvo) return [];

  return itensDisponiveis()
    .filter((item) => {
      return normalizarBusca(item.nome).indexOf(alvo) !== -1 || normalizarBusca(item.id).indexOf(alvo) !== -1;
    })
    .sort((a, b) => {
      const aNome = normalizarBusca(a.nome);
      const bNome = normalizarBusca(b.nome);
      const aPrioridade = aNome.indexOf(alvo) === 0 || normalizarBusca(a.id).indexOf(alvo) === 0 ? 0 : 1;
      const bPrioridade = bNome.indexOf(alvo) === 0 || normalizarBusca(b.id).indexOf(alvo) === 0 ? 0 : 1;
      if (aPrioridade !== bPrioridade) return aPrioridade - bPrioridade;
      return aNome.localeCompare(bNome, "pt-BR");
    })
    .slice(0, CONFIG.MAX_RESULTADOS);
}

function aoDigitarBusca() {
  if (estado.itemSelecionado) {
    const valor = el.buscaInsumo.value.trim();
    if (valor !== estado.itemSelecionado.nome) limparSelecaoInsumo({ manterBusca: true });
  }
  atualizarResultados();
}

function atualizarResultados() {
  const termo = el.buscaInsumo.value.trim();
  if (!termo) {
    esconderResultados();
    return;
  }

  estado.resultados = filtrarItens(termo);
  estado.indiceAtivo = -1;
  limpar(el.resultados);

  if (!estado.resultados.length) {
    el.resultados.appendChild(criar("div", { className: "combo-empty", texto: "Nenhum insumo encontrado." }));
    el.resultados.hidden = false;
    el.buscaInsumo.setAttribute("aria-expanded", "true");
    return;
  }

  estado.resultados.forEach((item, indice) => {
    const botao = criar("button", {
      className: "combo-option",
      atributos: {
        type: "button",
        role: "option",
        id: `opcao-insumo-${indice}`,
        "aria-selected": "false"
      },
      dataset: { indice: indice }
    });
    const principal = criar("span", { className: "combo-option__main" }, [
      criar("span", { className: "combo-option__name", texto: item.nome || item.id }),
      criar("span", {
        className: "combo-option__meta",
        texto: `${item.area} · ${item.id} · Estoque: ${formatarNumero(item.atual)} ${item.unidade}`
      })
    ]);
    botao.appendChild(principal);
    if (item.atual <= 0) botao.appendChild(criar("span", { className: "badge badge-danger", texto: "Sem estoque" }));
    botao.addEventListener("click", () => selecionarItem(item));
    el.resultados.appendChild(botao);
  });

  el.resultados.hidden = false;
  el.buscaInsumo.setAttribute("aria-expanded", "true");
  el.buscaInsumo.removeAttribute("aria-activedescendant");
}

function esconderResultados() {
  if (!el.resultados) return;
  el.resultados.hidden = true;
  el.resultados.innerHTML = "";
  el.buscaInsumo.setAttribute("aria-expanded", "false");
  el.buscaInsumo.removeAttribute("aria-activedescendant");
  estado.resultados = [];
  estado.indiceAtivo = -1;
}

function navegarResultados(evento) {
  if (el.resultados.hidden || !estado.resultados.length) return;

  if (evento.key === "ArrowDown") {
    evento.preventDefault();
    estado.indiceAtivo = Math.min(estado.indiceAtivo + 1, estado.resultados.length - 1);
    destacarResultado();
  } else if (evento.key === "ArrowUp") {
    evento.preventDefault();
    estado.indiceAtivo = Math.max(estado.indiceAtivo - 1, 0);
    destacarResultado();
  } else if (evento.key === "Enter") {
    evento.preventDefault();
    const indice = estado.indiceAtivo >= 0 ? estado.indiceAtivo : 0;
    const item = estado.resultados[indice];
    if (item) selecionarItem(item);
  } else if (evento.key === "Escape") {
    esconderResultados();
  }
}

function destacarResultado() {
  Array.from(el.resultados.querySelectorAll(".combo-option")).forEach((opcao, indice) => {
    const ativo = indice === estado.indiceAtivo;
    opcao.setAttribute("aria-selected", ativo ? "true" : "false");
    if (ativo) {
      el.buscaInsumo.setAttribute("aria-activedescendant", opcao.id);
      opcao.scrollIntoView({ block: "nearest" });
    }
  });
}

function selecionarItem(item) {
  estado.itemSelecionado = item;
  el.buscaInsumo.value = item.nome;
  esconderResultados();
  renderizarItemSelecionado();
  el.quantidade.disabled = false;
  el.quantidade.max = String(item.atual);
  el.quantidade.value = "";
  el.quantidade.focus();
  atualizarBotaoAdicionar();
}

function renderizarItemSelecionado() {
  limpar(el.itemSelecionado);
  const item = estado.itemSelecionado;
  if (!item) {
    el.itemSelecionado.classList.add("hidden");
    return;
  }

  const info = criar("div", {}, [
    criar("div", { className: "selected-item__name", texto: item.nome }),
    criar("div", {
      className: "selected-item__meta",
      texto: `${item.area} · ${item.id} · Unidade: ${item.unidade} · Estoque disponível: ${formatarNumero(item.atual)}`
    })
  ]);

  if (item.atual <= 0) {
    info.appendChild(criar("div", { className: "row-warning", texto: "Sem estoque disponível. Não é possível adicionar este item." }));
  }

  const btnTrocar = criar("button", {
    className: "btn btn-ghost btn-small",
    texto: "Trocar",
    atributos: { type: "button" }
  });
  btnTrocar.addEventListener("click", () => {
    limparSelecaoInsumo();
    el.buscaInsumo.focus();
  });

  el.itemSelecionado.appendChild(info);
  el.itemSelecionado.appendChild(btnTrocar);
  el.itemSelecionado.classList.remove("hidden");
}

function limparSelecaoInsumo(opcoes = {}) {
  estado.itemSelecionado = null;
  renderizarItemSelecionado();
  el.quantidade.value = "";
  el.quantidade.disabled = true;
  el.quantidade.removeAttribute("max");
  el.btnAdicionar.disabled = true;
  if (!opcoes.manterBusca) el.buscaInsumo.value = "";
}

function atualizarBotaoAdicionar() {
  const item = estado.itemSelecionado;
  const qtd = Number(el.quantidade.value);
  const valido = !!item && Number.isInteger(qtd) && qtd > 0;
  el.btnAdicionar.disabled = !valido;
}

function adicionarAoCarrinho() {
  const item = estado.itemSelecionado;
  if (!item) {
    mostrarAlerta("Selecione um insumo", "Busque pelo nome ou código e clique em um resultado.");
    return;
  }

  const qtd = Number(el.quantidade.value);
  if (!Number.isInteger(qtd) || qtd <= 0) {
    mostrarAlerta("Quantidade inválida", "Informe um número inteiro maior que zero. Quantidades fracionadas não são permitidas.");
    return;
  }
  if (qtd > item.atual) {
    mostrarAlerta(
      "Estoque insuficiente",
      `O pedido não pode ultrapassar o estoque disponível. Para ${item.nome}, estão disponíveis ${formatarNumero(item.atual)} ${item.unidade}.`,
      [`Quantidade solicitada: ${formatarNumero(qtd)}`, `Disponível agora: ${formatarNumero(item.atual)}`]
    );
    return;
  }

  const resultado = estado.carrinho.adicionar({
    area: item.area,
    idInsumo: item.id,
    nome: item.nome,
    unidade: item.unidade,
    quantidade: qtd,
    estoque: item.atual
  });

  if (!resultado.ok) {
    mostrarAlerta("Não foi possível adicionar", resultado.mensagem);
    return;
  }

  renderizarCarrinho();
  salvarRascunhoAtual();
  mostrarToast(resultado.somado ? "Quantidade atualizada no pedido." : "Item adicionado ao pedido.", "success");
  limparSelecaoInsumo();
  el.buscaInsumo.focus();
}

function renderizarCarrinho() {
  const itens = estado.carrinho.listar();
  const erros = estado.carrinho.validar();
  limpar(el.carrinhoBody);

  const vazio = itens.length === 0;
  if (el.tabelaWrap) el.tabelaWrap.classList.toggle("hidden", vazio);
  el.carrinhoVazio.classList.toggle("hidden", !vazio);
  el.btnLimpar.classList.toggle("hidden", vazio);
  el.totalItens.textContent = String(estado.carrinho.totalItens());

  if (vazio) {
    el.carrinhoResumo.textContent = "Nenhum item adicionado.";
    el.btnRevisar.disabled = true;
    return;
  }

  itens.forEach((item) => {
    const chave = chaveItem(item.area, item.idInsumo);
    const invalido = !item.disponivel || item.quantidade > item.estoque;
    const tr = criar("tr", { className: invalido ? "row-invalid" : "" });

    tr.appendChild(criar("td", { texto: item.area }));
    tr.appendChild(criar("td", { texto: item.idInsumo }));
    tr.appendChild(criar("td", { texto: item.nome }));
    tr.appendChild(criar("td", { texto: item.unidade }));

    const tdQtd = criar("td");
    const input = criar("input", {
      className: "qty-input",
      atributos: {
        type: "number",
        min: "1",
        step: "1",
        inputmode: "numeric",
        "aria-label": `Quantidade de ${item.nome}`
      },
      dataset: { chave, anterior: String(item.quantidade) }
    });
    input.value = String(item.quantidade);
    tdQtd.appendChild(input);
    if (invalido) {
      tdQtd.appendChild(criar("span", {
        className: "row-warning",
        texto: item.disponivel ? `Estoque: ${formatarNumero(item.estoque)}` : "Indisponível no catálogo"
      }));
    }
    tr.appendChild(tdQtd);

    const tdAcao = criar("td", { className: "col-action" });
    const btnRemover = criar("button", {
      className: "btn btn-ghost btn-small",
      texto: "Remover",
      atributos: { type: "button" },
      dataset: { acao: "remover", chave }
    });
    tdAcao.appendChild(btnRemover);
    tr.appendChild(tdAcao);
    el.carrinhoBody.appendChild(tr);
  });

  el.carrinhoResumo.textContent = erros.length
    ? `${estado.carrinho.quantidadeItens()} tipo(s) no pedido. Corrija os itens destacados.`
    : `${estado.carrinho.quantidadeItens()} tipo(s) no pedido.`;
  el.btnRevisar.disabled = erros.length > 0;
}

function aoAlterarQuantidadeCarrinho(evento) {
  const input = evento.target;
  if (!input || !input.classList.contains("qty-input")) return;

  const chave = input.dataset.chave;
  const anterior = input.dataset.anterior;
  const resultado = estado.carrinho.alterar(chave, input.value);

  if (!resultado.ok) {
    input.value = anterior;
    mostrarAlerta("Quantidade não alterada", resultado.mensagem);
    return;
  }

  renderizarCarrinho();
  salvarRascunhoAtual();
}

function aoClicarCarrinho(evento) {
  const botao = evento.target.closest("[data-acao='remover']");
  if (!botao) return;
  estado.carrinho.remover(botao.dataset.chave);
  renderizarCarrinho();
  salvarRascunhoAtual();
  mostrarToast("Item removido do pedido.");
}

function limparCarrinho() {
  if (estado.carrinho.vazio()) return;
  estado.carrinho.limpar();
  renderizarCarrinho();
  salvarRascunhoAtual();
  mostrarToast("Itens removidos do pedido.");
}

async function revisarPedido() {
  const solicitante = el.solicitante.value.trim();
  const setor = el.setor.value.trim();

  if (!solicitante || !setor) {
    mostrarAlerta("Identificação incompleta", "Preencha o solicitante e o setor de destino antes de revisar o pedido.");
    if (!solicitante) el.solicitante.focus();
    else el.setor.focus();
    return;
  }
  if (estado.carrinho.vazio()) {
    mostrarAlerta("Pedido vazio", "Adicione pelo menos um item antes de enviar.");
    return;
  }

  bloquearBotao(el.btnRevisar, "Conferindo estoque...");
  try {
    const carregou = await recarregarCatalogo({ silencioso: true });
    if (!carregou) {
      mostrarAlerta("Não foi possível conferir o estoque", "Verifique a conexão e tente novamente antes de enviar o pedido.");
      return;
    }

    const erros = estado.carrinho.validar();
    if (erros.length) {
      mostrarAlerta(
        "Revise o pedido",
        "O estoque mudou ou há quantidades inválidas. Ajuste os itens destacados antes de enviar.",
        erros.map((erro) => erro.mensagem)
      );
      return;
    }

    montarResumoConfirmacao();
    abrirModal(el.modalConfirmar);
  } finally {
    restaurarBotao(el.btnRevisar);
    el.btnRevisar.disabled = estado.carrinho.vazio() || estado.carrinho.validar().length > 0;
  }
}

function montarResumoConfirmacao() {
  limpar(el.confirmarResumo);

  const secaoIdentificacao = criar("div", { className: "review-section" }, [
    criar("h3", { texto: "Identificação" }),
    criar("dl", { className: "review-meta" }, [
      criar("div", {}, [
        criar("dt", { texto: "Solicitante" }),
        criar("dd", { texto: el.solicitante.value.trim() })
      ]),
      criar("div", {}, [
        criar("dt", { texto: "Setor" }),
        criar("dd", { texto: el.setor.value.trim() })
      ])
    ])
  ]);

  const itens = estado.carrinho.listar();
  const lista = criar("div", { className: "review-list" });
  itens.forEach((item) => {
    lista.appendChild(
      criar("div", { className: "review-item" }, [
        criar("span", { texto: `${item.nome} (${item.idInsumo}) · ${item.area}` }),
        criar("span", { texto: `${formatarNumero(item.quantidade)} ${item.unidade}` })
      ])
    );
  });

  const secaoItens = criar("div", { className: "review-section" }, [
    criar("h3", { texto: `Itens (${estado.carrinho.totalItens()} unidades)` }),
    lista
  ]);

  el.confirmarResumo.appendChild(secaoIdentificacao);
  el.confirmarResumo.appendChild(secaoItens);

  const observacao = el.observacao.value.trim();
  if (observacao) {
    el.confirmarResumo.appendChild(
      criar("div", { className: "review-section" }, [
        criar("h3", { texto: "Observação" }),
        criar("p", { texto: observacao })
      ])
    );
  }
}

async function enviarPedido() {
  if (estado.enviando) return;

  const erros = estado.carrinho.validar();
  if (erros.length) {
    fecharModal(el.modalConfirmar);
    mostrarAlerta("Revise o pedido", "Ajuste os itens antes de enviar.", erros.map((erro) => erro.mensagem));
    return;
  }

  estado.enviando = true;
  bloquearBotao(el.btnConfirmarEnvio, "Enviando...");

  const payload = {
    solicitante: el.solicitante.value.trim(),
    setor: el.setor.value.trim(),
    observacao: el.observacao.value.trim(),
    itens: estado.carrinho.listar().map((item) => ({
      area: item.area,
      idInsumo: item.idInsumo,
      quantidade: item.quantidade
    }))
  };

  try {
    const resultado = await criarSolicitacao(payload);
    fecharModal(el.modalConfirmar);

    estado.carrinho.limpar();
    renderizarCarrinho();
    limparRascunho();
    salvarPreferencias({ solicitante: payload.solicitante, setor: payload.setor });
    limparSelecaoInsumo();
    el.observacao.value = "";
    atualizarContadorObservacao();

    el.solicitanteStatus.value = payload.solicitante;
    mostrarSucesso(resultado.protocolo);
    mostrarToast("Solicitação enviada com sucesso.", "success");
    notificarPedidoCriado(resultado.protocolo);
    await recarregarCatalogo({ silencioso: true });
  } catch (erro) {
    fecharModal(el.modalConfirmar);
    const detalhes = erro instanceof ApiError ? erro.detalhes : [];
    mostrarAlerta(
      erro && erro.codigo === "ESTOQUE_INSUFICIENTE" ? "Pedido não enviado" : "Não foi possível enviar",
      (erro && erro.message) || "Tente novamente em instantes.",
      detalhes
    );
    if (erro && (erro.codigo === "ESTOQUE_INSUFICIENTE" || erro.codigo === "ITEM_NAO_ENCONTRADO")) {
      await recarregarCatalogo({ silencioso: true });
    }
  } finally {
    estado.enviando = false;
    restaurarBotao(el.btnConfirmarEnvio);
  }
}

function notificarPedidoCriado(protocolo) {
  try {
    if (window.self === window.top) return;
    window.parent.postMessage(
      { tipo: "inventario:pedido-criado", protocolo: protocolo },
      "*"
    );
  } catch (erro) {
    // iframe com restrição de comunicação
  }
}

function mostrarSucesso(protocolo) {
  el.protocoloSucesso.textContent = protocolo || "-";
  el.sucessoAviso.classList.add("hidden");
  el.sucessoAviso.textContent = "";  el.linkVoltarPainelSucesso.classList.toggle("hidden", !estado.retornoAdmin);
  abrirModal(el.modalSucesso);
}

function abrirConsultaStatus() {
  rolarPara(el.secaoStatus);
  window.setTimeout(() => el.protocoloStatus.focus(), 300);
}

async function consultarStatus() {
  const protocolo = el.protocoloStatus.value.trim();
  if (!protocolo) {
    mostrarAlerta("Informe o código", "Digite o código do pedido para consultar o status.");
    el.protocoloStatus.focus();
    return;
  }

  bloquearBotao(el.btnConsultarStatus, "Consultando...");
  try {
    const solicitante = el.solicitanteStatus ? el.solicitanteStatus.value.trim() : "";
    const pedido = await consultarPedido(protocolo, solicitante);
    renderizarStatus(pedido);
  } catch (erro) {
    limpar(el.statusResultado);
    let badge = criarBadgeStatus("NAO_ENCONTRADO");
    if (erro && erro.codigo === "VALIDACAO") {
      badge = criar("span", { className: "badge badge-pending", texto: "Atenção" });
    } else if (erro && erro.codigo === "NAO_AUTORIZADO") {
      badge = criar("span", { className: "badge badge-danger", texto: "Não autorizado" });
    }
    const card = criar("div", { className: "status-card" }, [
      criar("div", { className: "status-top" }, [
        criar("div", { className: "status-code", texto: protocolo.toUpperCase() }),
        badge
      ]),
      criar("p", { texto: (erro && erro.message) || "Não foi possível consultar o pedido." })
    ]);
    el.statusResultado.appendChild(card);
    el.statusResultado.hidden = false;
  } finally {
    restaurarBotao(el.btnConsultarStatus);
  }
}

function renderizarStatus(pedido) {
  limpar(el.statusResultado);

  const topo = criar("div", { className: "status-top" }, [
    criar("div", { className: "status-code", texto: pedido.protocolo || "-" }),
    criarBadgeStatus(pedido.status)
  ]);

  const meta = criar("dl", { className: "status-meta" }, [
    criar("div", {}, [criar("dt", { texto: "Solicitante" }), criar("dd", { texto: pedido.solicitante || "-" })]),
    criar("div", {}, [criar("dt", { texto: "Setor" }), criar("dd", { texto: pedido.setor || "-" })]),
    criar("div", {}, [criar("dt", { texto: "Solicitado em" }), criar("dd", { texto: pedido.data || "-" })]),
    criar("div", {}, [criar("dt", { texto: "Última atualização" }), criar("dd", { texto: pedido.dataStatus || "-" })])
  ]);

  const card = criar("div", { className: "status-card" }, [topo, meta]);

  if (Array.isArray(pedido.itens) && pedido.itens.length) {
    const lista = criar("div", { className: "status-items" });
    pedido.itens.forEach((item) => {
      lista.appendChild(
        criar("div", { className: "status-item" }, [
          criar("span", { texto: `${item.nome || item.idInsumo} (${item.area})` }),
          criar("strong", { texto: `${formatarNumero(item.quantidade)} ${item.unidade || ""}`.trim() })
        ])
      );
    });
    card.appendChild(lista);
  }

  if (pedido.observacao) {
    card.appendChild(criar("div", { className: "status-note", texto: `Observação: ${pedido.observacao}` }));
  }

  if (pedido.status === "REJEITADO" && pedido.motivoRejeicao) {
    card.appendChild(criar("div", { className: "status-note danger", texto: `Motivo da rejeição: ${pedido.motivoRejeicao}` }));
  }

  if (pedido.status === "APROVADO" && pedido.docUrl) {
    const link = criar("a", {
      className: "btn btn-secondary btn-small",
      texto: "Abrir termo de retirada",
      atributos: { href: pedido.docUrl, target: "_blank", rel: "noopener" }
    });
    card.appendChild(criar("div", { className: "modal-actions" }, [link]));
  }

  el.statusResultado.appendChild(card);
  el.statusResultado.hidden = false;
  rolarPara(el.statusResultado);
}

function desabilitarFormulario(desabilitado) {
  el.area.disabled = desabilitado;
  el.buscaInsumo.disabled = desabilitado;
  el.quantidade.disabled = true;
  el.btnAdicionar.disabled = true;
  el.btnRevisar.disabled = true;
  el.btnLimpar.disabled = desabilitado;
  el.btnConfirmarEnvio.disabled = desabilitado;
}
