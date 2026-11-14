/**
 * Configuracoes centrais do Inventario Saude.
 * Altere aqui areas, abas, colunas, pastas e limites. Evite literais espalhados.
 */
var CONFIG = {
  AREAS: ["Limpeza", "Papelaria", "Enfermagem", "Odonto", "Ambulância"],

  SHEETS: {
    historico: "Historico_Movimentacoes",
    solicitacoes: "Solicitacoes_Pendentes",
    solicitantes: "Cad_Solicitantes",
    setores: "Cad_Setores",
    admins: "Admins",
    logMigracao: "Log_Migracao",
    lotes: "Estoque_Lotes"
  },

  COLUNAS: {
    estoque: {
      id: "ID_Insumo",
      nome: "Nome",
      unidade: "Unidade_Base",
      embalagem: "Tipo_Embalagem",
      fator: "Fator_Conversao",
      atual: "Estoque_Atual",
      minimo: "Estoque_Minimo",
      lote: "Lote",
      validade: "Validade"
    },
    historico: {
      data: "Data_Hora",
      id: "ID_Insumo",
      nome: "Nome_Insumo",
      area: "Area",
      tipo: "Tipo",
      quantidade: "Quantidade",
      loteValidade: "Lote_Validade",
      observacao: "Observacao",
      idPedido: "ID_Pedido",
      idLote: "ID_Lote",
      lote: "Lote",
      validade: "Validade",
      usuario: "Usuario",
      origem: "Origem"
    },
    solicitacoes: {
      id: "ID_Pedido",
      data: "Data_Hora",
      solicitante: "Solicitante",
      setor: "Setor",
      itens: "Itens",
      status: "Status",
      observacao: "Observacao",
      dataStatus: "Data_Status",
      processadoPor: "Processado_Por",
      docUrl: "Doc_URL",
      motivoRejeicao: "Motivo_Rejeicao"
    },
    admins: {
      email: "Email",
      nome: "Nome",
      ativo: "Ativo",
      criadoEm: "Criado_Em"
    },
    log: {
      data: "Data_Hora",
      etapa: "Etapa",
      area: "Area",
      id: "ID_Insumo",
      campo: "Campo",
      anterior: "Valor_Anterior",
      novo: "Valor_Novo",
      detalhe: "Detalhe"
    },
    lotes: {
      idLote: "ID_Lote",
      area: "Area",
      idInsumo: "ID_Insumo",
      nome: "Nome_Insumo",
      lote: "Lote",
      validade: "Validade",
      quantidade: "Quantidade",
      dataEntrada: "Data_Entrada",
      observacao: "Observacao"
    }
  },

  STATUS: {
    PENDENTE: "PENDENTE",
    APROVADO: "APROVADO",
    REJEITADO: "REJEITADO",
    CANCELADO: "CANCELADO"
  },

  TIPOS_MOVIMENTO: {
    ENTRADA: "ENTRADA",
    BAIXA: "BAIXA"
  },

  ORIGENS: {
    SOLICITACAO: "SOLICITACAO",
    MOVIMENTO_DIRETO: "MOVIMENTO_DIRETO",
    MIGRACAO: "MIGRACAO"
  },

  UNIDADE_PADRAO: "Unidade",
  LOTE_SEM_LOTE: "SEM_LOTE",

  DRIVE: {
    pastaPai: "Inventario Saúde",
    termos: "Termo de Retirada",
    relatorios: "Relatórios",
    backups: "Backups"
  },

  LIMITES: {
    maxItensPedido: 50,
    maxQuantidade: 1000000,
    maxNome: 120,
    maxSolicitante: 120,
    maxSetor: 120,
    maxObservacao: 500,
    maxMotivo: 500,
    maxBuscaHistorico: 200
  },

  /**
   * Preencha com o e-mail Google do primeiro administrador antes de rodar
   * a migracao. Sem isso, o painel administrativo nao libera acesso.
   */
  ADMIN_BOOTSTRAP_EMAIL: "",

  /**
   * URL publica do formulario estatico.
   * Ajuste se o repositorio for publicado em outro endereco.
   */
  PUBLIC_FORM_URL: "https://pabloripe.github.io/inventario-saude/Index.html",

  /**
   * Opcional: URL da implantacao admin (?page=admin).
   * Se vazio, o botao "Voltar ao painel" nao aparece apos um pedido presencial.
   */
  ADMIN_PANEL_URL: ""
};

function areasConfiguradas_() {
  return CONFIG.AREAS.slice();
}

function ehAreaValida_(area) {
  return CONFIG.AREAS.indexOf(String(area || "").trim()) !== -1;
}

function headersEstoque_() {
  return Object.keys(CONFIG.COLUNAS.estoque).map(function (k) {
    return CONFIG.COLUNAS.estoque[k];
  });
}

function headersHistorico_() {
  return Object.keys(CONFIG.COLUNAS.historico).map(function (k) {
    return CONFIG.COLUNAS.historico[k];
  });
}

function headersSolicitacoes_() {
  return Object.keys(CONFIG.COLUNAS.solicitacoes).map(function (k) {
    return CONFIG.COLUNAS.solicitacoes[k];
  });
}

function headersAdmins_() {
  return Object.keys(CONFIG.COLUNAS.admins).map(function (k) {
    return CONFIG.COLUNAS.admins[k];
  });
}

function headersLogMigracao_() {
  return Object.keys(CONFIG.COLUNAS.log).map(function (k) {
    return CONFIG.COLUNAS.log[k];
  });
}

function headersLotes_() {
  return Object.keys(CONFIG.COLUNAS.lotes).map(function (k) {
    return CONFIG.COLUNAS.lotes[k];
  });
}
