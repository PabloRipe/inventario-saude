import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(mensagem, codigo, detalhes) {
    super(mensagem);
    this.name = "ApiError";
    this.codigo = codigo || "ERRO";
    this.detalhes = Array.isArray(detalhes) ? detalhes : [];
  }
}

async function requisitar(url, opcoes = {}) {
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      cache: "no-store",
      signal: controlador.signal
    });

    let corpo;
    try {
      corpo = await resposta.json();
    } catch (erro) {
      throw new ApiError("O servidor retornou uma resposta inválida. Tente novamente.", "RESPOSTA_INVALIDA");
    }

    if (!corpo || corpo.ok !== true) {
      throw new ApiError(
        (corpo && corpo.message) || "Não foi possível concluir a operação.",
        (corpo && corpo.codigo) || "ERRO",
        corpo && corpo.detalhes
      );
    }

    return corpo.data;
  } catch (erro) {
    if (erro instanceof ApiError) throw erro;
    if (erro && erro.name === "AbortError") {
      throw new ApiError("A conexão demorou demais para responder. Tente novamente.", "TEMPO_ESGOTADO");
    }
    throw new ApiError("Falha de conexão com o servidor. Verifique a internet e tente novamente.", "REDE");
  } finally {
    window.clearTimeout(temporizador);
  }
}

function urlComVersao(parametros) {
  const url = new URL(CONFIG.API_URL);
  Object.keys(parametros).forEach((chave) => {
    url.searchParams.set(chave, parametros[chave]);
  });
  url.searchParams.set("_", String(Date.now()));
  return url.toString();
}

export function carregarCatalogo() {
  return requisitar(urlComVersao({ resource: "catalogo" }));
}

export function consultarPedido(protocolo, solicitante) {
  const parametros = { resource: "pedido", protocolo };
  if (solicitante) parametros.solicitante = solicitante;
  return requisitar(urlComVersao(parametros));
}

export function criarSolicitacao(dados) {
  return requisitar(CONFIG.API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "CRIAR_SOLICITACAO", ...dados })
  });
}
