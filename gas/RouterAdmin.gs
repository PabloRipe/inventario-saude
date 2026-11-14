/**
 * Funcoes expostas ao painel Administrativo via google.script.run.
 * Todas exigem allowlist no servidor.
 */

function adminCarregarPainel() {
  return executarEnvelope_("adminCarregarPainel", function () {
    exigirAdmin_();
    return obterPainelAdmin_();
  });
}

function adminAprovarPedido(protocolo) {
  return executarEnvelope_("adminAprovarPedido", function () {
    return aprovarSolicitacao_(protocolo);
  });
}

function adminRejeitarPedido(protocolo, motivo) {
  return executarEnvelope_("adminRejeitarPedido", function () {
    return rejeitarSolicitacao_(protocolo, motivo);
  });
}

function adminMovimentar(dados) {
  return executarEnvelope_("adminMovimentar", function () {
    var admin = exigirAdmin_();
    return movimentar_(dados, admin.email);
  });
}

function adminCadastrarProduto(dados) {
  return executarEnvelope_("adminCadastrarProduto", function () {
    exigirAdmin_();
    return cadastrarProduto_(dados);
  });
}

function adminListarHistorico(limite) {
  return executarEnvelope_("adminListarHistorico", function () {
    exigirAdmin_();
    return listarHistoricoRecente_(limite || 100);
  });
}

function adminGerarRelatorio(tipo, parametros) {
  return executarEnvelope_("adminGerarRelatorio", function () {
    exigirAdmin_();
    return gerarRelatorioPorTipo_(tipo, parametros);
  });
}

function adminGerarTermo(protocolo) {
  return executarEnvelope_("adminGerarTermo", function () {
    return gerarTermoPedido_(protocolo);
  });
}

function adminObterCadastros() {
  return executarEnvelope_("adminObterCadastros", function () {
    exigirAdmin_();
    return obterCadastros_();
  });
}
