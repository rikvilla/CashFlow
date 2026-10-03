# CashFlow

App per telefono Android per inserire, consultare e modificare i movimenti del foglio Google
"CashFlow" (foglio `DB`) e vedere pivot e grafici (foglio `Charts`).

## Come è fatta

```
Telefono (app installata)
   └─ guscio statico su GitHub Pages      → index.html, manifest, icone (radice del repo)
        └─ web app Google Apps Script     → apps-script/Code.gs + apps-script/Index.html
             └─ foglio Google CashFlow    → fogli DB, Charts, readme
```

- **Guscio** (radice del repo): rende l'app installabile e a schermo intero. Contiene solo
  l'URL della web app; nessun dato, nessun codice di accesso.
- **Web app Apps Script** (`apps-script/`): tutta la logica. Il codice vive nel progetto
  Apps Script legato al foglio; la copia in questo repo serve da archivio e storico.
- **Accesso**: la web app è pubblicata con accesso "Chiunque", protetta da un codice di accesso
  salvato nelle proprietà dello script (non nel sorgente).

## File del repo

| File | A cosa serve | Pubblicato da Pages |
|---|---|---|
| `index.html` | Guscio: carica la web app in un iframe. **Contiene l'URL `/exec`** | sì |
| `manifest.webmanifest` | Nome, icone e modalità a schermo intero dell'app installata | sì |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Icone | sì |
| `apps-script/Code.gs` | Backend: lettura/scrittura sul foglio, export Charts, controllo codice | sì, ma inerte |
| `apps-script/Index.html` | Interfaccia: schede Nuovo / DB / Charts | sì, ma inerte |
| `README.md` | Questo file | no |

`apps-script/Index.html` e `index.html` sono due file diversi: non spostare i file Apps Script
nella radice.

## Cosa NON deve mai finire nel repo

- Il **codice di accesso**.
- Export del foglio (xlsx/csv) o screenshot con i movimenti.

L'URL `/exec` in `index.html` è pubblico per forza di cose: senza codice mostra solo la schermata
di sblocco.

---

## Installazione da zero

### 1. Apps Script (da PC)

1. Apri il foglio CashFlow → **Estensioni → Apps Script**.
2. **+ → Script**, nome `CashFlowApp`: incolla `apps-script/Code.gs`.
   Non toccare lo script già presente che autocompila la data.
3. **+ → HTML**, nome esattamente `Index`: incolla `apps-script/Index.html`.
4. Nel menu a tendina delle funzioni scegli **`setupAccessCode`** → **Esegui** → autorizza.
   Nel "Log di esecuzione" compare il codice di accesso (`xxxx-xxxx-xxxx-xxxx-xxxx`): annotalo
   in un posto sicuro (es. gestore di password).
5. **Esegui il deployment → Nuovo deployment → App web**:
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque** (non "Chiunque abbia un Account Google")
6. Copia l'URL che termina con `/exec`.

### 2. Guscio su GitHub Pages (da PC)

1. In `index.html` (radice) sostituisci l'attributo `src` dell'iframe con l'URL `/exec`.
2. Carica i file nel repo, con questa struttura.
3. **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
4. Dopo 1–2 minuti l'app è su `https://<utente>.github.io/<repo>/`.

### 3. Telefono

1. Apri `https://<utente>.github.io/<repo>/` in Chrome.
2. Inserisci il codice di accesso (una volta sola: resta salvato).
3. Menu ⋮ → **Installa app** (se non compare, usa la pagina per ~30 secondi e riprova).

---

## Modificare il codice

**Interfaccia o backend (`apps-script/`)**

1. Modifica il file nell'editor Apps Script e salva.
2. **Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione → Esegui il deployment.**
   Non creare un "Nuovo deployment": cambierebbe l'URL. Lascia "Chiunque".
3. Copia la stessa modifica nel repo (`apps-script/`) e fai commit, così il repo resta allineato.
4. Sul telefono chiudi e riapri l'app.

**Guscio (radice)**: modifica, commit, attendi 1–2 minuti. Serve solo se cambia l'URL `/exec`,
il nome o le icone. Se cambi nome o icone, disinstalla e reinstalla l'app sul telefono.

---

## Passaggio al foglio 2027

Lo script è legato al singolo foglio. Con "Crea una copia" il codice viene copiato nel nuovo
file, ma **il deployment e il codice di accesso no**: il nuovo foglio ha un URL `/exec` diverso.
L'app sul telefono non va reinstallata.

1. **Crea il foglio 2027** con File → Crea una copia del 2026 e preparalo come ogni anno
   (svuota i movimenti, aggiorna le date delle righe segnaposto: vedi il foglio `readme`).
2. **Controlla la struttura** del nuovo foglio:
   - i fogli si chiamano ancora `DB`, `Charts`, `readme`;
   - le categorie sono in `readme!A1:A…`, senza celle vuote in mezzo, con i separatori
     `-- Uscite --` / `-- Entrate --`;
   - la prima riga dei movimenti reali è ancora la **242** (20 categorie × 12 segnaposto + intestazione).
     Se hai aggiunto o tolto categorie, aggiorna **sia** la formula ID in `DB!A2` **sia**
     `CF.FIRST_ROW` in `Code.gs`: devono coincidere.
3. **Apps Script del foglio 2027** (Estensioni → Apps Script): verifica che ci siano
   `CashFlowApp` e `Index`. Se mancano, incollali dal repo.
4. Esegui **`setupAccessCode`**, autorizza, annota il **nuovo codice**.
5. **Esegui il deployment → Nuovo deployment → App web** (Me / Chiunque) → copia il nuovo `/exec`.
6. Nel repo, in `index.html` (radice), sostituisci l'URL dell'iframe con quello nuovo → commit.
7. Dopo 1–2 minuti, sul telefono chiudi e riapri l'app: chiede il codice → inserisci quello nuovo.
   Se vedi ancora i dati 2026, è la cache: chiudi del tutto l'app e riapri.
8. **Chiudi il 2026**: nel foglio 2026 → Apps Script → Gestisci deployment → **Archivia**.
   Da quel momento il vecchio URL non risponde più.
9. Verifica con la checklist qui sotto.

Per consultare ancora il 2026 dal telefono dopo il passaggio, salta il punto 8 e tieni da parte
il vecchio URL e il vecchio codice.

---

## Checklist di verifica

1. Inserisci un movimento di prova da 0,01 € → messaggio "OK", form svuotato.
2. Scheda **DB**: il movimento è in cima; sul foglio è nella prima riga libera, con ID valorizzato.
3. Scheda **Charts**: pivot adattata allo schermo, zoom con pizzico e pulsanti, totali aggiornati;
   poi i grafici "Entrate-Uscite-Netto" e "Uscite per categoria".
4. Tocca il movimento di prova → **Elimina → Conferma eliminazione**.
5. Importo non valido (`abc`, `0`) → messaggio "KO", campi non svuotati.

---

## Codice di accesso

- **Dove sta**: Apps Script → Impostazioni progetto → Proprietà script → `ACCESS_CODE`.
- **Cambiarlo** (telefono perso, dubbio che sia trapelato): riesegui `setupAccessCode`.
  Il vecchio smette subito di funzionare; l'app chiederà quello nuovo.
- Chi conosce URL e codice può leggere e modificare i movimenti: non condividerlo.

---

## Comportamenti da conoscere

- **Riga di scrittura**: prima riga con B:F vuote a partire da `CF.FIRST_ROW`.
- **Eliminazione**: cancella la riga del foglio; gli ID dei movimenti successivi scalano di uno
  (l'ID è calcolato dal numero di riga).
- **Modifica**: riscrive solo i campi cambiati, così restano intatte eventuali formule
  nell'importo e l'orario nelle date già presenti.
- **Limite delle pivot**: leggono `DB!B1:F2289`. Se un movimento finisce oltre, l'app lo salva
  e avvisa; va esteso l'intervallo delle pivot sul foglio.
- **Formattazione condizionale**: i colori verde/rosso rispetto ai target non compaiono
  nell'app (Apps Script non li restituisce). Usa "Apri il foglio originale nel browser".
- **Tema scuro**: tabella e grafici sono invertiti dall'app; i colori chiari risultano più spenti.
- **Ordine dei grafici**: `CF.CHART_ORDER` in `Code.gs`, per titolo del grafico.
- **Solo online**: senza rete non si può inserire.

## Problemi noti

| Sintomo | Causa | Soluzione |
|---|---|---|
| `401. That's an error` nell'app | Il deployment richiede il login Google | Gestisci deployment → accesso **Chiunque**; verifica che l'URL nel guscio sia quello di quel deployment |
| "Codice di accesso non valido" | Codice errato o rigenerato | Reinserisci; il valore corrente è nelle Proprietà script |
| "Codice di accesso non configurato" | `setupAccessCode` mai eseguita su questo foglio | Eseguila dall'editor |
| Le modifiche al codice non si vedono | Deployment non aggiornato | Gestisci deployment → Nuova versione |
| Il guscio mostra ancora il vecchio URL | Cache di GitHub Pages / del telefono | Attendi 1–2 minuti, chiudi e riapri l'app |
| Movimento salvato ma assente in Charts | Riga oltre l'intervallo delle pivot | Estendi l'intervallo dati delle due pivot |
| "Il foglio è cambiato nel frattempo" | Il foglio è stato modificato altrove dopo il caricamento | Tocca "Aggiorna" e riprova |
