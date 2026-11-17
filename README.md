# Chá de panela — Gislaine & Leonardo

Site estático para publicar no GitHub Pages. A lista tem busca, categorias, imagens ilustrativas e botões que levam às buscas de presentes no Mercado Livre e na Shopee. A compra acontece diretamente na loja.

## Publicar no GitHub Pages

O workflow de GitHub Pages publica os arquivos estáticos a partir da raiz do repositório. O arquivo principal é `index.html`; ele carrega `app.js`, `style.css` e `products.json`.

## Ativar a confirmação compartilhada sem pagar hospedagem

O GitHub Pages não salva alterações feitas por visitantes. A confirmação compartilhada usa uma planilha Google e um Apps Script gratuito como armazenamento. O visitante confirma manualmente depois de concluir a compra; a loja não envia essa confirmação ao site.

1. Na conta Google que será responsável pela lista, crie uma planilha.
2. Copie o ID da planilha, que fica entre `/d/` e `/edit` no endereço da planilha.
3. Na planilha, abra **Extensões → Apps Script** e cole o conteúdo de `apps-script/Code.gs`.
4. No script, confira se `SPREADSHEET_ID` contém o ID copiado da planilha e salve.
5. Selecione a função `setup` no editor e clique em **Executar**. Autorize o acesso à planilha quando o Google solicitar.
6. Clique em **Implantar → Nova implantação → App da Web**. Configure **Executar como: você** e o acesso para **qualquer pessoa**. Implante e copie o endereço terminado em `/exec`.
7. Em `app.js`, confira se `APPS_SCRIPT_URL` contém o endereço `/exec` da implantação ativa do Apps Script.
8. Envie as alterações do site ao GitHub para o Pages publicar a versão atualizada.

Depois disso, os convidados podem abrir a loja, concluir a compra e usar **Já comprei este presente** para confirmar. O site mostra o item como comprado para todos e atualiza a lista aberta periodicamente. Para corrigir uma confirmação, remova a linha correspondente na aba **Presentes comprados**.

As confirmações são declarações dos convidados: o Mercado Livre e a Shopee não informam ao site se houve pagamento. O Apps Script precisa ficar acessível a qualquer pessoa para os convidados confirmarem; não coloque senhas, tokens privados ou dados sensíveis no código público.

## Local da festa e confirmação de presença

A página inicial inclui um mapa incorporado e fixo do Residencial Maravilhas, na Rua Rio de Janeiro, 777, em São José da Lapa - MG. O mapa mostra o local da festa sem calcular rotas no site. O botão **Confirmar presença** envia o nome e a quantidade de pessoas para a aba **Confirmações de presença** da mesma planilha.

Para ativar a confirmação, copie a versão atualizada de `apps-script/Code.gs` para o projeto Apps Script vinculado à planilha, salve e execute `setup()` para criar a aba. Em seguida, atualize a implantação do app da Web em **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**. O endereço `/exec` configurado em `app.js` deve ser o da implantação atualizada. Sem atualizar essa implantação, a página pode abrir, mas a presença não será gravada.

Ao testar pelo Live Server no endereço padrão `http://127.0.0.1:5500`, a confirmação retorna ao site local. No site publicado, retorna ao endereço do GitHub Pages. Se usar outra porta local, ajuste a lista `allowedOrigins` na função `safeReturnUrl_` em `apps-script/Code.gs` antes de atualizar a implantação.

## Produtos, links e imagens

Sem links individuais, os botões pesquisam o nome do presente na loja. Para usar um anúncio específico, acrescente propriedades `links` ao produto em `products.json`:

```json
{
  "id": "p01",
  "name": "Conjunto de utensílios",
  "category": "Utensílios de cozinha",
  "image": "/images/categoria-1.svg",
  "links": {
    "mercadoLivre": "https://www.mercadolivre.com.br/...",
    "shopee": "https://shopee.com.br/..."
  }
}
```

As imagens disponíveis no projeto são ilustrações genéricas por categoria, não fotografias dos anúncios. Para exibir fotos reais, adicione imagens próprias ou autorizadas em `public/images` e atualize o campo `image` do produto. Não dependa de imagens de anúncios que podem expirar ou cujo uso não esteja autorizado.
