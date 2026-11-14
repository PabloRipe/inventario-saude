/**
 * Autenticacao do painel administrativo.
 * A implantacao Admin deve executar como "usuario que acessa" e exigir Conta Google.
 */

function emailUsuarioAtual_() {
  try {
    return texto_(Session.getActiveUser().getEmail()).toLowerCase();
  } catch (e) {
    return "";
  }
}

function obterAdminAtual_() {
  var email = emailUsuarioAtual_();
  if (!email) {
    throw erroApp_(
      "NAO_AUTORIZADO",
      "Entre com uma conta Google autorizada. Se voce ja esta logado, abra o painel em uma nova aba."
    );
  }

  var sheet = obterAba_(CONFIG.SHEETS.admins, false);
  if (!sheet) {
    throw erroApp_("MIGRACAO_NECESSARIA", "A aba Admins ainda nao existe. Execute a migracao no Apps Script.");
  }

  var dados = lerSheetComoObjetos_(sheet);
  var emailCol = CONFIG.COLUNAS.admins.email;
  var nomeCol = CONFIG.COLUNAS.admins.nome;
  var ativoCol = CONFIG.COLUNAS.admins.ativo;

  for (var i = 0; i < dados.rows.length; i++) {
    var row = dados.rows[i];
    var emailPlanilha = texto_(row[emailCol]).toLowerCase();
    if (emailPlanilha === email && booleano_(row[ativoCol])) {
      return { email: email, nome: texto_(row[nomeCol]) || email };
    }
  }

  throw erroApp_(
    "NAO_AUTORIZADO",
    "A conta " + email + " nao esta na lista de administradores ativos."
  );
}

function exigirAdmin_() {
  return obterAdminAtual_();
}

function listarAdmins_() {
  var sheet = obterAba_(CONFIG.SHEETS.admins, false);
  if (!sheet) return [];
  var dados = lerSheetComoObjetos_(sheet);
  var emailCol = CONFIG.COLUNAS.admins.email;
  var nomeCol = CONFIG.COLUNAS.admins.nome;
  var ativoCol = CONFIG.COLUNAS.admins.ativo;
  return dados.rows
    .map(function (row) {
      return {
        email: texto_(row[emailCol]).toLowerCase(),
        nome: texto_(row[nomeCol]),
        ativo: booleano_(row[ativoCol])
      };
    })
    .filter(function (admin) { return !!admin.email; });
}

function garantirAdminPorEmail_(email, nome) {
  var alvo = texto_(email).toLowerCase();
  if (!alvo) return false;

  var sheet = garantirAba_(CONFIG.SHEETS.admins, headersAdmins_());
  var headers = normalizarCabecalhos_(
    sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
  );
  var dados = lerSheetComoObjetos_(sheet);
  var emailCol = CONFIG.COLUNAS.admins.email;
  var existe = dados.rows.some(function (row) {
    return texto_(row[emailCol]).toLowerCase() === alvo;
  });
  if (existe) return false;

  var obj = {};
  obj[CONFIG.COLUNAS.admins.email] = alvo;
  obj[CONFIG.COLUNAS.admins.nome] = texto_(nome) || alvo;
  obj[CONFIG.COLUNAS.admins.ativo] = true;
  obj[CONFIG.COLUNAS.admins.criadoEm] = new Date();
  appendObjeto_(sheet, headers, obj);
  return true;
}
