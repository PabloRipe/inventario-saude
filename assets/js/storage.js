import { CONFIG } from "./config.js";

function lerJson(chave) {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch (erro) {
    return null;
  }
}

function gravarJson(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    return false;
  }
}

function remover(chave) {
  try {
    window.localStorage.removeItem(chave);
  } catch (erro) {
    // localStorage pode estar bloqueado em iframes de terceiros (Google Sites).
  }
}

export function carregarRascunho() {
  const dados = lerJson(CONFIG.STORAGE_KEY);
  if (!dados || typeof dados !== "object") return null;
  return dados;
}

export function salvarRascunho(dados) {
  return gravarJson(CONFIG.STORAGE_KEY, dados);
}

export function limparRascunho() {
  remover(CONFIG.STORAGE_KEY);
}

export function carregarPreferencias() {
  const dados = lerJson(CONFIG.PREFERENCES_KEY);
  return dados && typeof dados === "object" ? dados : {};
}

export function salvarPreferencias(dados) {
  return gravarJson(CONFIG.PREFERENCES_KEY, dados);
}
