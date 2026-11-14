# Guia de implantação — Inventário Saúde

Este guia leva o sistema da versão antiga para a nova estrutura modular, com formulário estático no GitHub Pages, Admin no Apps Script e migração segura da planilha.

> **Antes de começar:** faça uma cópia manual da planilha Google (Arquivo → Fazer uma cópia). A migração também cria um backup automático, mas a cópia manual é uma segurança extra.

## O que você vai precisar

- Planilha Google vinculada ao Apps Script com os dados reais.
- Conta Google proprietária da planilha e das pastas do Drive.
- E-mail do primeiro administrador.
- Node.js 20 ou superior instalado.
- Repositório no GitHub com GitHub Pages habilitado.
- Acesso ao editor do Apps Script.

## Etapa 1 — Configurar o clasp

1. No editor do Apps Script, abra **Configurações do projeto** e copie o **ID do script**.
2. No repositório, edite `.clasp.json`:

```json
{
  "scriptId": "COLE_AQUI_O_SCRIPT_ID",
  "rootDir": "gas"
}
```

3. Instale o clasp, se ainda não tiver:

```bash
npm install -g @google/clasp
```

4. Autentique:

```bash
clasp login
```

## Etapa 2 — Configurar o administrador e as URLs

Abra `gas/Config.gs` e preencha:

```js
ADMIN_BOOTSTRAP_EMAIL: "email.do.admin@prefeitura.gov.br",
PUBLIC_FORM_URL: "https://SEU-USUARIO.github.io/SEU-REPO/Index.html",
ADMIN_PANEL_URL: ""
```

- `ADMIN_BOOTSTRAP_EMAIL` cria o primeiro administrador na migração.
- `PUBLIC_FORM_URL` é a URL do formulário no GitHub Pages.
- `ADMIN_PANEL_URL` é opcional. Se ficar vazio, o sistema usa a URL da implantação Admin automaticamente.

Alternativa para o e-mail do admin, sem editar o código: em **Configurações do projeto → Propriedades do script**, crie `ADMIN_BOOTSTRAP_EMAIL` com o e-mail.

## Etapa 3 — Limpar o projeto antigo do Apps Script

No editor do Apps Script:

1. **Apague o arquivo `code.gs` antigo.**
   - Ele contém `doGet`/`doPost` antigos e conflita com `Router.gs`/`RouterAdmin.gs`.
2. O `Admin.html` antigo pode ser substituído pelo novo.
3. O `Index.html` antigo do GAS não é mais usado; pode apagar.
4. Não apague a planilha nem as abas.

## Etapa 4 — Enviar os arquivos novos

Na raiz do repositório:

```bash
clasp push
```

O clasp envia apenas o conteúdo de `gas/`:

- arquivos `.gs` do backend;
- `Admin.html` e os partials `AdminStyles.html`, `AdminJs*.html`;
- `appsscript.json`.

A pasta `assets/`, o `Index.html` da raiz, os testes e o README **não** vão para o Apps Script. Eles ficam no GitHub Pages/repositório.

### Como os arquivos se organizam

O Apps Script não permite subpastas dentro do projeto: tudo fica plano, com arquivos `.gs` e `.html`.

- O CSS do Admin fica dentro de `AdminStyles.html`, em uma tag `<style>`.
- O `Admin.html` inclui esse CSS com `<?!= include_('AdminStyles') ?>`.
- O `include_` usa `HtmlService.createHtmlOutputFromFile('AdminStyles').getContent()` para inlinar o conteúdo no HTML servido.
- Os scripts do Admin ficam nos arquivos `AdminJsCore.html`, `AdminJsAprovacoes.html`, `AdminJsEstoque.html`, `AdminJsHistorico.html` e `AdminJsApp.html`, cada um com seu bloco `<script>`.
- O formulário público é diferente: ele fica no GitHub Pages e usa arquivos realmente externos, como `assets/css/app.css` e `assets/js/app.js`.
- No Google Sites, incorpore a URL do GitHub Pages. Assim o navegador carrega o CSS e os módulos JS normalmente.


## Etapa 5 — Publicar as implantações

No editor do Apps Script, use **Implantar → Gerenciar implantações**.

### 5.1 Implantação pública

Usada pelo formulário estático:

- **Executar como:** eu (proprietário).
- **Quem tem acesso:** qualquer pessoa (anônimo).
- Copie a URL `/exec`.
- Essa URL deve ser o `API_URL` em `assets/js/config.js`.

Exemplo:

```js
API_URL: "https://script.google.com/macros/s/SEU_DEPLOY_PUBLICO/exec"
```

### 5.2 Implantação administrativa

- **Executar como:** usuário que acessa o app.
- **Quem tem acesso:** qualquer pessoa com Conta Google, ou restrito ao domínio da prefeitura.
- Abra a URL com `?page=admin`:

```text
https://script.google.com/macros/s/SEU_DEPLOY_ADMIN/exec?page=admin
```

Se a URL mudar depois de uma nova versão, atualize `ADMIN_PANEL_URL` em `Config.gs` ou deixe vazio para o sistema descobrir.

> `clasp push` não publica uma nova versão automaticamente. Depois do push, edite cada implantação e selecione **Nova versão**.

## Etapa 6 — Migrar a planilha

1. Abra a planilha Google.
2. Recarregue a página para aparecer o menu **Inventário Saúde**.
3. Menu **Inventário Saúde → Simular migração**.
   - Nada é alterado.
   - Confira duplicados, unidades e datas.
4. Menu **Inventário Saúde → Executar migração**.
5. Aguarde. A migração:
   - cria backup em `Inventario Saúde/Backups`;
   - cria `Admins` e `Log_Migracao`;
   - adiciona as colunas novas;
   - normaliza unidades vazias/numéricas para `Unidade`;
   - converte datas em texto;
   - remove validade inválida;
   - renomeia `E-41` duplicado para `E-41A`;
   - renomeia `O-12` duplicado para `O-12A`;
   - cria o administrador inicial;
   - configura e compartilha as pastas do Drive.
6. Abra `Log_Migracao` e confira o que foi alterado.
7. Se necessário, use **Inventário Saúde → Configurar pastas do Drive** novamente depois de adicionar novos admins na aba `Admins`.

### O que acontece com os dados

- Nada é apagado.
- A migração acontece na mesma planilha Google.
- O arquivo `Inventario_Saude.xlsx` do repositório não é a fonte de dados; o sistema usa a planilha Google vinculada.
- O histórico antigo é preservado. Os IDs renomeados não são reescritos no histórico; o nome do produto continua identificando o registro.

## Etapa 7 — Garantir acesso dos administradores

Cada administrador precisa de:

1. E-mail ativo na aba `Admins` (`Ativo = TRUE`).
2. Permissão de edição na planilha Google.
3. Acesso às pastas `Termo de Retirada`, `Relatórios` e `Backups`.

Depois de cadastrar um novo admin, rode **Inventário Saúde → Configurar pastas do Drive** com a conta proprietária.

## Etapa 8 — Publicar o formulário no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Selecione a branch principal e a pasta raiz.
3. Acesse:

```text
https://SEU-USUARIO.github.io/SEU-REPO/Index.html
```

4. Confirme que `PUBLIC_FORM_URL` em `Config.gs` aponta para essa URL.
5. Confirme que `API_URL` em `assets/js/config.js` aponta para a implantação pública.

### Busca global

O formulário novo permite:

- buscar insumo por nome ou código em todas as áreas;
- ver os resultados sendo filtrados em tempo real enquanto digita;
- usar o filtro de área apenas se quiser restringir;
- adicionar itens de áreas diferentes no mesmo pedido;
- ver a área no resultado, no item selecionado e no carrinho.

## Etapa 9 — Incorporar no Google Sites

1. No Google Sites, use **Inserir → Incorporar → Por URL**.
2. Informe:

```text
https://SEU-USUARIO.github.io/SEU-REPO/Index.html?embed=1
```

3. Ajuste a altura do bloco para exibir o formulário completo.
4. O painel Admin pode ser aberto em nova aba a partir do Google Sites. Se for incorporado, use a URL `...?page=admin`.

> Não cole o HTML bruto no Google Sites. Os caminhos `./assets/...` só funcionam quando a página é carregada pela URL do GitHub Pages.

## Etapa 10 — Testes de aceite

### Formulário público

- [ ] Buscar um produto sem selecionar área.
- [ ] Buscar um produto de outra área e adicionar ao pedido.
- [ ] Adicionar itens de duas áreas diferentes no mesmo carrinho.
- [ ] Filtrar por área e confirmar que a busca fica restrita.
- [ ] Tentar quantidade acima do estoque e conferir o alerta explicativo.
- [ ] Tentar quantidade fracionada e confirmar que é recusada.
- [ ] Recarregar a página e conferir o rascunho.
- [ ] Enviar um pedido e copiar o protocolo.
- [ ] Consultar o pedido pelo protocolo.

### Admin

- [ ] Abrir `...?page=admin` e entrar com uma conta da allowlist.
- [ ] Aprovar um pedido e conferir a baixa no estoque.
- [ ] Abrir o termo gerado no Drive.
- [ ] Rejeitar um pedido com motivo e consultar o motivo no formulário público.
- [ ] Registrar uma entrada e uma baixa manual.
- [ ] Cadastrar um produto.
- [ ] Conferir o histórico e o usuário que executou a ação.
- [ ] Usar a aba **Solicitar materiais** para criar um pedido como administrador e confirmar que ele aparece na fila.
- [ ] Gerar o **relatório geral do almoxarifado**.
- [ ] Selecionar uma área e gerar o **inventário por área**.
- [ ] Selecionar um mês e gerar o **relatório de saídas mensais**.
- [ ] Gerar o **relatório de críticos**.
- [ ] Informar o protocolo de um pedido aprovado e gerar/reemitir o **termo de retirada**.

### Técnico

```bash
npm run check
npm test
```

## Relatórios disponíveis no Admin

A aba **Relatórios** concentra os documentos gerenciais:

- **Relatório geral do almoxarifado:** resumo por área, totais, itens zerados, lista de críticos e inventário completo de todas as áreas.
- **Inventário por área:** escolha uma área específica; o documento traz todos os insumos, estoque atual, mínimo e status.
- **Saídas mensais:** escolha o mês; o documento traz resumo por área, por setor, por produto e o detalhamento com data, produto, setor, solicitante e pedido.
- **Insumos críticos:** itens no ou abaixo do estoque mínimo.
- **Termo de retirada:** informe o protocolo de um pedido aprovado para gerar ou reemitir o documento no Drive.

Os arquivos são salvos em `Inventario Saúde/Relatórios`, exceto os termos, que vão para `Inventario Saúde/Termo de Retirada`.

## Problemas comuns

| Mensagem / sintoma | Causa provável | Solução |
|---|---|---|
| `MIGRACAO_NECESSARIA` | Colunas novas ainda não existem | Rode **Inventário Saúde → Executar migração** |
| `DADOS_DUPLICADOS` | Ainda há IDs repetidos na área | Rode a migração e confira o `Log_Migracao` |
| `PASTAS_NAO_CONFIGURADAS` | IDs das pastas não foram gravados | Rode **Configurar pastas do Drive** |
| `PASTA_SEM_ACESSO` | Admin sem acesso à pasta | Compartilhe a pasta ou rode o menu como proprietário |
| `NAO_AUTORIZADO` | E-mail fora da aba `Admins` ou login ausente | Ative o e-mail e abra o painel em nova aba |
| Admin não carrega | Implantação configurada como “executar como proprietário” | Use “executar como usuário que acessa” |
| Formulário sem dados | `API_URL` errada ou implantação pública sem nova versão | Atualize `config.js` e publique nova versão |
| CSS não aparece no Google Sites | HTML colado em vez de URL/iframe | Incorpore pela URL do GitHub Pages |
| Termo não gerado | Pasta do Drive sem acesso ou cota | Gere pelo menu **Gerar termo de um pedido** |

## Rollback

1. Restaure o backup criado em `Inventario Saúde/Backups`.
2. No Apps Script, use **Gerenciar implantações** e volte para a versão anterior.
3. No Git, reverta o commit e rode `clasp push` novamente.
4. Se necessário, restaure a cópia manual da planilha.

## Checklist final

- [ ] `.clasp.json` com Script ID correto.
- [ ] `ADMIN_BOOTSTRAP_EMAIL` configurado.
- [ ] `code.gs` antigo removido do Apps Script.
- [ ] `clasp push` executado.
- [ ] Implantação pública publicada com nova versão.
- [ ] Implantação Admin publicada com “executar como usuário que acessa”.
- [ ] `API_URL` em `assets/js/config.js` correta.
- [ ] `PUBLIC_FORM_URL` em `Config.gs` correta.
- [ ] Migração simulada e executada.
- [ ] Backup conferido.
- [ ] `Admins` e pastas do Drive configurados.
- [ ] GitHub Pages publicado.
- [ ] Google Sites incorporado por URL.
- [ ] Testes de aceite concluídos.
- [ ] `npm run check` e `npm test` passando.
