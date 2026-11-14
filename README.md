# Inventário Saúde

Sistema de solicitação e gestão de materiais do almoxarifado da Secretaria Municipal de Saúde.

- **Formulário público:** página estática (`Index.html`), publicável no GitHub Pages e embutível no Google Sites.
- **Painel administrativo:** servido pelo Google Apps Script, com login Google e allowlist.
- **Dados:** Google Sheets.
- **Documentos:** termos de retirada e relatórios no Google Drive.

Guia detalhado de instalação e migração: [GUIA_IMPLANTACAO.md](GUIA_IMPLANTACAO.md).

## Estrutura

```text
GUIA_IMPLANTACAO.md         passo a passo de instalação e migração
Index.html                  formulário público (GitHub Pages)
assets/css/app.css          estilos do formulário
assets/js/                  módulos do formulário (API, carrinho, UI)
gas/                        projeto do Apps Script (clasp rootDir)
  appsscript.json
  Config.gs                 áreas, abas, colunas, limites, URLs
  Router.gs                 doGet/doPost públicos e página Admin
  RouterAdmin.gs            funções expostas ao google.script.run
  Auth.gs                   login Google + allowlist
  Planilha.gs               acesso por cabeçalho
  Lock.gs                   LockService
  Validacao.gs              regras puras
  Formatos.gs               datas, protocolos, normalizações
  ServicoEstoque.gs
  ServicoSolicitacoes.gs
  ServicoCadastros.gs
  ServicoDocumentos.gs       termos, pastas do Drive e relatório de críticos
  ServicoRelatorios.gs       relatório geral, por área e saídas mensais
  Migracao.gs               backup, simulação e migração
  Admin.html                painel
  AdminStyles.html
  AdminJsCore.html
  AdminJsAprovacoes.html
  AdminJsEstoque.html
  AdminJsHistorico.html
  AdminJsRelatorios.html
  AdminJsApp.html
tests/                      testes Node das regras puras
scripts/check-syntax.js     checagem de sintaxe
```

## Pré-requisitos

- Conta Google com acesso à planilha e ao Drive.
- Node.js 20 ou superior.
- `clasp` instalado (`npm install -g @google/clasp`) ou uso via `npx @google/clasp`.
- Repositório publicado no GitHub Pages.

## Configuração do clasp

1. Abra o projeto no editor do Apps Script.
2. Em **Configurações do projeto**, copie o **ID do script**.
3. Substitua o valor em `.clasp.json`:

```json
{
  "scriptId": "SEU_SCRIPT_ID_AQUI",
  "rootDir": "gas"
}
```

4. Autentique e envie:

```bash
clasp login
clasp push
```

**Antes do primeiro push:** no editor do Apps Script, apague o arquivo `code.gs` antigo. Ele contém `doGet`/`doPost` e, se permanecer no projeto, conflita com os novos arquivos `Router.gs` e `RouterAdmin.gs`. O `Admin.html` antigo pode ser substituído pelo novo; o `Index.html` do GAS não é mais usado. Em caso de dúvida, faça uma cópia do projeto antes de testar.


O arquivo `.clasprc.json` contém credenciais e está no `.gitignore`.

> `clasp push` envia os arquivos, mas não publica uma nova versão automaticamente. Depois do push, use **Implantar → Gerenciar implantações → Editar → Nova versão** em cada implantação. Mantenha o mesmo ID de implantação para conservar a URL pública. Se a URL mudar, atualize `API_URL` em `assets/js/config.js`.


## Configuração do administrador

Defina o primeiro administrador de uma das duas formas:

- Edite `gas/Config.gs` e preencha `ADMIN_BOOTSTRAP_EMAIL`.
- Ou cadastre a propriedade `ADMIN_BOOTSTRAP_EMAIL` em **Configurações do projeto → Propriedades do script**.

Depois rode a migração. A aba `Admins` terá as colunas `Email`, `Nome`, `Ativo`, `Criado_Em`.
Novos administradores podem ser adicionados diretamente nessa aba, com `Ativo = TRUE`.

## Implantações do Apps Script

O mesmo projeto precisa de duas implantações:

### 1. Pública (API do formulário)

- **Executar como:** eu (proprietário).
- **Quem tem acesso:** qualquer pessoa (anônimo).
- Use a URL `/exec` em `assets/js/config.js` (`API_URL`).

Essa implantação só aceita:
- `GET ?resource=catalogo`
- `GET ?resource=pedido&protocolo=...`
- `POST { action: "CRIAR_SOLICITACAO", ... }`
- `POST { action: "CONSULTAR_PEDIDO", ... }`

Ações administrativas são recusadas nesse canal.

### 2. Administrativa

- **Executar como:** usuário que acessa o app.
- **Quem tem acesso:** qualquer pessoa com Conta Google, ou restrito ao domínio da prefeitura.
- Acesse com `.../exec?page=admin`.
- O painel usa `google.script.run`; toda função valida o e-mail contra a aba `Admins`.

Se o painel for aberto dentro do Google Sites e o login não funcionar, use o botão **Abrir em nova aba**.

Depois de publicar, ajuste em `gas/Config.gs`:

```js
PUBLIC_FORM_URL: "https://SEU-USUARIO.github.io/SEU-REPO/Index.html",
ADMIN_PANEL_URL: "https://script.google.com/macros/s/SEU_DEPLOY_ADMIN/exec?page=admin"
```

`ADMIN_PANEL_URL` é opcional; serve para o botão “Voltar ao painel” após um pedido presencial.

## Migração da planilha

A migração é idempotente, cria backup e não apaga dados.

1. Abra a planilha.
2. Menu **Inventário Saúde → Simular migração**. Nada é alterado; confira o resumo.
3. Menu **Inventário Saúde → Executar migração**.
4. Confira o backup em `Inventario Saúde/Backups`.
5. Revise a aba `Log_Migracao`.

O que a migração faz:

- Cria `Admins` e `Log_Migracao`.
- Adiciona colunas de auditoria em `Solicitacoes_Pendentes` e `Historico_Movimentacoes`.
- Normaliza unidades numéricas/vazias para `Unidade`.
- Converte datas em texto para datas reais.
- Remove validade inválida (`O-43` com `1.0`, por exemplo) e registra no log.
- Renomeia IDs duplicados por área:
  - `E-41` duplicado → segundo item vira `E-41A`.
  - `O-12` duplicado → segundo item vira `O-12A`.
- Cria o administrador inicial, se configurado.

> Rode a migração antes de usar o novo código. Gravações recusam a operação com `MIGRACAO_NECESSARIA` enquanto a estrutura não estiver atualizada.

### Pastas do Drive e administradores

A migração cria as pastas `Termo de Retirada`, `Relatórios` e `Backups`, guarda os IDs nas propriedades do script e compartilha as pastas com os administradores ativos.

- O administrador precisa ter acesso de edição à planilha e às pastas do Drive.
- Depois de adicionar um novo e-mail na aba `Admins`, rode **Inventário Saúde → Configurar pastas do Drive** com a conta proprietária para aplicar o compartilhamento.
- Se aparecer `PASTA_SEM_ACESSO`, compartilhe a pasta com o administrador ou execute o menu novamente como proprietário.
- Se aparecer `PASTAS_NAO_CONFIGURADAS`, rode o menu **Configurar pastas do Drive** antes de aprovar pedidos ou gerar relatórios.


## Formulário público

- Busca global de insumo por nome ou ID, em todas as áreas, com filtragem em tempo real enquanto digita, filtro opcional de área e estoque disponível.
- Itens repetidos são somados no carrinho.
- Quantidade inteira e limitada ao estoque.
- Pedido acima do estoque é bloqueado com alerta explicando o motivo.
- Rascunho em `localStorage` (quando o navegador permite).
- Modal de revisão antes do envio.
- Protocolo copiável e consulta de status.
- Códigos antigos (`PED-1234`) exigem também o nome do solicitante.
- Códigos novos têm alta entropia (`PED-AAAAMMDD-XXXXXX`).

### GitHub Pages

1. Em **Settings → Pages**, selecione a branch e a pasta raiz.
2. Acesse `https://SEU-USUARIO.github.io/SEU-REPO/Index.html`.
3. Atualize `API_URL` em `assets/js/config.js` se a implantação pública mudar.

### Google Sites

1. **Inserir → Incorporar → Por URL**.
2. Use a URL do GitHub Pages com `?embed=1`:
   `https://SEU-USUARIO.github.io/SEU-REPO/Index.html?embed=1`
3. Ajuste a altura do bloco para o formulário completo.

Observações:
- O `localStorage` pode ser bloqueado em iframes de terceiros; o formulário continua funcionando, mas o rascunho pode não persistir.
- O painel Admin pode ser aberto em nova aba a partir do próprio Google Sites.

## Painel administrativo

- **Aprovações:** disponibilidade item a item, aprovação com termo e rejeição com motivo.
- **Estoque:** entrada/baixa, lote e validade opcionais, cadastro de produto, filtros e itens críticos.
- **Histórico:** últimas movimentações com filtros.
- **Solicitar materiais:** o Admin também é solicitante; usa o mesmo formulário público incorporado em modo presencial.
- **Relatórios:** relatório geral do almoxarifado, inventário por área selecionada, saídas mensais por área/produto/setor/solicitante e relatório de críticos.
- **Termo de retirada:** geração ou reemissão do termo de um pedido aprovado direto pelo Admin.
- **Menu da planilha:** configuração do administrador inicial, simulação/migração, geração de termo por protocolo e os mesmos relatórios.

## Segurança e integridade

- Admin com login Google e allowlist; validação em toda função.
- Ações administrativas não passam pelo POST público.
- Aprovação por protocolo, nunca por índice de linha.
- `LockService` em aprovação, rejeição, movimentação e cadastro.
- Validação completa antes de qualquer baixa; sem baixa parcial por erro de negócio.
- Reaprovação bloqueada pelo status.
- XSS neutralizado no frontend e no Admin (texto sempre via `textContent`).
- Erros internos não vazam para o usuário; detalhes vão para o log.
- Planilha real e credenciais do clasp não são versionadas.

## Testes

```bash
npm test
npm run check
```

`npm test` cobre validação de quantidades, datas, unidades, duplicação de itens, estoque, produto e protocolo.
`npm run check` verifica a sintaxe dos `.gs`, dos módulos do formulário, dos scripts do Admin e dos JSONs.

## Rollback

1. Restaure o backup criado pela migração no Google Drive.
2. Reimplante a versão anterior pelo Apps Script (**Gerenciar implantações**).
3. Se necessário, reverta o commit no Git e faça `clasp push`.

## Próximas fases

- **P1:** aprovação parcial, edição/desativação de produtos, cadastro de solicitantes/setores pela UI, exportação CSV e notificações.
- **P2:** controle FEFO por lote em `Estoque_Lotes`, relatórios de vencimento, dashboard e reconciliação de estoque.
