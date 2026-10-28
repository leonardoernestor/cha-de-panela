const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuOXooHZAtRpUFZphBTxTa-RDL2Wh1wepj1fcVQx_TBeMu9hK9b-lSZDOCLuP9sK0/exec';
const PRODUCTS_URL = 'products.json';
const REFRESH_INTERVAL = 30000;
const MARKETPLACES = {
 mercadoLivre: {
  label: 'Ver no Mercado Livre',
  domains: ['mercadolivre.com.br', 'meli.la'],
  search: () => 'https://meli.la/12x2Meo'
 },
 shopee: {
  label: 'Ver na Shopee',
  domains: ['shopee.com.br'],
  search: product => `https://shopee.com.br/search?keyword=${encodeURIComponent(product.name)}`
 }
};

const $ = id => document.getElementById(id);
let products = [];
let claims = new Map();
let selectedMarkets = new Map();
let claimsLoaded = false;
let claimsError = false;
let refreshTimer;

try {
 selectedMarkets = new Map(Object.entries(JSON.parse(localStorage.getItem('selected-gift-markets') || '{}')));
} catch {
 selectedMarkets = new Map();
}

function normalize(value) {
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function safeMarketplaceUrl(product, marketplace) {
 const config = MARKETPLACES[marketplace];
 const customUrl = product.links?.[marketplace];
 if (!customUrl) return config.search(product);
 try {
  const parsed = new URL(customUrl);
  const allowedDomain = config.domains.some(domain =>
   parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
  );
  return parsed.protocol === 'https:' && allowedDomain ? parsed.href : null;
 } catch {
  return null;
 }
}

function imageUrl(product) {
 if (/^https:\/\//i.test(product.image || '')) return product.image;
 return `public/${String(product.image || '').replace(/^\/+/, '')}`;
}

function createStoreLink(product, marketplace) {
 const url = safeMarketplaceUrl(product, marketplace);
 if (!url) return null;
 const link = document.createElement('a');
 link.className = selectedMarkets.get(product.id) === marketplace ? 'loja loja-selecionada' : 'loja';
 if (link.classList.contains('loja-selecionada')) link.setAttribute('aria-current', 'true');
 link.href = url;
 link.target = '_blank';
 link.rel = 'noopener noreferrer';
 link.textContent = MARKETPLACES[marketplace].label;
 link.setAttribute('aria-label', `${link.textContent}: ${product.name}, abre em nova aba`);
 link.addEventListener('click', () => {
  selectedMarkets.set(product.id, marketplace);
  try {
   localStorage.setItem('selected-gift-markets', JSON.stringify(Object.fromEntries(selectedMarkets)));
  } catch {
   $('status').textContent = 'A loja foi aberta, mas não foi possível guardar a seleção para a próxima visita.';
  }
  const card = link.closest('.presente');
  card.querySelectorAll('.loja').forEach(storeLink => {
   const selected = storeLink === link;
   storeLink.classList.toggle('loja-selecionada', selected);
   if (selected) storeLink.setAttribute('aria-current', 'true');
   else storeLink.removeAttribute('aria-current');
  });
 });
 return link;
}

function createConfirmationLink(product) {
 const link = document.createElement('a');
 link.className = 'loja confirmar-compra';
 link.href = `${APPS_SCRIPT_URL}?action=confirm&id=${encodeURIComponent(product.id)}&name=${encodeURIComponent(product.name)}`;
 link.target = '_blank';
 link.rel = 'noopener noreferrer';
 link.textContent = 'Já comprei este presente';
 link.setAttribute('aria-label', `Confirmar que comprou ${product.name}`);
 return link;
}

function createCard(product) {
 const card = document.createElement('article');
 card.className = 'presente';

 const image = document.createElement('img');
 image.className = 'foto-presente';
 image.src = imageUrl(product);
 image.alt = `Imagem ilustrativa: ${product.name}`;
 image.loading = 'lazy';
 image.onerror = () => {
  image.onerror = null;
  image.src = 'public/images/categoria-1.svg';
 };

 const content = document.createElement('div');
 content.className = 'presente-conteudo';
 const category = document.createElement('div');
 category.className = 'categoria';
 category.textContent = product.category;
 const title = document.createElement('h3');
 title.textContent = product.name;
 const description = document.createElement('p');
 description.className = 'descricao';
 const stores = document.createElement('div');
 stores.className = 'lojas';
 const claim = claims.get(product.id);

 if (claim) {
  description.textContent = `Presente confirmado como comprado${claim.marketplace ? ` no ${claim.marketplace === 'mercadoLivre' ? 'Mercado Livre' : 'Shopee'}` : ''}.`;
  const purchased = document.createElement('span');
  purchased.className = 'presente-indisponivel';
  purchased.textContent = 'Já comprado';
  stores.append(purchased);
 } else {
  description.textContent = 'Um carinho para completar nosso novo lar.';
  const mercadoLivre = createStoreLink(product, 'mercadoLivre');
  const shopee = createStoreLink(product, 'shopee');
  if (mercadoLivre) stores.append(mercadoLivre);
  if (shopee) stores.append(shopee);
  if (APPS_SCRIPT_URL) {
   stores.append(createConfirmationLink(product));
  }
 }

 content.append(category, title, description, stores);
 card.append(image, content);
 return card;
}

function render() {
 const term = normalize($('busca').value);
 const category = $('filtroCategoria').value;
 const matching = products.filter(product =>
  (!category || product.category === category) &&
  normalize(`${product.name} ${product.category}`).includes(term)
 );
 const purchased = matching.filter(product => claims.has(product.id)).length;
 $('contador').textContent = claimsLoaded
  ? `${matching.length - purchased} disponíveis · ${purchased} já comprados · ${matching.length} presentes`
  : claimsError
   ? `${matching.length} presentes · status de compra indisponível`
   : APPS_SCRIPT_URL
    ? `Verificando ${matching.length} presentes…`
    : `${matching.length} presentes`;

 const list = $('listaPresentes');
 list.replaceChildren();
 if (!matching.length) {
  const empty = document.createElement('p');
  empty.className = 'vazio';
  empty.textContent = 'Nenhum presente encontrado. Tente outro nome ou categoria.';
  list.append(empty);
  return;
 }
 const fragment = document.createDocumentFragment();
 matching.forEach(product => fragment.append(createCard(product)));
 list.append(fragment);
}

function refreshClaims() {
 return new Promise((resolve, reject) => {
  const callbackName = `giftClaims_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script = document.createElement('script');
  const timeout = setTimeout(() => finish(new Error('A confirmação compartilhada demorou para responder.')), 12000);
  function finish(error, response) {
   clearTimeout(timeout);
   delete window[callbackName];
   script.remove();
   if (error) {
    reject(error);
    return;
   }
   if (response.error) {
    reject(new Error('A planilha retornou uma lista de confirmações inválida.'));
    return;
   }
   if (!Array.isArray(response.claims)) {
    reject(new Error('A planilha retornou uma lista de confirmações inválida.'));
    return;
   }
   claims = new Map(response.claims.map(claim => [claim.id, claim]));
   claimsLoaded = true;
   claimsError = false;
   render();
   resolve();
  }
  window[callbackName] = response => finish(null, response);
  script.onerror = () => finish(new Error('Não foi possível carregar as confirmações da planilha.'));
  script.src = `${APPS_SCRIPT_URL}?action=list&callback=${callbackName}&t=${Date.now()}`;
  document.head.append(script);
 });
}

function setNotice(message, isError = false) {
 $('aviso').textContent = message;
 $('aviso').classList.toggle('aviso-erro', isError);
}

async function initialize() {
 try {
  const response = await fetch(PRODUCTS_URL);
  if (!response.ok) throw new Error(`Não foi possível carregar a lista (HTTP ${response.status}).`);
  products = await response.json();
  if (!Array.isArray(products) || !products.length) throw new Error('A lista de presentes está vazia ou inválida.');
  new Set(products.map(product => product.category)).forEach(category => {
   const option = document.createElement('option');
   option.value = category;
   option.textContent = category;
   $('filtroCategoria').append(option);
  });
  render();
 } catch (error) {
  setNotice(error.message, true);
  $('listaPresentes').textContent = 'Não foi possível exibir os presentes.';
  return;
 }

 if (!APPS_SCRIPT_URL) {
  setNotice('Os links de compra já estão disponíveis. A confirmação compartilhada será ativada quando você publicar o Apps Script e inserir o endereço dele neste site.');
  return;
 }

 try {
  await refreshClaims();
  setNotice('Depois de concluir a compra na loja, use “Já comprei este presente” para atualizar a lista para todos.');
  refreshTimer = setInterval(() => {
   refreshClaims().catch(error => {
    claimsError = true;
    render();
    setNotice(error.message, true);
   });
  }, REFRESH_INTERVAL);
  document.addEventListener('visibilitychange', () => {
   if (!document.hidden) refreshClaims().catch(error => {
    claimsError = true;
    render();
    setNotice(error.message, true);
   });
  });
 } catch (error) {
  claimsError = true;
  render();
  setNotice(error.message, true);
 }
}

$('busca').addEventListener('input', render);
$('filtroCategoria').addEventListener('change', render);
window.addEventListener('focus', () => {
 if (APPS_SCRIPT_URL) refreshClaims().catch(error => {
  claimsError = true;
  render();
  setNotice(error.message, true);
 });
});
window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
initialize();
