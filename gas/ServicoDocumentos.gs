/**
 * Documentos no Google Drive: termo de retirada e relatorios.
 * Servicos retornam URLs; alertas ficam apenas nos wrappers de menu.
 */

function obterOuCriarPastaPai_() {
  var iter = DriveApp.getFoldersByName(CONFIG.DRIVE.pastaPai);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(CONFIG.DRIVE.pastaPai);
}

function obterOuCriarSubpasta_(nome) {
  var pai = obterOuCriarPastaPai_();
  var iter = pai.getFoldersByName(nome);
  return iter.hasNext() ? iter.next() : pai.createFolder(nome);
}

/**
 * As pastas sao criadas pelo proprietario na migracao e compartilhadas com
 * os administradores. O Admin executa como o usuario que acessa, por isso nao
 * pode simplesmente procurar a pasta na raiz da conta dele.
 */
function obterPastaConfigurada_(tipo) {
  var chaves = {
    termos: "DRIVE_TERMOS_ID",
    relatorios: "DRIVE_RELATORIOS_ID",
    backups: "DRIVE_BACKUPS_ID"
  };
  var chave = chaves[tipo];
  if (!chave) throw erroApp_("PASTA_INVALIDA", "Tipo de pasta desconhecido.");

  var props = PropertiesService.getScriptProperties();
  var id = texto_(props.getProperty(chave));
  if (!id) {
    throw erroApp_(
      "PASTAS_NAO_CONFIGURADAS",
      "As pastas do Drive ainda nao foram configuradas. Na planilha, use o menu Inventário Saúde > Configurar pastas do Drive com a conta proprietária."
    );
  }

  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    throw erroApp_(
      "PASTA_SEM_ACESSO",
      "A pasta de " + tipo + " nao esta acessivel para a conta atual. Compartilhe a pasta do Drive com este administrador ou execute o menu Configurar pastas do Drive."
    );
  }
}

function configurarPastasDrive_() {
  var pai = obterOuCriarPastaPai_();
  var termos = obterOuCriarSubpasta_(CONFIG.DRIVE.termos);
  var relatorios = obterOuCriarSubpasta_(CONFIG.DRIVE.relatorios);
  var backups = obterOuCriarSubpasta_(CONFIG.DRIVE.backups);
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    DRIVE_PASTA_PAI_ID: pai.getId(),
    DRIVE_TERMOS_ID: termos.getId(),
    DRIVE_RELATORIOS_ID: relatorios.getId(),
    DRIVE_BACKUPS_ID: backups.getId()
  });

  var compartilhamentos = [];
  var admins = listarAdmins_().filter(function (admin) { return admin.ativo; });
  [termos, relatorios, backups].forEach(function (pasta) {
    admins.forEach(function (admin) {
      try {
        pasta.addEditor(admin.email);
        compartilhamentos.push(pasta.getName() + " -> " + admin.email);
      } catch (e) {
        logErro_("configurarPastasDrive/compartilhar", e);
      }
    });
  });

  return {
    pai: { id: pai.getId(), url: pai.getUrl() },
    termos: { id: termos.getId(), url: termos.getUrl() },
    relatorios: { id: relatorios.getId(), url: relatorios.getUrl() },
    backups: { id: backups.getId(), url: backups.getUrl() },
    compartilhamentos: compartilhamentos
  };
}

function menuConfigurarPastasDrive() {
  var ui = SpreadsheetApp.getUi();
  try {
    try {
      var arquivo = DriveApp.getFileById(abrirPlanilha_().getId());
      var proprietario = arquivo.getOwner() ? arquivo.getOwner().getEmail().toLowerCase() : "";
      var atual = emailUsuarioAtual_();
      if (proprietario && atual && proprietario !== atual) {
        var resposta = ui.alert(
          "Configurar pastas do Drive",
          "Esta ação deve ser executada pelo proprietário da planilha (" + proprietario + "). Se continuar, as pastas podem ser criadas na sua conta. Deseja continuar?",
          ui.ButtonSet.YES_NO
        );
        if (resposta !== ui.Button.YES) return;
      }
    } catch (eOwner) {
      logErro_("menuConfigurarPastasDrive/proprietario", eOwner);
    }
    var resultado = configurarPastasDrive_();
    SpreadsheetApp.getUi().alert(
      "Pastas configuradas no Drive.\n\n" +
      "Termos: " + resultado.termos.url + "\n" +
      "Relatórios: " + resultado.relatorios.url + "\n" +
      "Backups: " + resultado.backups.url + "\n\n" +
      "Compartilhamentos aplicados: " + resultado.compartilhamentos.length
    );
  } catch (err) {
    logErro_("menuConfigurarPastasDrive", err);
    SpreadsheetApp.getUi().alert("Erro ao configurar pastas: " + mensagemPublica_(err));
  }
}

function moverDocumentoParaPasta_(doc, pasta) {
  var file = DriveApp.getFileById(doc.getId());
  pasta.addFile(file);
  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (e) {
    // O arquivo pode nao estar na raiz em alguns cenarios; ignorar.
  }
  return file;
}

function nomeArquivoSeguro_(valor) {
  return texto_(valor).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

function dataParaNomeArquivo_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy HH-mm");
}

function gerarTermoRetirada_(pedido) {
  var pasta = obterPastaConfigurada_("termos");
  var nome = "Termo de Retirada - " + nomeArquivoSeguro_(pedido.protocolo) + " (" + nomeArquivoSeguro_(pedido.solicitante) + ")";
  var doc = DocumentApp.create(nome);
  var body = doc.getBody();

  var titulo = body.appendParagraph("SECRETARIA MUNICIPAL DE SAÚDE");
  titulo.setBold(true);
  titulo.setFontSize(16);

  var subtitulo = body.appendParagraph("TERMO DE RETIRADA E LIBERAÇÃO DE MATERIAIS");
  subtitulo.setBold(true);
  subtitulo.setFontSize(12);
  subtitulo.setItalic(true);
  body.appendParagraph("");

  body.appendParagraph("Código do Pedido: " + texto_(pedido.protocolo));
  body.appendParagraph("Data da Solicitação: " + texto_(pedido.dataPedido));
  body.appendParagraph("Data de Emissão: " + formatarDataHora_(new Date()));
  body.appendParagraph("Solicitante / Retirante: " + texto_(pedido.solicitante));
  body.appendParagraph("Setor de Destino: " + texto_(pedido.setor));
  if (texto_(pedido.observacao)) {
    body.appendParagraph("Observação: " + texto_(pedido.observacao));
  }
  body.appendParagraph("");

  var secao = body.appendParagraph("Relação de Itens Aprovados:");
  secao.setBold(true);

  var tabela = [["Área", "ID Insumo", "Descrição do Produto", "Unidade", "Qtd Retirada"]];
  (pedido.itens || []).forEach(function (item) {
    tabela.push([
      texto_(item.area),
      texto_(item.idInsumo),
      texto_(item.nome),
      normalizarUnidade_(item.unidade),
      String(numero_(item.quantidade))
    ]);
  });

  var table = body.appendTable(tabela);
  var header = table.getRow(0);
  header.setBackgroundColor("#E2E8F0");
  for (var c = 0; c < header.getNumCells(); c++) {
    header.getCell(c).getChild(0).asParagraph().setBold(true);
  }

  body.appendParagraph("");
  body.appendParagraph("");
  body.appendParagraph("");
  body.appendParagraph("____________________________________________________").setBold(true);
  body.appendParagraph("Assinatura do Responsável pela Retirada: " + texto_(pedido.solicitante));
  body.appendParagraph("Setor: " + texto_(pedido.setor));

  doc.saveAndClose();
  moverDocumentoParaPasta_(doc, pasta);

  return { id: doc.getId(), url: doc.getUrl() };
}

function gerarRelatorioCriticos_() {
  var catalogo = obterCatalogoInterno_();
  var criticos = itensCriticos_(catalogo);
  var pasta = obterPastaConfigurada_("relatorios");
  var nome = "Relatório de Insumos Críticos - " + dataParaNomeArquivo_();
  var doc = DocumentApp.create(nome);
  var body = doc.getBody();

  var titulo = body.appendParagraph("Secretaria de Saúde - Relatório de Insumos Críticos");
  titulo.setBold(true);
  titulo.setFontSize(16);

  var subtitulo = body.appendParagraph("Gerado em: " + formatarDataHora_(new Date()));
  subtitulo.setItalic(true);
  subtitulo.setFontSize(10);
  body.appendParagraph("");

  if (!criticos.length) {
    body.appendParagraph("Nenhum insumo está abaixo do estoque mínimo no momento.");
  } else {
    var porArea = {};
    criticos.forEach(function (item) {
      if (!porArea[item.area]) porArea[item.area] = [];
      porArea[item.area].push(item);
    });

    Object.keys(porArea).forEach(function (area) {
      var heading = body.appendParagraph("Área: " + area);
      heading.setBold(true);
      heading.setFontSize(13);

      var tabela = [["ID", "Insumo", "Unidade", "Estoque Atual", "Estoque Mínimo", "Faltando"]];
      porArea[area].forEach(function (item) {
        tabela.push([
          texto_(item.id),
          texto_(item.nome),
          normalizarUnidade_(item.unidade),
          String(item.atual),
          String(item.minimo),
          String(item.faltando)
        ]);
      });

      var table = body.appendTable(tabela);
      table.getRow(0).setBackgroundColor("#D9534F");
      body.appendParagraph("");
    });
  }

  doc.saveAndClose();
  moverDocumentoParaPasta_(doc, pasta);
  return { id: doc.getId(), url: doc.getUrl(), totalCriticos: criticos.length };
}

function gerarInventariosPorArea_() {
  var arquivos = [];

  areasConfiguradas_().forEach(function (area) {
    try {
      var resultado = gerarInventarioDaArea_(area);
      arquivos.push({
        area: resultado.area,
        url: resultado.url,
        id: resultado.id
      });
    } catch (err) {
      logErro_("gerarInventariosPorArea/" + area, err);
    }
  });

  return { arquivos: arquivos, total: arquivos.length };
}

function menuGerarRelatorioCriticos() {
  try {
    var resultado = gerarRelatorioCriticos_();
    SpreadsheetApp.getUi().alert(
      "Relatório gerado com sucesso!\n\nInsumos críticos: " + resultado.totalCriticos + "\n\n" + resultado.url
    );
  } catch (err) {
    logErro_("menuGerarRelatorioCriticos", err);
    SpreadsheetApp.getUi().alert("Erro ao gerar relatório: " + mensagemPublica_(err));
  }
}

function menuGerarInventariosPorArea() {
  try {
    var resultado = gerarInventariosPorArea_();
    var links = resultado.arquivos.map(function (a) { return a.area + ": " + a.url; }).join("\n");
    SpreadsheetApp.getUi().alert(
      "Inventários gerados: " + resultado.total + "\n\n" + (links || "Nenhuma área com itens.")
    );
  } catch (err) {
    logErro_("menuGerarInventariosPorArea", err);
    SpreadsheetApp.getUi().alert("Erro ao gerar relatórios: " + mensagemPublica_(err));
  }
}
