const SPREADSHEET_ID = '1TXTYk0WnoV5vYqmex788L9IZhPSGhcsz9YZG9mTnSDs';
const SHEET_NAME = 'Presentes comprados';
const RSVP_SHEET_NAME = 'Confirmações de presença';
const SITE_URL = 'https://leonardoernestor.github.io/cha-de-panela/';
const MARKETPLACES = {
 mercadoLivre: 'Mercado Livre',
 shopee: 'Shopee'
};

function setup() {
 const spreadsheet = openSpreadsheet_();
 setupSheet_(spreadsheet, SHEET_NAME, ['ID do presente', 'Nome do presente', 'Loja', 'Confirmado em']);
 setupSheet_(spreadsheet, RSVP_SHEET_NAME, ['Nome', 'Número de pessoas', 'Confirmado em']);
}

function doGet(event) {
 const params = event && event.parameter ? event.parameter : {};
 if (params.action === 'list') return listClaims_(params.callback);
 if (params.action === 'confirm') return confirmationForm_(params);
 return htmlPage_('Lista de presentes', 'Volte para a lista do chá de panela para escolher um presente.');
}

function doPost(event) {
 const params = event && event.parameter ? event.parameter : {};
 if (params.action === 'rsvp') return saveRsvp_(params);
 if (params.action !== 'confirm') return htmlPage_('Não foi possível confirmar', 'A solicitação está incompleta.');

 const id = String(params.id || '');
 const name = cleanText_(params.name, 160);
 const marketplace = String(params.marketplace || '');
 if (!/^p\d{2}$/.test(id) || !name || !MARKETPLACES[marketplace]) {
  return htmlPage_('Não foi possível confirmar', 'Os dados do presente são inválidos. Volte à lista e tente novamente.');
 }

 const lock = LockService.getScriptLock();
 if (!lock.tryLock(10000)) {
  return htmlPage_('Tente novamente', 'A lista está sendo atualizada. Aguarde alguns segundos e tente de novo.');
 }
 try {
  const sheet = getClaimsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
   const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
   if (ids.includes(id)) {
    return htmlPage_('Presente já confirmado', 'Este presente já aparece como comprado na lista.', true);
   }
  }
  sheet.appendRow([id, name, MARKETPLACES[marketplace], new Date()]);
  return htmlPage_('Compra confirmada', 'Obrigado! Este presente agora aparece como comprado para todos. Volte à lista do chá de panela.', true);
 } finally {
  lock.releaseLock();
 }
}

function saveRsvp_(params) {
 const name = cleanText_(params.name, 120);
 const guests = Number(params.guests);
 if (!name || !Number.isInteger(guests) || guests < 1 || guests > 10) {
  return htmlPage_('Não foi possível confirmar', 'Confira seu nome e o número de pessoas e tente novamente.', true, params.returnUrl);
 }

 const lock = LockService.getScriptLock();
 if (!lock.tryLock(10000)) {
  return htmlPage_('Tente novamente', 'As confirmações estão sendo atualizadas. Aguarde alguns segundos e tente de novo.', true, params.returnUrl);
 }
 try {
  const sheet = getRsvpSheet_();
  sheet.appendRow([name, guests, new Date()]);
  return htmlPage_(
   'Presença confirmada!',
   `Obrigado, <strong>${escapeHtml_(name)}</strong>! Registramos a presença de ${guests} ${guests === 1 ? 'pessoa' : 'pessoas'}.`,
   true,
   params.returnUrl
  );
 } finally {
  lock.releaseLock();
 }
}

function listClaims_(callback) {
 if (!/^[A-Za-z_$][\w$]*$/.test(String(callback || ''))) {
  return ContentService.createTextOutput('Callback inválido.')
   .setMimeType(ContentService.MimeType.TEXT);
 }
 try {
  const sheet = getClaimsSheet_();
  const lastRow = sheet.getLastRow();
  const claims = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, 4).getValues().map(row => ({
   id: String(row[0]),
   marketplace: row[2] === 'Mercado Livre' ? 'mercadoLivre' : 'shopee'
  }));
  const payload = JSON.stringify({ claims }).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(`${callback}(${payload});`)
   .setMimeType(ContentService.MimeType.JAVASCRIPT);
 } catch (error) {
  const payload = JSON.stringify({ error: error.message });
  return ContentService.createTextOutput(`${callback}(${payload});`)
   .setMimeType(ContentService.MimeType.JAVASCRIPT);
 }
}

function confirmationForm_(params) {
 const id = String(params.id || '');
 const name = cleanText_(params.name, 160);
 if (!/^p\d{2}$/.test(id) || !name) {
  return htmlPage_('Link inválido', 'Volte à lista do chá de panela e escolha um presente novamente.');
 }
 const actionUrl = ScriptApp.getService().getUrl();
 const html = `<form method="post" action="${escapeHtml_(actionUrl)}" target="_top">
  <input type="hidden" name="action" value="confirm">
  <input type="hidden" name="id" value="${escapeHtml_(id)}">
  <input type="hidden" name="name" value="${escapeHtml_(name)}">
  <label>Em qual loja comprou?
   <select name="marketplace" required>
    <option value="mercadoLivre">Mercado Livre</option>
    <option value="shopee">Shopee</option>
   </select>
  </label>
  <p>Confirma que já concluiu a compra de <strong>${escapeHtml_(name)}</strong>?</p>
  <p>A loja não envia a confirmação automaticamente. Só confirme depois de finalizar o pedido.</p>
  <button type="submit">Sim, já comprei</button>
 </form>`;
 return htmlPage_('Confirmar presente comprado', html);
}

function getClaimsSheet_() {
 const sheet = openSpreadsheet_().getSheetByName(SHEET_NAME);
 if (!sheet || sheet.getLastRow() === 0) {
  throw new Error('A planilha não foi inicializada. Execute setup() no editor do Apps Script.');
 }
 return sheet;
}

function getRsvpSheet_() {
 const sheet = openSpreadsheet_().getSheetByName(RSVP_SHEET_NAME);
 if (!sheet || sheet.getLastRow() === 0) {
  throw new Error('A aba de confirmações não foi inicializada. Execute setup() no editor do Apps Script.');
 }
 return sheet;
}

function setupSheet_(spreadsheet, name, headers) {
 let sheet = spreadsheet.getSheetByName(name);
 if (!sheet) sheet = spreadsheet.insertSheet(name);
 if (sheet.getLastRow() === 0) {
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
 }
}

function openSpreadsheet_() {
 if (!SPREADSHEET_ID || SPREADSHEET_ID === 'COLE_AQUI_O_ID_DA_PLANILHA') {
  throw new Error('Configure o ID da sua planilha na constante SPREADSHEET_ID.');
 }
 return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function cleanText_(value, maxLength) {
 return String(value || '').replace(/[<>]/g, '').trim().slice(0, maxLength);
}

function escapeHtml_(value) {
 return String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
 })[character]);
}

function htmlPage_(title, body, showSiteLink, returnUrl) {
 const returnHref = safeReturnUrl_(returnUrl) || (showSiteLink ? SITE_URL : '');
 const siteLink = returnHref ? `<p><a href="${escapeHtml_(returnHref)}" target="_top">Voltar para o site</a></p>` : '';
 const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml_(title)}</title>
  <style>body{font:16px/1.6 Arial,sans-serif;max-width:620px;margin:12vh auto;padding:24px;color:#433b33;background:#faf7f2}h1{font:normal 2rem Georgia,serif;color:#624737}form{padding:24px;background:white;border-radius:18px}label,select{display:block;width:100%;margin:12px 0;padding:10px}button{padding:12px 20px;border:0;border-radius:10px;background:#626b46;color:white;font:inherit;cursor:pointer}a{color:#626b46}</style>
  <h1>${escapeHtml_(title)}</h1>${body}${siteLink}</html>`;
 return HtmlService.createHtmlOutput(html).setTitle(title);
}

function safeReturnUrl_(value) {
 try {
  const url = new URL(String(value || ''));
  const allowedOrigins = [
   new URL(SITE_URL).origin,
   'http://127.0.0.1:5500',
   'http://localhost:5500',
   'http://localhost:3000'
  ];
  return allowedOrigins.includes(url.origin) ? url.href : '';
 } catch {
  return '';
 }
}
