/**
 * Envelope unico de resposta e tratamento de erros.
 * Nao devolva stack trace ou mensagens internas ao navegador.
 */

function envelopeOk_(data, message) {
  return {
    ok: true,
    codigo: "OK",
    message: message || "",
    data: data === undefined ? null : data
  };
}

function envelopeErro_(codigo, message, detalhes) {
  return {
    ok: false,
    codigo: codigo || "ERRO_INTERNO",
    message: message || "Nao foi possivel concluir a operacao. Tente novamente.",
    data: null,
    detalhes: detalhes || null
  };
}

function erroApp_(codigo, message, detalhes) {
  var err = new Error(message);
  err.codigo = codigo;
  err.detalhes = detalhes || null;
  return err;
}

function logErro_(contexto, err) {
  var detalhe = err && err.stack ? err.stack : String(err);
  console.error("[" + contexto + "] " + detalhe);
}

function codigoErro_(err) {
  return err && err.codigo ? err.codigo : "ERRO_INTERNO";
}

function mensagemPublica_(err) {
  if (err && err.codigo && err.message) return err.message;
  return "Nao foi possivel concluir a operacao. Tente novamente em instantes.";
}

function executarEnvelope_(contexto, fn) {
  try {
    return envelopeOk_(fn());
  } catch (err) {
    logErro_(contexto, err);
    return envelopeErro_(codigoErro_(err), mensagemPublica_(err), err && err.detalhes ? err.detalhes : null);
  }
}

function respostaJson_(envelope) {
  return ContentService
    .createTextOutput(JSON.stringify(envelope))
    .setMimeType(ContentService.MimeType.JSON);
}

function respostaHtml_(html) {
  return HtmlService
    .createHtmlOutput(html)
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
