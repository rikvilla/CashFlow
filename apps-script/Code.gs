/**
 * CashFlow – web app mobile per inserire, consultare e modificare i movimenti
 * del foglio "DB" e visualizzare il foglio "Charts".
 * Script legato al foglio (Estensioni → Apps Script). Vedi README per il deploy.
 */

const CF = {
  DB_SHEET: 'DB',
  CHARTS_SHEET: 'Charts',
  CAT_SHEET: 'readme',
  // Prima riga dei movimenti reali: le righe 2–241 sono le voci segnaposto
  // (12 per categoria). Deve restare coerente con la formula ID in DB!A2.
  FIRST_ROW: 242,
  DATE_FORMAT: 'dd"/"mm"/"yy',
  // Ordine dei grafici nella scheda Charts, per titolo (basta una parte del titolo).
  // I grafici non elencati vengono dopo, nell'ordine in cui sono sul foglio.
  CHART_ORDER: ['Entrate-Uscite-Netto', 'Uscite per categoria'],
  MAX_DESC: 200
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CashFlow')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // Necessario perché l'app installabile (cartella pwa/) la carica in un iframe.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- Accesso ---------- */

/**
 * Da eseguire UNA volta dall'editor (menu funzioni → setupAccessCode → Esegui):
 * genera il codice di accesso e lo mostra nel log di esecuzione.
 * Rieseguirla genera un codice nuovo e invalida quello vecchio.
 */
function setupAccessCode() {
  const raw = Utilities.getUuid().replace(/-/g, '').slice(0, 20); // 80 bit casuali
  PropertiesService.getScriptProperties().setProperty('ACCESS_CODE', raw);
  Logger.log('Codice di accesso: ' + raw.match(/.{4}/g).join('-'));
}

/**
 * La web app è pubblicata con accesso "Chiunque" (il login Google non funziona
 * dentro l'app installata), quindi ogni chiamata deve presentare il codice segreto.
 * Il codice sta nelle proprietà dello script, mai nel codice sorgente.
 */
function checkAccess_(code) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_CODE');
  if (!expected) throw new Error('Codice di accesso non configurato: esegui setupAccessCode dall\'editor.');
  const given = String(code || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (given !== expected) {
    Utilities.sleep(1500); // rallenta eventuali tentativi a raffica
    throw new Error('ACCESSO_NEGATO');
  }
}

/* ---------- API chiamate dal client (google.script.run) ---------- */

function apiInit(code) {
  checkAccess_(code);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    groups: readCategoryGroups_(ss),
    today: Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
    sheetUrl: ss.getUrl(),
    title: ss.getName()
  };
}

function apiList(code) {
  checkAccess_(code);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, CF.DB_SHEET);
  const tz = ss.getSpreadsheetTimeZone();
  const values = readDataBlock_(sheet);
  const rows = [];
  values.forEach(function (r, i) {
    if (isEmptyRow_(r)) return;
    rows.push({
      row: CF.FIRST_ROW + i,
      id: r[0] === '' ? null : r[0],
      desc: String(r[1]),
      cat: String(r[2]),
      // Importo non numerico (es. testo "2.5") viene passato com'è, così l'app lo evidenzia.
      amount: typeof r[3] === 'number' ? r[3] : null,
      amountRaw: String(r[3]),
      date: toIso_(r[4], tz),
      imp: String(r[5]).trim().toUpperCase() === 'SI',
      sig: signature_(r, tz)
    });
  });
  return rows;
}

function apiAdd(code, input) {
  checkAccess_(code);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = validate_(input, ss);
  return withLock_(function () {
    const sheet = getSheet_(ss, CF.DB_SHEET);
    const values = readDataBlock_(sheet);
    // Non si può usare appendRow: la colonna A contiene la formula ID fino in fondo,
    // quindi "l'ultima riga" per Sheets è la fine del foglio, fuori dalle pivot.
    let offset = -1;
    for (let i = 0; i < values.length; i++) {
      if (isEmptyRow_(values[i])) { offset = i; break; }
    }
    if (offset < 0) throw new Error('Il foglio DB è pieno: aggiungi righe in fondo al foglio.');
    const row = CF.FIRST_ROW + offset;

    sheet.getRange(row, 2, 1, 5).setValues([[
      safeText_(data.desc), data.cat, data.amount, data.dateObj, data.imp ? 'SI' : ''
    ]]);
    sheet.getRange(row, 5).setNumberFormat(CF.DATE_FORMAT);
    SpreadsheetApp.flush();

    const limit = pivotLastRow_(ss);
    return {
      row: row,
      warning: limit && row > limit
        ? 'Riga ' + row + ' oltre l\'intervallo delle pivot (fino a riga ' + limit +
          '): il movimento è salvato ma non compare in Charts. Estendi l\'intervallo delle pivot.'
        : ''
    };
  });
}

function apiUpdate(code, row, sig, input) {
  checkAccess_(code);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = validate_(input, ss);
  return withLock_(function () {
    const sheet = getSheet_(ss, CF.DB_SHEET);
    const tz = ss.getSpreadsheetTimeZone();
    const cur = currentRow_(sheet, row, sig, tz);

    // Scrivo solo i campi cambiati: così restano intatti eventuali formule
    // nell'importo (es. "=80+55") e l'orario nelle date già presenti.
    if (String(cur[1]) !== data.desc) sheet.getRange(row, 2).setValue(safeText_(data.desc));
    if (String(cur[2]) !== data.cat) sheet.getRange(row, 3).setValue(data.cat);
    if (!(typeof cur[3] === 'number' && Math.abs(cur[3] - data.amount) < 0.005)) {
      sheet.getRange(row, 4).setValue(data.amount);
    }
    if (toIso_(cur[4], tz) !== data.date) {
      sheet.getRange(row, 5).setValue(data.dateObj).setNumberFormat(CF.DATE_FORMAT);
    }
    const wasImp = String(cur[5]).trim().toUpperCase() === 'SI';
    if (wasImp !== data.imp) sheet.getRange(row, 6).setValue(data.imp ? 'SI' : '');
    SpreadsheetApp.flush();
    return { row: row };
  });
}

function apiDelete(code, row, sig) {
  checkAccess_(code);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return withLock_(function () {
    const sheet = getSheet_(ss, CF.DB_SHEET);
    currentRow_(sheet, row, sig, ss.getSpreadsheetTimeZone());
    sheet.deleteRow(row);
    SpreadsheetApp.flush();
    return { row: row };
  });
}

function apiCharts(code) {
  checkAccess_(code);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, CF.CHARTS_SHEET);
  SpreadsheetApp.flush();

  const range = sheet.getDataRange();
  let values = range.getDisplayValues();
  let lastRow = 0, lastCol = 0;
  values.forEach(function (r, i) {
    r.forEach(function (v, j) {
      if (v !== '') { lastRow = Math.max(lastRow, i + 1); lastCol = Math.max(lastCol, j + 1); }
    });
  });
  const table = { values: [], backgrounds: [], bold: [] };
  if (lastRow > 0) {
    const used = sheet.getRange(1, 1, lastRow, lastCol);
    table.values = used.getDisplayValues();
    table.backgrounds = used.getBackgrounds();
    table.bold = used.getFontWeights().map(function (r) {
      return r.map(function (w) { return w === 'bold'; });
    });
  }

  const charts = sheet.getCharts()
    .map(function (chart) { return { chart: chart, rank: chartRank_(chart), info: chart.getContainerInfo() }; })
    .sort(function (a, b) {
      return a.rank - b.rank ||
        a.info.getAnchorRow() - b.info.getAnchorRow() ||
        a.info.getAnchorColumn() - b.info.getAnchorColumn();
    })
    .map(function (item) { return item.chart; })
    .map(function (chart) {
      try {
        const blob = chart.getAs('image/png');
        return 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());
      } catch (e) {
        return null; // un grafico non esportabile non deve bloccare il resto della scheda
      }
    });

  return { table: table, charts: charts };
}

/* ---------- Funzioni interne ---------- */

function getSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Foglio "' + name + '" non trovato.');
  return sheet;
}

/** Colonne A:F dalla prima riga dei movimenti fino alla fine del foglio. */
function readDataBlock_(sheet) {
  const n = sheet.getMaxRows() - CF.FIRST_ROW + 1;
  if (n <= 0) return [];
  return sheet.getRange(CF.FIRST_ROW, 1, n, 6).getValues();
}

/** Vuota = nessun dato in B:F (la colonna A contiene sempre la formula ID). */
function isEmptyRow_(r) {
  for (let c = 1; c <= 5; c++) if (r[c] !== '' && r[c] !== null) return false;
  return true;
}

function toIso_(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  return '';
}

/** Impronta del contenuto della riga: serve a non modificare/eliminare la riga sbagliata
 *  se nel frattempo il foglio è cambiato (es. riga eliminata da PC). */
function signature_(r, tz) {
  const date = r[4] instanceof Date ? Utilities.formatDate(r[4], tz, "yyyy-MM-dd'T'HH:mm:ss") : String(r[4]);
  return JSON.stringify([String(r[1]), String(r[2]), String(r[3]), date, String(r[5])]);
}

function currentRow_(sheet, row, sig, tz) {
  row = Number(row);
  if (!Number.isInteger(row) || row < CF.FIRST_ROW || row > sheet.getMaxRows()) {
    throw new Error('Riga non valida.');
  }
  const cur = sheet.getRange(row, 1, 1, 6).getValues()[0];
  if (signature_(cur, tz) !== sig) {
    throw new Error('Il foglio è cambiato nel frattempo: aggiorna l\'elenco e riprova.');
  }
  return cur;
}

/** Posizione del grafico in CF.CHART_ORDER in base al titolo; in coda se non elencato. */
function chartRank_(chart) {
  let title = '';
  try {
    title = String(chart.getOptions().get('title') || '').toLowerCase();
  } catch (e) {
    // titolo non leggibile: il grafico resta in coda, ordinato per posizione sul foglio
  }
  for (let i = 0; i < CF.CHART_ORDER.length; i++) {
    if (title && title.indexOf(CF.CHART_ORDER[i].toLowerCase()) >= 0) return i;
  }
  return CF.CHART_ORDER.length;
}

function readCategoryGroups_(ss) {
  const sheet = getSheet_(ss, CF.CAT_SHEET);
  const col = sheet.getRange(1, 1, Math.min(sheet.getMaxRows(), 100), 1).getDisplayValues();
  const groups = [];
  for (let i = 0; i < col.length; i++) {
    const v = col[i][0].trim();
    if (v === '') break; // l'elenco categorie termina alla prima cella vuota
    if (v.indexOf('--') === 0) {
      groups.push({ label: v.replace(/-/g, '').trim(), items: [] });
    } else {
      if (!groups.length) groups.push({ label: '', items: [] });
      groups[groups.length - 1].items.push(v);
    }
  }
  return groups;
}

function validate_(input, ss) {
  if (!input || typeof input !== 'object') throw new Error('Dati mancanti.');
  const desc = String(input.desc || '').trim();
  if (!desc) throw new Error('Descrizione obbligatoria.');
  if (desc.length > CF.MAX_DESC) throw new Error('Descrizione troppo lunga (max ' + CF.MAX_DESC + ' caratteri).');

  const cat = String(input.cat || '');
  const allowed = readCategoryGroups_(ss).reduce(function (acc, g) { return acc.concat(g.items); }, []);
  if (allowed.indexOf(cat) < 0) throw new Error('Categoria non valida.');

  const amountText = String(input.amount || '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amountText)) throw new Error('Importo non valido.');
  const amount = Number(amountText);
  if (!(amount > 0)) throw new Error('L\'importo deve essere maggiore di zero.');

  const date = String(input.date || '');
  const tz = ss.getSpreadsheetTimeZone();
  let dateObj = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    dateObj = Utilities.parseDate(date, tz, 'yyyy-MM-dd');
  }
  // Il round-trip scarta date inesistenti come 2026-02-31.
  if (!dateObj || Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd') !== date) throw new Error('Data non valida.');

  return { desc: desc, cat: cat, amount: amount, date: date, dateObj: dateObj, imp: input.imp === true };
}

/** Evita che una descrizione che inizia con "=" o "+" venga interpretata come formula. */
function safeText_(text) {
  return /^[=+]/.test(text) ? "'" + text : text;
}

function pivotLastRow_(ss) {
  try {
    const pivots = getSheet_(ss, CF.CHARTS_SHEET).getPivotTables();
    let min = 0;
    pivots.forEach(function (p) {
      const last = p.getSourceDataRange().getLastRow();
      min = min ? Math.min(min, last) : last;
    });
    return min;
  } catch (e) {
    return 0; // controllo solo informativo
  }
}

function withLock_(fn) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Foglio occupato, riprova tra qualche secondo.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
