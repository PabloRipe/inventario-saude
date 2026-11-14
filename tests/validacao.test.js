const test = require("node:test");
const assert = require("node:assert/strict");
const { gasPadrao, carregarGas } = require("./helpers/gas-loader.js");

test("normaliza unidade numerica ou vazia para Unidade", () => {
  const gas = gasPadrao();
  assert.equal(gas.normalizarUnidade_(1), "Unidade");
  assert.equal(gas.normalizarUnidade_("1.0"), "Unidade");
  assert.equal(gas.normalizarUnidade_(""), "Unidade");
  assert.equal(gas.normalizarUnidade_("Caixa"), "Caixa");
});

test("normaliza datas em formatos aceitos", () => {
  const gas = gasPadrao();
  const a = gas.normalizarData_("13/11/2026 15:41");
  assert.ok(a instanceof Date);
  assert.equal(a.getFullYear(), 2026);
  assert.equal(a.getMonth(), 10);
  assert.equal(a.getDate(), 13);
  assert.equal(a.getHours(), 15);
  assert.equal(a.getMinutes(), 41);

  const b = gas.normalizarData_("2026-07-27 00:00:00");
  assert.ok(b instanceof Date);
  assert.equal(b.getMonth(), 6);

  assert.equal(gas.normalizarData_("1.0"), null);
  assert.equal(gas.normalizarData_("31/02/2026"), null);
});

test("protocolo novo tem formato previsivel", () => {
  const gas = gasPadrao();
  assert.match(gas.novoProtocolo_(), /^PED-\d{8}-[A-F0-9]{6}$/);
  assert.equal(gas.protocoloAltaEntropia_("PED-20261114-A1B2C3"), true);
  assert.equal(gas.protocoloAltaEntropia_("PED-6734"), false);
});

test("comparacao de nome ignora acentos, caixa e espacos extras", () => {
  const gas = gasPadrao();
  assert.equal(gas.normalizarNomeComparacao_("  José   da Silva "), "JOSE DA SILVA");
  assert.equal(
    gas.normalizarNomeComparacao_("jose da silva"),
    gas.normalizarNomeComparacao_("José da Silva")
  );
});

test("quantidade exige inteiro positivo", () => {
  const gas = gasPadrao();
  assert.equal(gas.validarQuantidadeInteira_("2", "Qtd").ok, true);
  assert.equal(gas.validarQuantidadeInteira_("2.5", "Qtd").ok, false);
  assert.equal(gas.validarQuantidadeInteira_("0", "Qtd").ok, false);
  assert.equal(gas.validarQuantidadeInteira_("-1", "Qtd").ok, false);
});

test("itens duplicados sao somados no pedido", () => {
  const gas = gasPadrao();
  const resultado = gas.validarItensPedido_([
    { area: "Limpeza", idInsumo: "L-01", quantidade: 2 },
    { area: "Limpeza", idInsumo: "L-01", quantidade: 3 },
    { area: "Odonto", idInsumo: "O-05", quantidade: 1 }
  ]);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.itens.length, 2);
  assert.equal(resultado.itens[0].quantidade, 5);
});

test("itens com area invalida sao recusados", () => {
  const gas = gasPadrao();
  const resultado = gas.validarItensPedido_([
    { area: "AreaInexistente", idInsumo: "X-01", quantidade: 1 }
  ]);
  assert.equal(resultado.ok, false);
  assert.match(resultado.erros.join(" "), /Area invalida/);
});

test("validacao de estoque explica o item e o disponivel", () => {
  const gas = gasPadrao();
  const itens = [{
    area: "Enfermagem",
    idInsumo: "E-50",
    nome: "Clorexidina",
    quantidade: 8,
    chave: gas.chaveItem_("Enfermagem", "E-50")
  }];
  const saldos = {};
  saldos[gas.chaveItem_("Enfermagem", "E-50")] = 3;
  const resultado = gas.validarEstoqueItens_(itens, saldos);
  assert.equal(resultado.ok, false);
  assert.match(resultado.erros[0].mensagem, /disponivel 3/);
});

test("solicitacao exige solicitante, setor e item", () => {
  const gas = gasPadrao();
  const resultado = gas.validarSolicitacaoBasica_({ solicitante: "", setor: "", itens: [] });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.erros.length >= 2, true);
});

test("produto exige estoque minimo preenchido", () => {
  const gas = gasPadrao();
  const invalido = gas.validarProduto_({
    area: "Limpeza",
    idInsumo: "L-99",
    nome: "Teste",
    unidadeBase: 1,
    estoqueMinimo: ""
  });
  assert.equal(invalido.ok, false);
  assert.match(invalido.erros.join(" "), /Estoque minimo/);

  const valido = gas.validarProduto_({
    area: "Limpeza",
    idInsumo: "L-99",
    nome: "Teste",
    unidadeBase: 1,
    estoqueMinimo: "5"
  });
  assert.equal(valido.ok, true);
  assert.equal(valido.dados.unidadeBase, "Unidade");
});

test("movimento sem lote usa SEM_LOTE e recusa fracao", () => {
  const gas = gasPadrao();
  const fracao = gas.validarMovimento_({
    area: "Limpeza",
    idInsumo: "L-01",
    tipo: "ENTRADA",
    quantidade: "1.5"
  });
  assert.equal(fracao.ok, false);

  const valido = gas.validarMovimento_({
    area: "Limpeza",
    idInsumo: "L-01",
    tipo: "ENTRADA",
    quantidade: "10"
  });
  assert.equal(valido.ok, true);
  assert.equal(valido.dados.lote, "SEM_LOTE");
});

test("sufixo de ID duplicado segue o padrao E-41A", () => {
  const gas = carregarGas(["Config.gs", "Formatos.gs", "Migracao.gs"], {
    Utilities: {
      formatDate: () => "20261114",
      getUuid: () => "abcdef12-3456-7890-abcd-ef1234567890"
    },
    Session: { getScriptTimeZone: () => "America/Sao_Paulo" }
  });
  assert.equal(gas.gerarIdComSufixo_("E-41", { "E-41": true }), "E-41A");
  assert.equal(gas.gerarIdComSufixo_("O-12", { "O-12": true, "O-12A": true }), "O-12B");
});


test("periodo mensal aceita AAAA-MM e MM/AAAA", () => {
  const gas = carregarGas(["Config.gs", "Formatos.gs", "ServicoRelatorios.gs"], {
    Utilities: { formatDate: () => "20261114", getUuid: () => "abcdef12-3456-7890-abcd-ef1234567890" },
    Session: { getScriptTimeZone: () => "America/Sao_Paulo" }
  });
  const a = gas.normalizarPeriodoMensal_("2026-11");
  assert.equal(a.ano, 2026);
  assert.equal(a.mes, 11);
  assert.equal(a.chave, "2026-11");
  assert.equal(a.texto, "11/2026");

  const b = gas.normalizarPeriodoMensal_("11/2026");
  assert.equal(b.chave, "2026-11");
  assert.equal(gas.normalizarPeriodoMensal_("2026-13"), null);
  assert.equal(gas.normalizarPeriodoMensal_("abc"), null);
});

test("saida usa pedido ou observacao para setor e solicitante", () => {
  const gas = carregarGas(["Config.gs", "Formatos.gs", "ServicoRelatorios.gs"], {
    Utilities: { formatDate: () => "20261114", getUuid: () => "abcdef12-3456-7890-abcd-ef1234567890" },
    Session: { getScriptTimeZone: () => "America/Sao_Paulo" }
  });

  const porMapa = gas.obterInfoSaida_("PED-1", "", "admin@x", {
    "PED-1": { setor: "Odonto", solicitante: "João" }
  });
  assert.equal(porMapa.setor, "Odonto");
  assert.equal(porMapa.solicitante, "João");

  const porObservacao = gas.obterInfoSaida_(
    "",
    "Pedido: PED-2 | Setor: ESF Sede | Solicitante: Maria",
    "admin@x",
    {}
  );
  assert.equal(porObservacao.setor, "ESF Sede");
  assert.equal(porObservacao.solicitante, "Maria");
  assert.equal(porObservacao.idPedido, "PED-2");

  const direta = gas.obterInfoSaida_("", "", "admin@x", {});
  assert.equal(direta.setor, "Movimentação direta");
  assert.equal(direta.solicitante, "admin@x");
});
