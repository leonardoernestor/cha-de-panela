const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
const SHEET_NAME = 'Presentes comprados';
const SITE_URL = 'https://leonardoernestor.github.io/Chadepanela/';
const MARKETPLACES = {
 mercadoLivre: 'Mercado Livre',
 shopee: 'Shopee'
};

function setup() {
 const spreadsheet = openSpreadsheet_();
 let sheet = spreadsheet.getSheetByName(SHEET_NAME);
 if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
 if (sheet.getLastRow() === 0) {
  sheet.appendRow(['ID do presente', 'Nome do presente', 'Loja', 'Confirmado em']);
  sheet.setFrozenRows(1);
 }
}

function doGet(event) {
 const params = event && event.parameter ? event.parameter : {};
 if (params.action === 'list') return listClaims_(params.callback);
 if (params.action === 'confirm') return confirmationForm_(params);
 return htmlPage_('Lista de presentes', 'Volte para a lista do chá de panela para escolher um presente.');
}

function doPost(event) {
 const params = event && event.parameter ? event.parameter : {};
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

function htmlPage_(title, body, showSiteLink) {
 const siteLink = showSiteLink ? `<p><a href="${SITE_URL}" target="_top">Voltar para a lista de presentes</a></p>` : '';
 const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml_(title)}</title>
  <style>body{font:16px/1.6 Arial,sans-serif;max-width:620px;margin:12vh auto;padding:24px;color:#433b33;background:#faf7f2}h1{font:normal 2rem Georgia,serif;color:#624737}form{padding:24px;background:white;border-radius:18px}label,select{display:block;width:100%;margin:12px 0;padding:10px}button{padding:12px 20px;border:0;border-radius:10px;background:#626b46;color:white;font:inherit;cursor:pointer}a{color:#626b46}</style>
  <h1>${escapeHtml_(title)}</h1>${body}${siteLink}</html>`;
 return HtmlService.createHtmlOutput(html).setTitle(title);
}
