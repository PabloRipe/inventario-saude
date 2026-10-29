// ============================================================================
// 1. ENDPOINT GET: Retorna dados do inventário, histórico, solicitações pendentes, solicitantes e setores
// ============================================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const areas = ["Limpeza", "Papelaria", "Enfermagem", "Odonto", "Ambulância"];
    let inventoryData = {};

    // Leitura do Estoque por Área
    areas.forEach(areaName => {
      const sheet = ss.getSheetByName(areaName);
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        if (rows.length > 1) {
          const headers = rows[0];
          inventoryData[areaName] = rows.slice(1).map(row => {
            let item = {};
            headers.forEach((h, idx) => {
              item[h] = row[idx] !== undefined ? row[idx] : "";
            });
            return item;
          });
        } else {
          inventoryData[areaName] = [];
        }
      }
    });

    // Leitura do Histórico de Movimentações
    const historySheet = ss.getSheetByName("Historico_Movimentacoes");
    let historyData = [];
    if (historySheet) {
      const hRows = historySheet.getDataRange().getValues();
      if (hRows.length > 1) {
        const hHeaders = hRows[0];
        historyData = hRows.slice(1).map(row => {
          let hItem = {};
          hHeaders.forEach((h, idx) => {
            hItem[h] = row[idx] !== undefined ? row[idx] : "";
          });
          return hItem;
        });
      }
    }

    // Leitura das Solicitações Pendentes
    const pendSheet = ss.getSheetByName("Solicitacoes_Pendentes");
    let pendData = [];
    if (pendSheet) {
      const pRows = pendSheet.getDataRange().getValues();
      if (pRows.length > 1) {
        const pHeaders = pRows[0];
        pendData = pRows.slice(1).map((row, index) => {
          let pItem = { rowIndex: index + 2 }; // guarda a linha real da planilha
          pHeaders.forEach((h, idx) => {
            pItem[h] = row[idx] !== undefined ? row[idx] : "";
          });
          return pItem;
        }).filter(item => String(item.Status).toUpperCase() === "PENDENTE");
      }
    }

    // Leitura dos Solicitantes Cadastrados
    let solicitantesData = [];
    const solSheet = ss.getSheetByName("Cad_Solicitantes");
    if (solSheet) {
      const sRows = solSheet.getDataRange().getValues();
      if (sRows.length > 1) solicitantesData = sRows.slice(1).map(r => r[0]).filter(Boolean);
    }

    // Leitura dos Setores Cadastrados
    let setoresData = [];
    const setSheet = ss.getSheetByName("Cad_Setores");
    if (setSheet) {
      const setRows = setSheet.getDataRange().getValues();
      if (setRows.length > 1) setoresData = setRows.slice(1).map(r => r[0]).filter(Boolean);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: inventoryData,
      history: historyData,
      pendentes: pendData,
      solicitantes: solicitantesData,
      setores: setoresData
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// 2. ENDPOINT POST: Movimentações, Cadastros e Solicitações
// ============================================================================
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { action } = params;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ------------------------------------------------------------------------
    // AÇÃO A: CRIAR SOLICITAÇÃO (Pública ou Lançamento Presencial)
    // ------------------------------------------------------------------------
    if (action === "CRIAR_SOLICITACAO") {
      const { solicitante, setor, itens } = params;
      if (!solicitante || !setor || !itens || itens.length === 0) {
        throw new Error("Dados da solicitação incompletos.");
      }

      const pendSheet = ss.getSheetByName("Solicitacoes_Pendentes");
      if (!pendSheet) throw new Error("Aba Solicitacoes_Pendentes não encontrada.");

      const idPedido = "PED-" + Math.floor(1000 + Math.random() * 9000);
      const dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

      pendSheet.appendRow([
        idPedido,
        dataHora,
        solicitante.trim(),
        setor.trim(),
        JSON.stringify(itens),
        "PENDENTE"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Solicitação ${idPedido} registrada com sucesso e enviada para aprovação!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // AÇÃO B: APROVAR SOLICITAÇÃO (Baixa + Histórico + Termo na Pasta do Drive)
    // ------------------------------------------------------------------------
    if (action === "APROVAR_SOLICITACAO") {
      const { rowIndex } = params;
      const pendSheet = ss.getSheetByName("Solicitacoes_Pendentes");
      const rowValues = pendSheet.getRange(rowIndex, 1, 1, 6).getValues()[0];
      
      const idPedido = rowValues[0];
      const dataPedido = rowValues[1];
      const solicitante = rowValues[2];
      const setor = rowValues[3];
      const itens = JSON.parse(rowValues[4]);

      // Processa a baixa no estoque de cada item do pedido
      itens.forEach(item => {
        const sheet = ss.getSheetByName(item.area);
        if (!sheet) throw new Error(`Área ${item.area} não encontrada.`);

        const data = sheet.getDataRange().getValues();
        let found = false;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(item.idInsumo).trim()) {
            const currentStock = Number(data[i][5]) || 0;
            const qtdSolicitada = Number(item.quantidade);

            if (currentStock < qtdSolicitada) {
              throw new Error(`Estoque insuficiente para o item ${item.nome} na área ${item.area}. Estoque disponível: ${currentStock}`);
            }

            const newStock = currentStock - qtdSolicitada;
            sheet.getRange(i + 1, 6).setValue(newStock);

            // Grava no Histórico de Movimentações
            const historySheet = ss.getSheetByName("Historico_Movimentacoes");
            historySheet.appendRow([
              new Date(),
              item.idInsumo,
              item.nome,
              item.area,
              "BAIXA",
              qtdSolicitada,
              "Pedido: " + idPedido,
              `Setor: ${setor} | Solicitante: ${solicitante}`
            ]);

            found = true;
            break;
          }
        }
        if (!found) throw new Error(`Insumo ${item.idInsumo} não localizado na área ${item.area}.`);
      });

      // Atualiza o status na aba Solicitacoes_Pendentes
      pendSheet.getRange(rowIndex, 6).setValue("APROVADO");

      // Localiza ou Cria a estrutura de pastas no Google Drive
      const nomePastaPai = "Inventario Saúde";
      const nomeSubpasta = "Termo de Retirada";

      let pastaPaiIter = DriveApp.getFoldersByName(nomePastaPai);
      let pastaPai = pastaPaiIter.hasNext() ? pastaPaiIter.next() : DriveApp.createFolder(nomePastaPai);

      let subpastaIter = pastaPai.getFoldersByName(nomeSubpasta);
      let subpasta = subpastaIter.hasNext() ? subpastaIter.next() : pastaPai.createFolder(nomeSubpasta);

      // Gera o documento Google Docs do Termo de Retirada
      const dataAtualStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      const doc = DocumentApp.create(`Termo de Retirada - ${idPedido} (${solicitante})`);
      const body = doc.getBody();

      const title = body.appendParagraph("SECRETARIA MUNICIPAL DE SAÚDE");
      title.setBold(true);
      title.setFontSize(16);

      const subtitle = body.appendParagraph("TERMO DE RETIRADA E LIBERAÇÃO DE MATERIAIS");
      subtitle.setBold(true);
      subtitle.setFontSize(12);
      subtitle.setItalic(true);
      body.appendParagraph("\n");

      body.appendParagraph(`Código do Pedido: ${idPedido}`);
      body.appendParagraph(`Data da Solicitação: ${dataPedido}`);
      body.appendParagraph(`Data de Emissão/Aprovação: ${dataAtualStr}`);
      body.appendParagraph(`Solicitante / Retirante: ${solicitante}`);
      body.appendParagraph(`Setor de Destino: ${setor}`);
      body.appendParagraph("\n");

      const sectionTitle = body.appendParagraph("Relação de Itens Aprovados:");
      sectionTitle.setBold(true);

      const tableData = [["Área", "ID Insumo", "Descrição do Produto", "Unidade", "Qtd Retirada"]];
      itens.forEach(i => {
        tableData.push([i.area, i.idInsumo, i.nome, i.unidade, String(i.quantidade)]);
      });

      const table = body.appendTable(tableData);
      const headerRow = table.getRow(0);
      headerRow.setBackgroundColor("#e2e8f0");
      for (let cellIdx = 0; cellIdx < headerRow.getNumCells(); cellIdx++) {
        headerRow.getCell(cellIdx).getChild(0).asParagraph().setBold(true);
      }

      body.appendParagraph("\n\n\n\n");

      // Espaço reservado para Assinatura Física
      const line = body.appendParagraph("____________________________________________________");
      line.setBold(true);
      body.appendParagraph(`Assinatura do Responsável pela Retirada: ${solicitante}`);
      body.appendParagraph(`Setor: ${setor}`);

      doc.saveAndClose();

      // Move o Termo para a subpasta "Inventario Saúde/Termo de Retirada" no Drive
      const docFile = DriveApp.getFileById(doc.getId());
      subpasta.addFile(docFile);
      DriveApp.getRootFolder().removeFile(docFile);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Solicitação ${idPedido} aprovada com sucesso!`,
        docUrl: doc.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // AÇÃO C: CADASTRAR NOVO INSUMO
    // ------------------------------------------------------------------------
    if (action === "CADASTRAR_PRODUTO") {
      const { area, idInsumo, nome, unidadeBase, tipoEmbalagem, fatorConversao, estoqueMinimo } = params;
      if (!area || !idInsumo || !nome || !unidadeBase || estoqueMinimo === undefined) {
        throw new Error("Preencha todos os campos obrigatórios do cadastro.");
      }
      const sheet = ss.getSheetByName(area);
      if (!sheet) throw new Error("Área não encontrada.");

      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === String(idInsumo).trim().toUpperCase()) {
          throw new Error("Já existe um insumo cadastrado com este ID nesta área.");
        }
      }

      sheet.appendRow([
        idInsumo.trim(),
        nome.trim(),
        unidadeBase.trim(),
        tipoEmbalagem ? tipoEmbalagem.trim() : "",
        fatorConversao ? Number(fatorConversao) : 1,
        0,
        Number(estoqueMinimo) || 0,
        "",
        ""
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Insumo ${idInsumo} cadastrado com sucesso!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // AÇÃO D: MOVIMENTAÇÃO DIRETA (Entrada/Baixa Manual no Painel)
    // ------------------------------------------------------------------------
    if (action === "MOVIMENTAR") {
      const { area, idInsumo, tipo, quantidade, lote, validade, observacao } = params;
      if (!area || !idInsumo || !tipo || !quantidade) {
        throw new Error("Parâmetros de movimentação incompletos.");
      }
      const sheet = ss.getSheetByName(area);
      if (!sheet) throw new Error("Área não encontrada.");

      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      let currentStock = 0;
      let nomeInsumo = "";

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(idInsumo).trim()) {
          rowIndex = i + 1;
          nomeInsumo = data[i][1];
          currentStock = Number(data[i][5]) || 0;
          break;
        }
      }

      if (rowIndex === -1) throw new Error("Insumo não encontrado.");

      const qtyNumber = Number(quantidade);
      let newStock = currentStock;

      if (tipo.toUpperCase() === "ENTRADA") {
        newStock += qtyNumber;
      } else if (tipo.toUpperCase() === "BAIXA") {
        if (currentStock < qtyNumber) throw new Error("Estoque insuficiente.");
        newStock -= qtyNumber;
      }

      sheet.getRange(rowIndex, 6).setValue(newStock);

      const strLote = lote ? String(lote).trim() : "-";
      const strValidade = validade ? String(validade).trim() : "-";
      const loteValidade = (strLote !== "-" || strValidade !== "-") ? `Lote: ${strLote} | Val: ${strValidade}` : "-";

      const historySheet = ss.getSheetByName("Historico_Movimentacoes");
      historySheet.appendRow([
        new Date(),
        idInsumo,
        nomeInsumo,
        area,
        tipo.toUpperCase(),
        qtyNumber,
        loteValidade,
        observacao || ""
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Movimentação registrada com sucesso! Novo estoque: ${newStock}`,
        novoEstoque: newStock
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// 3. FUNÇÕES DE BOTÃO DIRETO NA PLANILHA (GERAÇÃO DE DOCS)
// ============================================================================

// GERAR DOCS DE INSUMOS CRÍTICOS (ESTOQUE ABAIXO DO MÍNIMO)
function gerarRelatorioEstoqueBaixoDocs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const areas = ["Limpeza", "Papelaria", "Enfermagem", "Odonto", "Ambulância"];
    const dataAtual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    
    const doc = DocumentApp.create(`Relatório de Insumos Críticos - Saúde (${dataAtual})`);
    const body = doc.getBody();

    const title = body.appendParagraph("Secretaria de Saúde - Relatório de Insumos Críticos");
    title.setBold(true);
    title.setFontSize(18);

    const subtitle = body.appendParagraph(`Gerado em: ${dataAtual}`);
    subtitle.setItalic(true);
    subtitle.setFontSize(10);
    body.appendParagraph("\n");

    let totalCriticos = 0;

    areas.forEach(areaName => {
      const sheet = ss.getSheetByName(areaName);
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        if (rows.length > 1) {
          const headers = rows[0];
          const idxID = headers.indexOf("ID_Insumo");
          const idxNome = headers.indexOf("Nome");
          const idxUnidade = headers.indexOf("Unidade_Base");
          const idxAtual = headers.indexOf("Estoque_Atual");
          const idxMinimo = headers.indexOf("Estoque_Minimo");

          let itensAreaCriticos = [];

          for (let i = 1; i < rows.length; i++) {
            const atual = Number(rows[i][idxAtual]) || 0;
            const minimo = Number(rows[i][idxMinimo]) || 0;

            if (atual <= minimo) {
              itensAreaCriticos.push({
                id: rows[i][idxID],
                nome: rows[i][idxNome],
                unidade: rows[i][idxUnidade],
                atual: atual,
                minimo: minimo
              });
            }
          }

          if (itensAreaCriticos.length > 0) {
            const areaHeading = body.appendParagraph(`Área: ${areaName}`);
            areaHeading.setBold(true);
            areaHeading.setFontSize(14);
            
            const tableData = [["ID", "Insumo", "Unidade", "Estoque Atual", "Estoque Mínimo"]];
            itensAreaCriticos.forEach(item => {
              tableData.push([String(item.id), String(item.nome), String(item.unidade), String(item.atual), String(item.minimo)]);
              totalCriticos++;
            });

            const table = body.appendTable(tableData);
            table.getRow(0).setBackgroundColor("#d9534f");
            body.appendParagraph("\n");
          }
        }
      }
    });

    if (totalCriticos === 0) {
      body.appendParagraph("Parabéns! Nenhum insumo se encontra abaixo do estoque mínimo no momento.");
    }

    doc.saveAndClose();
    SpreadsheetApp.getUi().alert("Relatório Gerado com Sucesso!\n\nLink do Documento:\n" + doc.getUrl());

  } catch (error) {
    SpreadsheetApp.getUi().alert("Erro ao gerar relatório: " + error.toString());
  }
}

// GERAR DOCS COMPLETOS SEPARADOS POR ÁREA (COM LINHAS EM VERMELHO PARA ITENS CRÍTICOS)
function gerarRelatoriosCompletosPorArea() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const areas = ["Limpeza", "Papelaria", "Enfermagem", "Odonto", "Ambulância"];
    const dataAtual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

    areas.forEach(areaName => {
      const sheet = ss.getSheetByName(areaName);
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        if (rows.length > 1) {
          const headers = rows[0];
          const idxID = headers.indexOf("ID_Insumo");
          const idxNome = headers.indexOf("Nome");
          const idxUnidade = headers.indexOf("Unidade_Base");
          const idxAtual = headers.indexOf("Estoque_Atual");
          const idxMinimo = headers.indexOf("Estoque_Minimo");

          const doc = DocumentApp.create(`Inventário Completo - Área: ${areaName} (${dataAtual})`);
          const body = doc.getBody();

          const title = body.appendParagraph(`Secretaria de Saúde - Inventário Completo`);
          title.setBold(true);
          title.setFontSize(16);

          const subtitle = body.appendParagraph(`Área: ${areaName.toUpperCase()} | Gerado em: ${dataAtual}`);
          subtitle.setItalic(true);
          subtitle.setFontSize(10);
          body.appendParagraph("\n");

          const tableData = [["ID", "Insumo", "Unidade", "Estoque Atual", "Estoque Mínimo", "Status"]];
          let linhasComAlerta = [];

          for (let i = 1; i < rows.length; i++) {
            const id = String(rows[i][idxID]);
            const nome = String(rows[i][idxNome]);
            const unidade = String(rows[i][idxUnidade]);
            const atual = Number(rows[i][idxAtual]) || 0;
            const minimo = Number(rows[i][idxMinimo]) || 0;
            const status = atual <= minimo ? "CRÍTICO" : "Normal";

            tableData.push([id, nome, unidade, String(atual), String(minimo), status]);

            if (atual <= minimo) {
              linhasComAlerta.push(i);
            }
          }

          const table = body.appendTable(tableData);
          const headerRow = table.getRow(0);
          headerRow.setBackgroundColor("#334155");
          for (let h = 0; h < headerRow.getNumCells(); h++) {
            headerRow.getCell(h).getChild(0).asParagraph().setBold(true);
            headerRow.getCell(h).getChild(0).asParagraph().setForegroundColor("#FFFFFF");
          }

          linhasComAlerta.forEach(linhaIdx => {
            const row = table.getRow(linhaIdx);
            for (let c = 0; c < row.getNumCells(); c++) {
              const cell = row.getCell(c);
              cell.setBackgroundColor("#FEE2E2");
              const para = cell.getChild(0).asParagraph();
              para.setForegroundColor("#991B1B");
              para.setBold(true);
            }
          });

          doc.saveAndClose();
        }
      }
    });

    SpreadsheetApp.getUi().alert("Relatórios por Área Gerados com Sucesso!\n\nVerifique o seu Google Drive para acessar os arquivos criados.");

  } catch (error) {
    SpreadsheetApp.getUi().alert("Erro ao gerar relatórios: " + error.toString());
  }
}
