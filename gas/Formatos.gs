/**
 * Funcoes puras de formatacao e normalizacao.
 * Mantidas sem acesso direto a planilha para permitir testes locais.
 */

function texto_(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function limitarTexto_(valor, max) {
  return texto_(valor).slice(0, max);
}

function numero_(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return isFinite(valor) ? valor : 0;
  var s = String(valor).trim();
  if (!s) return 0;
  if (s.indexOf(",") !== -1 && s.indexOf(".") !== -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.indexOf(",") !== -1) {
    s = s.replace(",", ".");
  }
  var n = Number(s);
  return isFinite(n) ? n : 0;
}

function booleano_(valor) {
  if (valor === true || valor === 1) return true;
  var s = texto_(valor).toUpperCase();
  return s === "TRUE" || s === "VERDADEIRO" || s === "SIM" || s === "1" || s === "ATIVO";
}

function normalizarUnidade_(valor) {
  var s = texto_(valor);
  if (!s || /^-?\d+([.,]\d+)?$/.test(s)) return CONFIG.UNIDADE_PADRAO;
  return s;
}

function normalizarData_(valor) {
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? null : valor;
  }
  if (typeof valor === "number") return null;

  var s = texto_(valor);
  if (!s) return null;

  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    return montarData_(Number(m[3]), Number(m[2]), Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return montarData_(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    return montarData_(Number(m[3]), Number(m[2]), Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), 0);
  }

  return null;
}

function montarData_(ano, mes, dia, hora, minuto, segundo) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59 || segundo < 0 || segundo > 59) return null;
  var d = new Date(ano, mes - 1, dia, hora, minuto, segundo);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

function formatarDataHora_(valor) {
  var d = normalizarData_(valor);
  if (!d) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}

function formatarData_(valor) {
  var d = normalizarData_(valor);
  if (!d) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function chaveItem_(area, idInsumo) {
  return texto_(area).toUpperCase() + "::" + texto_(idInsumo).toUpperCase();
}

function normalizarProtocolo_(valor) {
  return texto_(valor).toUpperCase();
}

function protocoloAltaEntropia_(valor) {
  return /^PED-\d{8}-[A-Z0-9]{6,12}$/.test(normalizarProtocolo_(valor));
}

function normalizarNomeComparacao_(valor) {
  return texto_(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function novoProtocolo_() {
  var data = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var uuid = String(Utilities.getUuid() || "").replace(/-/g, "").toUpperCase();
  if (!uuid) uuid = String(Math.floor(Math.random() * 16777215)).toString(16).toUpperCase();
  return "PED-" + data + "-" + uuid.slice(0, 6);
}

function serializarItens_(itens) {
  return JSON.stringify(itens || []);
}

function parseItens_(valor) {
  if (Array.isArray(valor)) return valor;
  try {
    var parsed = JSON.parse(texto_(valor));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function normalizarItemExibicao_(item) {
  return {
    area: texto_(item && item.area),
    idInsumo: texto_(item && item.idInsumo),
    nome: texto_(item && item.nome),
    unidade: normalizarUnidade_(item && item.unidade),
    quantidade: numero_(item && item.quantidade)
  };
}

function normalizarItensExibicao_(itens) {
  return (itens || []).map(normalizarItemExibicao_);
}
