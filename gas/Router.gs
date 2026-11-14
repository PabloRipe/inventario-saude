/**
 * Rotas publicas HTTP e servico da pagina administrativa.
 */

function include_(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function escaparHtml_(valor) {
  return texto_(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function doGet(e) {
  var params = (e && e.parameter) || {};

  if (texto_(params.page).toLowerCase() === "admin") {
    try {
      return servirPaginaAdmin_();
    } catch (err) {
      logErro_("doGet/admin", err);
      return paginaAcessoNegado_(err);
    }
  }

  try {
    if (texto_(params.resource)) {
      return respostaJson_(envelopeOk_(executarRecursoGet_(params)));
    }
    return respostaJson_(envelopeOk_({
      online: true,
      nome: "Inventário Saúde",
      versao: "2.0"
    }, "API do Inventário Saúde online."));
  } catch (err) {
    logErro_("doGet", err);
    return respostaJson_(envelopeErro_(codigoErro_(err), mensagemPublica_(err), err && err.detalhes ? err.detalhes : null));
  }
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    if (!body) throw erroApp_("REQUISICAO_INVALIDA", "Corpo da requisição vazio.");
    var params;
    try {
      params = JSON.parse(body);
    } catch (parseErr) {
      throw erroApp_("REQUISICAO_INVALIDA", "JSON inválido.");
    }
    var data = executarAcao_(texto_(params && params.action), params);
    return respostaJson_(envelopeOk_(data, "Operação realizada com sucesso."));
  } catch (err) {
    logErro_("doPost", err);
    return respostaJson_(envelopeErro_(codigoErro_(err), mensagemPublica_(err), err && err.detalhes ? err.detalhes : null));
  }
}

function executarRecursoGet_(params) {
  var resource = texto_(params.resource).toLowerCase();
  if (resource === "catalogo") return obterCatalogoPublico_();
  if (resource === "pedido") return consultarPedido_(params.protocolo, params.solicitante);
  throw erroApp_("RECURSO_INVALIDO", "Recurso desconhecido.");
}

var ACOES_PUBLICAS_ = {
  CRIAR_SOLICITACAO: true,
  CONSULTAR_PEDIDO: true
};

function executarAcao_(action, params) {
  var acao = texto_(action).toUpperCase();

  if (!ACOES_PUBLICAS_[acao]) {
    // Acoes administrativas so existem via google.script.run na implantacao Admin.
    throw erroApp_("ACAO_INVALIDA", "Ação desconhecida ou não disponível por este canal.");
  }

  if (acao === "CRIAR_SOLICITACAO") return criarSolicitacao_(params);
  if (acao === "CONSULTAR_PEDIDO") return consultarPedido_(params.protocolo, params.solicitante);

  throw erroApp_("ACAO_INVALIDA", "Ação desconhecida.");
}

function gerarRelatorioPorTipo_(tipo, parametros) {
  var t = texto_(tipo).toLowerCase();
  var p = parametros || {};

  if (t === "criticos" || t === "críticos") return gerarRelatorioCriticos_();
  if (t === "geral") return gerarRelatorioGeral_();
  if (t === "area" || t === "área") return gerarInventarioDaArea_(p.area);
  if (t === "saidas" || t === "saídas" || t === "mensal") return gerarRelatorioSaidasMensais_(p.periodo);
  if (t === "inventario" || t === "inventário" || t === "inventarios" || t === "inventários") {
    return gerarInventariosPorArea_();
  }

  throw erroApp_("VALIDACAO", "Tipo de relatório inválido.");
}

function servirPaginaAdmin_() {
  var admin;
  try {
    admin = exigirAdmin_();
  } catch (err) {
    return paginaAcessoNegado_(err);
  }

  var template = HtmlService.createTemplateFromFile("Admin");
  template.email = admin.email;
  template.nome = admin.nome;
  template.publicFormUrl = CONFIG.PUBLIC_FORM_URL;
  var urlAdmin = texto_(CONFIG.ADMIN_PANEL_URL);
  if (!urlAdmin) {
    try {
      urlAdmin = ScriptApp.getService().getUrl() + "?page=admin";
    } catch (e) {
      urlAdmin = "";
    }
  }
  template.adminPanelUrl = urlAdmin;
  template.ano = new Date().getFullYear();

  return template
    .evaluate()
    .setTitle("Painel Administrativo - Inventário Saúde")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function paginaAcessoNegado_(err) {
  var mensagem = escaparHtml_(mensagemPublica_(err));
  var urlAdmin = "";
  try {
    urlAdmin = ScriptApp.getService().getUrl() + "?page=admin";
  } catch (e) {
    urlAdmin = "";
  }
  var botao = urlAdmin
    ? "<a href=\"" + escaparHtml_(urlAdmin) + "\" target=\"_blank\" rel=\"noopener\">Abrir em nova aba</a>"
    : "";
  var html =
    "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Acesso negado</title><style>" +
    "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;padding:24px}" +
    ".card{max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 20px 40px rgba(15,23,42,.08)}" +
    "h1{font-size:22px;margin:0 0 12px}p{line-height:1.6;color:#475569;margin:0 0 20px}" +
    "a{display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600}" +
    "</style></head><body><div class=\"card\"><h1>Acesso ao painel não autorizado</h1><p>" + mensagem + "</p>" +
    botao +
    "</div></body></html>";
  return respostaHtml_(html);
}
