export function qs(seletor, raiz = document) {
  return raiz.querySelector(seletor);
}

export function qsa(seletor, raiz = document) {
  return Array.from(raiz.querySelectorAll(seletor));
}

export function limpar(elemento) {
  while (elemento && elemento.firstChild) {
    elemento.removeChild(elemento.firstChild);
  }
}

export function criar(tag, opcoes = {}, filhos = []) {
  const elemento = document.createElement(tag);
  if (opcoes.className) elemento.className = opcoes.className;
  if (opcoes.texto !== undefined) elemento.textContent = String(opcoes.texto);
  if (opcoes.html) elemento.innerHTML = opcoes.html;
  if (opcoes.atributos) {
    Object.keys(opcoes.atributos).forEach((nome) => {
      const valor = opcoes.atributos[nome];
      if (valor !== null && valor !== undefined && valor !== false) {
        elemento.setAttribute(nome, String(valor));
      }
    });
  }
  if (opcoes.dataset) {
    Object.keys(opcoes.dataset).forEach((nome) => {
      elemento.dataset[nome] = opcoes.dataset[nome];
    });
  }
  if (opcoes.eventos) {
    Object.keys(opcoes.eventos).forEach((evento) => {
      elemento.addEventListener(evento, opcoes.eventos[evento]);
    });
  }
  filhos.filter(Boolean).forEach((filho) => elemento.appendChild(filho));
  return elemento;
}

export function mostrarToast(mensagem, tipo = "info") {
  const regiao = qs("#toastRegion");
  if (!regiao) return;
  const toast = criar("div", {
    className: `toast toast-${tipo}`,
    texto: mensagem,
    atributos: { role: "status" }
  });
  regiao.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .2s ease";
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);
}

export function abrirModal(dialogo) {
  if (!dialogo) return;
  if (typeof dialogo.showModal === "function" && !dialogo.open) {
    try {
      dialogo.showModal();
      return;
    } catch (erro) {
      // Ambientes com restrição de modal (ex.: iframe) usam o fallback aberto.
    }
  }
  dialogo.setAttribute("open", "open");
}

export function fecharModal(dialogo) {
  if (!dialogo) return;
  if (typeof dialogo.close === "function" && dialogo.open) {
    dialogo.close();
  } else {
    dialogo.removeAttribute("open");
  }
}

export function mostrarAlerta(titulo, mensagem, detalhes = []) {
  const dialogo = qs("#modalAlerta");
  const tituloEl = qs("#alertaTitulo");
  const corpo = qs("#alertaMensagem");
  if (!dialogo || !corpo) return;

  if (tituloEl) tituloEl.textContent = titulo || "Atenção";
  limpar(corpo);
  corpo.appendChild(criar("p", { texto: mensagem || "" }));

  const lista = (Array.isArray(detalhes) ? detalhes : detalhes ? [String(detalhes)] : [])
    .map((detalhe) => {
      if (typeof detalhe === "string") return detalhe;
      if (detalhe && detalhe.mensagem) return detalhe.mensagem;
      return "";
    })
    .filter(Boolean);

  if (lista.length) {
    const ul = criar("ul");
    lista.forEach((texto) => ul.appendChild(criar("li", { texto })));
    corpo.appendChild(ul);
  }

  abrirModal(dialogo);
}

export function criarBadgeStatus(status) {
  const normalizado = String(status || "").toUpperCase();
  const mapa = {
    PENDENTE: { rotulo: "Pendente", classe: "badge-pending" },
    APROVADO: { rotulo: "Aprovado", classe: "badge-ok" },
    REJEITADO: { rotulo: "Rejeitado", classe: "badge-danger" },
    CANCELADO: { rotulo: "Cancelado", classe: "badge-neutral" },
    NAO_ENCONTRADO: { rotulo: "Não encontrado", classe: "badge-neutral" }
  };
  const info = mapa[normalizado] || { rotulo: normalizado || "Desconhecido", classe: "badge-neutral" };
  return criar("span", { className: `badge ${info.classe}`, texto: info.rotulo });
}

export function formatarNumero(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "0";
  return numero.toLocaleString("pt-BR");
}

export async function copiarTexto(texto) {
  const valor = String(texto || "");
  if (!valor) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch (erro) {
    // fallback abaixo
  }
  try {
    const area = document.createElement("textarea");
    area.value = valor;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch (erro) {
    return false;
  }
}

export function bloquearBotao(botao, texto) {
  if (!botao) return;
  botao.dataset.textoOriginal = botao.textContent;
  botao.disabled = true;
  if (texto) botao.textContent = texto;
}

export function restaurarBotao(botao) {
  if (!botao) return;
  botao.disabled = false;
  if (botao.dataset.textoOriginal) {
    botao.textContent = botao.dataset.textoOriginal;
    delete botao.dataset.textoOriginal;
  }
}

export function rolarPara(elemento) {
  if (elemento && typeof elemento.scrollIntoView === "function") {
    elemento.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
