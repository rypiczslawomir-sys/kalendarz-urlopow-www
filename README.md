# Kalendarz urlopowy — wdrożenie online

Aplikacja wymaga serwera Node.js (logowanie + zapis danych w pliku `data/state.json`).

## Lokalnie (Windows)

1. Zainstaluj [Node.js](https://nodejs.org/) (wersja 18+).
2. Skopiuj konfigurację:
   ```bash
   copy .env.example .env
   ```
3. Edytuj `.env` — ustaw `AUTH_USER`, `AUTH_PASSWORD`, `SESSION_SECRET`.
4. Uruchom `uruchom.bat` albo:
   ```bash
   npm install
   npm start
   ```
5. Otwórz http://localhost:5175/login.html

Przy pierwszym logowaniu dane z `localStorage` przeglądarki (jeśli były) zostaną przeniesione na serwer.

---

## Wystawienie do internetu (Render.com — darmowy plan)

[Render](https://render.com) hostuje aplikację Node.js z darmowym HTTPS.

### 1. Repozytorium GitHub

```bash
git init
git add .
git commit -m "Kalendarz urlopowy z logowaniem"
git remote add origin https://github.com/TWOJ_USER/kalendarz-urlopow-www.git
git push -u origin main
```

### 2. Nowa usługa na Render

1. **New → Web Service** → połącz repozytorium.
2. **Runtime:** Node  
3. **Build Command:** `npm install`  
4. **Start Command:** `npm start`  
5. **Plan:** Free (wystarczy dla małego zespołu)

### 3. Zmienne środowiskowe (Environment)

| Klucz | Przykład | Opis |
|--------|----------|------|
| `AUTH_USER` | `admin` | Login |
| `AUTH_PASSWORD` | `TwojeSilneHaslo!` | Hasło (min. 8 znaków) |
| `SESSION_SECRET` | losowy 64-znakowy hex | Sesja — wygeneruj: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | `production` | Wymagane na hostingu |

Render ustawia `PORT` automatycznie.

### 4. Dysk trwały (ważne!)

Na darmowym planie plik `data/state.json` **znika po restarcie** kontenera.

**Opcja A — Render Disk (płatny dodatek):**  
Zamontuj dysk np. w `/opt/render/project/src/data` i trzymaj tam `state.json`.

**Opcja B — Railway / VPS:**  
Na własnym serwerze folder `data/` jest trwały — wystarczy `npm start` + nginx (opcjonalnie).

**Opcja C — test / demo:**  
Bez dysku — dane przetrwają do następnego deployu/restartu.

---

## Railway (alternatywa)

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub.
2. Ustaw te same zmienne: `AUTH_USER`, `AUTH_PASSWORD`, `SESSION_SECRET`, `NODE_ENV=production`.
3. Railway domyślnie daje trwały wolumen na projekcie — dane zwykle przetrwają restart.

---

## Bezpieczeństwo

- Używaj **długiego hasła** (min. 12 znaków).
- **Nigdy** nie commituj pliku `.env` do Git.
- W produkcji zawsze `NODE_ENV=production` (ciasteczka sesji tylko przez HTTPS).
- Jeden użytkownik (`AUTH_USER`) — wystarczy dla wewnętrznego kalendarza zespołu.

---

## Eksport / import

Eksport i import JSON w aplikacji działają jak wcześniej — to kopia zapasowa niezależna od serwera.
