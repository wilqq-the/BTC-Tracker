# AGENTS.md — BTC Tracker

Guide pour les agents et les développeurs qui travaillent sur ce dépôt.

---

## 1. Qu'est-ce que c'est

**BTC Tracker** est un tracker de portefeuille Bitcoin **auto-hébergé**. L'utilisateur saisit
ses transactions (achats, ventes, transferts) et l'application calcule holdings, P&L, performance
DCA et projections.

- **Version** : 0.8.0 (`VERSION`, `package.json`) — v0.8.0 officielle + les ajouts de ce fork
  (on-chain, portfolio par utilisateur, Total invested on-chain, DCA). Voir §18 pour la fusion.
- **Licence** : MIT
- **Base** : Next.js App Router, React 18, TypeScript, Prisma, SQLite
- **Langue de l'UI** : anglais uniquement. Ne pas introduire de texte en français dans les
  composants.
- **Langue de la codebase** : anglais (commentaires, noms, messages de log).

---

## 2. Lecture on-chain : ce qui est vrai aujourd'hui

**Depuis la version 0.7.0, l'application peut lire la chaîne Bitcoin — en opt-in, et
uniquement via une API Esplora.** Cette section remplace l'affirmation précédente
« aucune donnée on-chain », qui était vraie avant cette version.

### Ce qui existe

- `src/lib/esplora-client.ts` : client HTTP Esplora **read-only** (`/blocks/tip/height`,
  `/address/:addr`, `/txs/chain`, `/txs/mempool`, `/utxo`).
- `src/lib/onchain/address-derivation.ts` : parsing xpub/ypub/zpub/tpub/upub/vpub et
  dérivation `m/0/k` + `m/1/k` via `@scure/bip32`. Aucune clé privée n'est acceptée ni demandée.
- `src/lib/onchain/onchain-sync-service.ts` : import des transactions, snapshots de solde.
- `src/lib/onchain/onchain-scheduler.ts` : polling périodique.
- `src/lib/onchain/settings-validation.ts` : validation de l'endpoint et des bornes.
- Modèle `WatchedAddress` (`prisma/schema.prisma`) : une ligne par adresse ou xpub suivi.
- **Valorisation au jour du bloc** : chaque ligne importée est valorisée au prix de clôture
  du jour du bloc (backfill Yahoo à la demande si la date précède la fenêtre locale). Ces
  acquisitions alimentent « Total invested » (§13.5).

### Ce qui reste vrai

- **Aucune écriture on-chain, jamais.** Pas de signature, pas de broadcast, pas de PSBT.
- **Aucun WebSocket** : Esplora n'en expose pas pour les adresses, le suivi est un polling.
- **Aucune clé privée** n'est demandée, stockée ou acceptée. `parseXpub` rejette explicitement
  les préfixes `xprv`/`yprv`/`zprv`/`tprv` avec un message explicite.
- Le modèle `Wallet` **reste un conteneur étiqueté** (`name`, `type`, `emoji`, `note`).
  L'adresses vient de `WatchedAddress`, pas de `Wallet`.
- `destination_address` reste du texte libre non validé côté import CSV.

### Les quatre règles à ne pas casser

1. **Confidentialité de l'endpoint.** `onchain.enabled` vaut `false` par défaut. Activé, chaque
   adresse suivie est demandée à l'endpoint configuré. Le défaut est `https://mempool.space/api`,
   donc **les adresses d'un déploiement qui utilise le défaut sont visibles par un tiers**.
   C'est documenté dans l'UI et le README. Pour être réellement self-hosted, il faut son propre
   `bitcoind -txindex=1 -blockfilterindex=1` + `electrs` (recette commentée dans
   `docker-compose.yml`).
2. **Le xpub est chiffré au repos** (`EncryptionService`, AES) et **jamais renvoyé par l'API** :
   les routes ne renvoient qu'un `hasXpub: boolean`. Ne jamais ajouter le xpub à une réponse,
   un log ou un export.
3. **L'agrégation est par utilisateur, pas par adresse surveillée.** `syncBatch` prend *toute* la
   liste de `WatchedAddress` actives d'un utilisateur. Un envoi entre deux wallets surveillés n'est
   reconnu que si les deux côtés sont connus : agréger adresse par adresse importerait le montant
   entier en `TRANSFER_OUT`, et l'index unique `[userId, txid]` figerait cette ligne erronée.
   C'est couvert par `src/tests/onchain/onchain-sync-batch.test.ts`.
4. **Les réglages `onchain` sont réservés à l'admin.** `AppSettings` est une ligne globale (§9.3) :
   l'endpoint configuré reçoit les adresses de **tous** les utilisateurs. `onchain` est donc dans
   `ADMIN_ONLY_CATEGORIES` (`src/app/api/settings/route.ts`) au même titre que `priceData` ; un
   non-admin reçoit 403 et voit le panneau en lecture seule (`OnchainPanel isAdmin`). Chacun peut
   toujours suivre et synchroniser **ses** adresses (`/api/onchain/*`, filtré par `userId`).
   Couvert par `src/tests/api/security-auth.test.ts` (« on-chain settings »).

### Précision ES5 qui a déjà coûté un bug

`tsconfig.json` cible ES5. Deux pièges, tous deux rencontrés sur cette feature :

1. Une classe qui étend `Error` y perd sa chaîne de prototypes : sans
   `Object.setPrototypeOf(this, X.prototype)`, `instanceof X` vaut **toujours** `false`. C'est le cas
   de `EsploraError` et de `OnchainSettingsError`, tous deux testés par `instanceof`. Sans ce
   correctif, les trois `instanceof EsploraError` du client ne absorbaient aucun 404, donc une
   adresse neuve que le backend ne connaît pas encore levait une erreur au lieu de renvoyer
   « aucune donnée ». Si tu ajoutes une classe d'erreur, fais la même chose.
2. `for (const [i, x] of arr.entries())` ne compile pas (`--downlevelIteration` absent). Utilise
   `for (let i = 0; i < arr.length; i++)`.

---

## 3. Démarrage

### Prérequis
- **Node.js 22+** (requis par `yahoo-finance2` et les dépendances cryptographiques)
- npm 8+

### Installation

```bash
npm install
cp .env.example .env
# OBLIGATOIRE : générer un vrai secret
openssl rand -base64 32      # → coller dans NEXTAUTH_SECRET
npm run dev                  # migrations appliquées automatiquement
```

Puis ouvrir http://localhost:3000. **Le premier compte créé devient automatiquement admin**
(`src/app/api/auth/register/route.ts:43`).

### Variables d'environnement

| Variable | Requis | Défaut | Rôle |
|---|---|---|---|
| `NEXTAUTH_SECRET` | **oui** | — | Signature des sessions et des JWT d'API |
| `DATABASE_URL` | oui | `file:./prisma/dev.db` | Chemin SQLite (voir §9 pour le piège de résolution) |
| `NEXTAUTH_URL` | oui | `http://localhost:3000` | URL de callback auth |
| `NODE_ENV` | non | `development` | — |
| `ENCRYPTION_KEY` | non | — | Repli **seulement si `NEXTAUTH_SECRET` est absent** : la clé AES est dérivée (PBKDF2) de `NEXTAUTH_SECRET` en priorité. Elle chiffre les clés API exchange **et les xpub** suivis |

### Commandes

```bash
npm run dev              # migrate.js + next dev
npm run dev:skip-migrate # next dev seul
npm run build            # next build (output: standalone)
npm start                # migrate.js + next start
npm run type-check       # tsc --noEmit
npm run lint             # next lint (déprécié en Next 16)
npm test                 # test-setup + jest (693 tests)
npm test:coverage
npm exec prisma studio   # GUI BDD
npm run db:reset         # reset + seed
npm run electron:dev     # app desktop Electron
npm run demo:seed        # compte de démo (captures du README)
```

---

## 4. Architecture

```
src/
├── app/                    # App Router
│   ├── page.tsx            # Dashboard
│   ├── transactions/       # Liste + filtres + import/export
│   ├── analytics/          # Perf mensuelle + stats
│   ├── goals/              # "Planning" (analyse DCA dans components/planning/)
│   ├── settings/           # Account / Wallets / API access / Currency / Price data (admin) /
│   │                       # Exchanges / On-chain / Display / Backup (admin) / Admin
│   ├── auth/               # signin / signup
│   └── api/                # 67 fichiers route.ts (dont /api/onchain/*)
├── instrumentation.ts      # point d'entrée des schedulers
├── middleware.ts           # auth de toutes les /api (sauf /api/auth/* et /api/health)
├── components/             # 81 composants .tsx
│   ├── widgets/            # 13 widgets du dashboard
│   ├── planning/           # DCAAnalysisPanel, GoalCard
│   ├── dashboard/          # DashboardGrid (react-grid-layout)
│   └── ui/                 # shadcn/ui + composants du design v0.8.0
├── lib/                    # 37 modules métier (+ exchanges/, onchain/)
│   ├── exchanges/          # 5 adaptateurs (Kraken, Binance, Coinbase, Bybit, Gemini)
│   ├── *-service.ts        # logique métier
│   └── *-scheduler.ts      # tâches de fond
├── hooks/                  # use-btc-unit, use-display-currency, use-portfolio-metrics, use-toast…
├── tests/                  # 38 suites + setup/helpers
├── data/currencies.json    # devises intégrées
└── types/next-auth.d.ts
```

**Environ 271 fichiers TS/TSX.** La page `profile/` n'existe plus depuis v0.8.0 : tout est dans
Settings. Les tests sont dans `src/tests/`, à côté du code, pas dans un
dossier racine `__tests__`.

### Démarrage à froid

`src/instrumentation.ts` → `AppInitializationService.initialize()` (`src/lib/app-initialization.ts`)
→ vérifie la BDD, charge les settings, initialise les taux de change, lance les schedulers,
calcule le portfolio. Les erreurs d'init sont **avalées** pour ne pas empêcher le démarrage.

---

## 5. Modèle de données

`prisma/schema.prisma` — SQLite. 16 modèles.

| Modèle | Rôle |
|---|---|
| `User` | compte, `isAdmin`, `isActive`, PIN, secret 2FA, codes de backup |
| `BitcoinTransaction` | BUY / SELL / TRANSFER, fees, `transferFeeMode` (`ON_TOP`/`DEDUCTED`, §9.10), tags CSV, wallets from/to, `destinationAddress` (texte libre), métadonnées on-chain (`txid`, `source`, `confirmations`…) |
| `Wallet` | étiquette utilisateur : `name`, `type` cold/hot, `emoji`, `includeInPortfolio` |
| `Goal` | cible BTC, date, budget mensuel, scénario de prix (5°) |
| `RecurringTransaction` | Auto-DCA : fréquence, montant, prochaine exécution |
| `ExchangeConnection` | clé API **chiffrée**, wallet associé, statut de sync |
| `WatchedAddress` | adresse ou xpub suivi (xpub **chiffré**), wallet optionnel, gap limit, curseur de sync |
| `ApiKey` | hash + prefix + expiration, pour l'automatisation |
| `AppSettings` | JSON blob (currency / priceData / display / notifications / onchain), **ligne globale** (§9.3) |
| `DashboardLayout` | positions des widgets (JSON) |
| `CustomCurrency` | devises définies par l'utilisateur |
| `PortfolioSummary` | holdings pré-calculés (cold/hot, P&L, 24h) |
| `BitcoinCurrentPrice` | dernier prix spot connu + variation 24h |
| `BitcoinPriceHistory` | OHLC quotidien |
| `BitcoinPriceIntraday` | points intra-day |
| `ExchangeRate` | cache des taux fiat |

### Conventions de schéma

- Noms de colonnes en `snake_case` via `@map()`, noms de champs Prisma en `camelCase`
- Tables mappées via `@@map("nom_en_snake")`
- Chaque modèle a un `@@index([userId])`
- `onDelete: Cascade` depuis `User` partout

### Ajouter une migration

1. Créer le dossier dans `prisma/migrations/` avec le format `AAAAMMJJHHMMSS_nom/`
2. **Ajouter le nom dans le tableau `ALL_MIGRATIONS` de `scripts/migrate.js:54`** — cette liste
   est codée en dur et sert au mécanisme de baselining/récupération. L'oublier casse la
   récupération automatique sur les bases legacy.

---

## 6. Conventions de code

### Chemins
- Alias `@/*` → `src/*` (`tsconfig.json`)
- Chemins **relatifs uniquement** dans les commandes shell

### API routes

Tout est en App Router, format `NextRequest` → `NextResponse`.

```ts
import { withAuth, withAdminAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    // userId toujours filtrer les données — isolation multi-user
    return NextResponse.json({ success: true, data });
  });
}
```

- `withAuth(request, cb)` — authentifie (session ou Bearer token)
- `withAdminAuth(request, cb)` — idem + vérification admin
- Depuis v0.8.0, `src/middleware.ts` couvre **toutes** les `/api/*` (publiques : `/api/auth/*`,
  `/api/health`). Les routes vérifient quand même elles-mêmes (`withAuth`), le middleware n'est
  qu'un premier filtre. **Toute nouvelle route doit entrer dans la matrice `ROUTES` de
  `src/tests/api/security-auth.test.ts`** (401 sans auth, 403 si admin requis).
- Opérations serveur (réglages `priceData`/`onchain`, reset/replace des réglages, devises
  custom, refresh prix/historique, schedulers, backups, utilisateurs) : `withAdminAuth`.
- Réponses : toujours `{ success: boolean, data?, error?, message? }`

**Règle critique : toute requête Prisma sur une table par utilisateur DOIT filtrer par
`userId`.** C'est le pilier de l'isolation multi-user.

### Authentification

Deux mécanismes coexistants, gérés par `src/lib/auth-helpers.ts` :
1. **Session NextAuth** — pour le navigateur
2. **Bearer token JWT** — pour l'API (`/api/auth/token`, durée configurable, défaut 7j)

`ApiKey` (nouveau) coexiste avec les JWT : vérifier lequel est utilisé avant de modifier
`requireApiAuth` / `verifyApiToken`.

### Conventions UI
- shadcn/ui dans `src/components/ui/`
- Design v0.8.0 : teintes `bg-tint-{orange,green,red,blue,purple}` + `text-tint-*-fg`,
  `text-primary-strong` pour l'orange lisible, cartes `rounded-2xl`. `text-profit` / `text-loss`
  existent encore. **Il n'y a pas de couleur `warning`** : une classe `*-warning` ne produit rien
  (c'était le cas de l'encadré de confidentialité on-chain avant la fusion).
- Montants BTC : `useBtcUnit().formatBtc` (respecte le mode BTC/sats), pas de `toFixed(8)` en dur.
- Utiliser `cn()` de `@/lib/utils` pour conditionner des classes
- Widgets du dashboard : drag & drop via `react-grid-layout`, positions persistées dans
  `DashboardLayout`. Toute modification de la liste de widgets doit être répercutée dans
  `src/lib/dashboard-constants.ts` **et** dans la liste `validWidgetTypes` de
  `src/components/dashboard/DashboardGrid.tsx:145` (sinon le widget est silencieusement ignoré
  au chargement).

### Parsers d'import CSV

`src/app/api/transactions/import/parsers/`, pattern Strategy :
`kraken.ts`, `binance.ts`, `coinbase.ts`, `strike.ts`, `bitcoin21.ts`, `river.ts`, `cashapp.ts`,
`revolutx.ts`, `legacy.ts`, + `standard.ts` (fallback, toujours dernier dans `index.ts`).

`detectParser(headers)` choisit le meilleur selon un score de confiance ; sous 30 points → fallback
`standard`. Voir `src/app/api/transactions/import/parsers/PARSER_DEVELOPMENT_GUIDE.md`.

---

## 7. Pipeline de prix

```
Yahoo Finance (BTC-USD)  ──┬─→ bitcoin_current_price    (prix spot, + variation 24h)
                           ├─→ bitcoin_price_history   (OHLC quotidien, 365 j par défaut)
                           └─→ bitcoin_price_intraday   (points 5 min, 7 j par défaut)
                                        ↓
                            ExchangeRateService  ←  exchangerate-api.com/v4/latest
                                        ↓
                            BitcoinPriceService.calculateAndStorePortfolioSummary()
                                        ↓
                                   PortfolioSummary
```

### Schedulers

Tous lancés par `AppInitializationService`, pilotés par `setInterval` **en mémoire**.

| Scheduler | Intervalle | Fichier |
|---|---|---|
| Prix intra-day | 5 min | `src/lib/price-scheduler.ts:37` |
| Taux de change | 4 h | `src/lib/price-scheduler.ts:74` |
| Historique | quotidien (6h00) | `src/lib/historical-data-service.ts:205` (setTimeout vers 6h00 puis `setInterval` 24 h) |
| Auto-DCA | 1 h | `src/lib/dca-scheduler.ts:15` |
| Sauvegardes auto | configurable (Settings → Backup) | `src/lib/backup-scheduler.ts` |
| On-chain | `onchain.syncIntervalMinutes` (10 min par défaut, 1–1440) | `src/lib/onchain/onchain-scheduler.ts` |

Le scheduler on-chain est le seul **réappliqué à chaud** : un PATCH `/api/settings` qui contient
`onchain` appelle `OnchainScheduler.applySettings()` (démarre, replanifie ou arrête). `start()` ne
fait aucun `await` entre la lecture des réglages et l'armement du timer : deux appels concurrents
n'arment qu'un seul `setInterval`. Une replanification ne relance pas de sync complète.

---

## 8. Multi-utilisateur

- Premier utilisateur = admin, **le reste est ignoré** si des utilisateurs existent déjà
- Transactions, wallets, goals, API keys, layouts : isolés par `userId`
- L'admin gère les comptes mais **ne voit jamais les données financières** des autres
- `User.isActive` permet de désactiver un compte

---

## 9. Pièges connus — lire avant de coder

### 9.1 Node 22 requis
`yahoo-finance2@3.11.2` **requiert Node ≥ 22**. Le projet déclare maintenant
`engines.node: ">=22.0.0"` et fournit un fichier `.nvmrc`. Utiliser
Node 22 ou plus récent pour le développement local et la production.

### 9.1b Le lockfile élague, et ce n'est pas nouveau
`npm install --package-lock-only` retire ~1 800 lignes d'entrées mortes du `package-lock.json`, y
 compris sur la version d'origine du dépôt : le fichier était déjà désynchronisé de ce que npm 10
calcule, indépendamment de toute modification. Vérifié le 2026-09-27 en restaurant le
`package.json` et le lockfile d'origine avant de relancer la commande. Le diff est donc attendu et
`npm ci` passe (`--dry-run` vérifié). Ne pas « corriger » le diff à la main.


### 9.2 Le chemin de la base est trompeur
`DATABASE_URL="file:./prisma/dev.db"` (valeur de `.env.example`) est résolu par Prisma **relativement
à l'emplacement de `schema.prisma`**, pas au cwd. Résultat : la base est créée dans
`prisma/prisma/dev.db`, et non `prisma/dev.db` comme l'annonce le README.

Pour obtenir `prisma/dev.db`, il faut `DATABASE_URL="file:./dev.db"`.
Scripts de sauvegarde : se souvenir du chemin réel.

### 9.3 `SettingsService` est global, pas par utilisateur
`src/lib/settings-service.ts` :
- `loadSettings()` fait `findFirst({ orderBy: { id: 'desc' } })` **sans filtre `userId`**
- `saveSettings()` ne renseigne pas `userId`
- un cache statique en mémoire : `private static settings`
- `src/app/api/settings/route.ts` ne passe jamais `userId`

Conséquence : en multi-utilisateur, **tous partagent les mêmes réglages** (devise, display, données
de prix, on-chain), alors que leurs transactions sont bien isolées. Depuis v0.8.0, les sections
de niveau serveur (`priceData`, et `onchain` dans ce fork) sont réservées à l'admin. Le schéma prévoit `AppSettings.userId`
mais il n'est pas utilisé. À corriger si le multi-user doit réellement isoler les préférences.

### 9.4 Tests série obligatoire
`jest.config.js` force `maxWorkers: 1` : tous les tests partagent **une seule base SQLite**
(`src/tests/jest.env.js`). Ne pas augmenter le parallélisme, ça provoque des violations de FK.

### 9.5 `ExchangeSyncService` n'est jamais automatique
Aucun scheduler ne l'appelle. Le sync exchange est **déclenché manuellement** via
`/api/exchanges/[id]/sync` et `/test`. Ne pas supposer une synchronisation automatique.

### 9.6 Le scheduler Auto-DCA est en mémoire
`setInterval` hourly. Au redémarrage du process, les exécutions **ratées pendant l'arrêt ne sont pas
rattrapées** — le scheduler ne cherche que `nextExecution <= now`.

### 9.7 Notifications non câblées
`NotificationSettings` (alertes prix, seuils de profit, email, push) est persisté et éditable mais
**aucun service d'envoi n'existe**. Réglages sans effet.

### 9.8 Champs calculés non affichés
`DCAAnalysisService` (`src/lib/dca-analysis-service.ts`, 791 lignes) calcule `recommendations`,
`monthlyBreakdown`, `longestGap`, `missedMonths`, `bestPurchaseDate`… L'API les renvoie tous.
Avant d'écrire du code de calcul, **vérifier si l'UI les affiche déjà** — historiquement une partie
était calculée puis jetée (corrigé pour `recommendations` / timing / consistency / monthly le
2026-09-27). Même situation probable sur le widget DCA Performance (`src/components/widgets/`).

### 9.9 Un `.sql` parasite dans migrations/
`prisma/migrations/0001_initial_schema.sql` est un fichier SQL isolé, pas un dossier de migration.
Prisma ne le reconnaît pas. À supprimer si jamais touché.

### 9.10 Modes de frais des transferts : un seul calcul de solde
v0.8.0 (#168) ajoute `transferFeeMode` : `ON_TOP` (le montant arrive, montant + frais partent) ou
`DEDUCTED`/`null` (le montant part, montant − frais arrive). Les helpers sont dans
`src/lib/transfer-fees.ts` (`btcArriving`, `btcLeaving`, `transferFeeBtc`).

**Tout calcul du total BTC passe par `transferHoldingsDelta(tx)`** : + ce qui arrive pour
`TRANSFER_IN`, − ce qui part pour `TRANSFER_OUT`, − les frais pour un mouvement entre ses propres
wallets. `BitcoinPriceService` et `/api/portfolio-metrics` l'utilisent tous les deux ; un test
vérifie qu'ils tombent sur le même total (`src/tests/onchain/onchain-fee-mode.test.ts`). Ne pas
réécrire une somme `IN − OUT − fees` à la main : elle compte mal un `TRANSFER_OUT` en `DEDUCTED`.

Conventions qui en découlent :
- l'import on-chain écrit un envoi en **`ON_TOP`** (`btcAmount` = ce qu'ont reçu les destinataires,
  `fees` = frais réseau payés) et une réception sans frais ni mode ; une ligne stockée sans le bon
  mode est réparée au sync suivant (dérive détectée dans `onchain-sync-service.ts`) ;
- la migration `20261011000000_backfill_transfer_out_fee_mode` passe en `ON_TOP` tous les
  `TRANSFER_OUT` sans mode : c'est ainsi que ce fork les comptait déjà, aucun solde ne bouge
  (vérifié avec `scripts/migrate.js` sur une copie de base) ;
- l'API transactions force `transferFeeMode = null` sur un `TRANSFER_IN` (comportement upstream).

### 9.11 Ne pas mettre de règle pure dans `bitcoin-price-service`
Plusieurs tests upstream remplacent **tout** le module `bitcoin-price-service` par un mock. Une
fonction pure exportée par ce module (ex. `isOnchainAcquisition`) devient alors `undefined` dans
les routes testées. D'où `src/lib/acquisition.ts` : le service le ré-exporte pour compatibilité,
mais les routes l'importent directement.

### 9.12 Les tests de routes passent une requête
Les routes upstream prennent toutes une `request` depuis v0.8.0. Avec `src/tests/**` inclus dans
`tsc` (§13.4), appeler `GET()` sans argument ne compile pas : utiliser `authedRequest()` de
`src/tests/mock-auth-helpers.ts`, avec `adminAuthMock()` pour les tests qui ne portent pas sur
l'auth.

---

## 10. Tests

```bash
npm test                  # 693 tests, 38 suites
npm run test:watch
npm run test:coverage
npm run test:ci           # coverage + --ci, pour la CI
```

- Jest + ts-jest, `testEnvironment: 'node'`
- `jest.config.js` a un `transformIgnorePatterns` qui laisse passer les paquets ESM
  (`@scure/*`, `@noble/*`) : sans ça, `import` de `@scure/bip32` échoue à l'import du module.
- Les tests on-chain qui ont besoin du HTTP démarrent un vrai serveur sur `127.0.0.1:0`
  (`src/tests/onchain/onchain-sync-*.test.ts`) : c'est ce qui permet d'affirmer que le paging,
  les 404 et le curseur se comportent comme en production.
- `src/tests/setup.ts` : connexion à la BDD de test + nettoyage
- `src/tests/test-helpers.ts` : helpers (création d'utilisateurs, `createTestUserWithToken`,
  transactions factory)
- `src/tests/mock-auth-helpers.ts` : `adminAuthMock()` (route exécutée en admin) et
  `authedRequest()` (§9.12)
- `src/tests/api/security-auth.test.ts` : matrice d'auth de toutes les routes, y compris
  `/api/onchain/*` et les routes DCA de ce fork
- La couverture exclut volontairement `src/app/**/*.tsx` et `src/components/**`

Avant de soumettre une modification : `npm run type-check && npm run lint && npm test`.

---

## 11. Déploiement

### Docker
```bash
cp docker.env.example .env   # renseigner NEXTAUTH_SECRET
docker-compose up -d         # → http://localhost:3000
```
Image `thewilqq/btc-tracker`. La BDD vit dans le volume `btc_data` monté sur `/app/data`.
`PUID`/`PGID` sont supportés pour TrueNAS / homelab. Un healthcheck sonde `/api/health`.

### Umbrel
Publication en un clic sur l'App Store Umbrel.

### Electron
`npm run electron:build` génère l'installeur Windows (beta). `electron/main.js` attend le serveur
local via polling HTTP avant d'afficher la fenêtre.

### Sauvegarde
Tout tient dans **un seul fichier SQLite** (`prisma/prisma/dev.db` en dev,
`/app/data/bitcoin-tracker.db` en conteneur). Copier ce fichier = backup complet.

Depuis v0.8.0 :
- **Settings → Backup** (admin) : téléchargement, snapshots serveur, restauration, sauvegardes
  planifiées ;
- `scripts/migrate.js` copie la base en `…pre-upgrade-<date>.bak` (3 gardées) **avant** toute
  migration, et n'applique plus jamais un `db push` destructif (il avertit et laisse les données) ;
- les clés exchange **et les xpub suivis** sont chiffrés avec une clé dérivée de
  `NEXTAUTH_SECRET` : une sauvegarde restaurée sur une instance avec un autre secret les rend
  illisibles (les adresses simples et le reste des données ne sont pas touchés).

---

## 12. Règle d'or

1. **Ne pas casser l'isolation `userId`.** Chaque requête sur une table par utilisateur filtre.
2. **Ne pas étendre la lecture on-chain** sans demande explicite (§2), et garder `onchain`
   réservé à l'admin (§2, règle 4).
3. **Ne pas modifier `package-lock.json`** en installant — `npm install` élague les paquets morts du
   lockfile. Restaurer le fichier si le diff n'est pas voulu.
4. **Mettre à jour `ALL_MIGRATIONS`** dans `scripts/migrate.js` à chaque nouvelle migration.
5. **Vérifier `type-check`, `lint` et `test`** avant de conclure.
6. **Tout calcul de solde passe par `transferHoldingsDelta`** (§9.10).
7. **Toute nouvelle route entre dans la matrice de `security-auth.test.ts`** (§6).

---

## 13. Modifications apportées depuis le projet original

État au 28/09/2026. Tout est dans le **commit local `47e769f`** (42 fichiers, +7368/−2751,
**non poussé** ; son message ne mentionne que le correctif portfolio alors qu'il contient aussi
toute la feature on-chain). Restent **non committés** : `tsconfig.json` et `AGENTS.md`.

### 13.1 Correctif multi-utilisateur (portfolio)

Avant, `BitcoinPriceService.calculateAndStorePortfolioSummary()` calculait le portfolio à partir
des transactions de **tous** les comptes et ignorait les transferts. Corrigé dans
`src/lib/bitcoin-price-service.ts` :

- la méthode prend maintenant un `userId` et calcule les holdings/P&L **par utilisateur**, en
  comptant `TRANSFER_IN` / `TRANSFER_OUT` ;
- le debounce statique est devenu une `Map<userId, Timeout>` au lieu d'un timeout unique
  (deux utilisateurs qui déclenchent un calcul en même temps ne s'écrasent plus) ;
- tous les appelants passent leur `userId` (`/api/bitcoin-price`, `/api/transactions/[id]`,
  `/api/transactions/import`, `dca-scheduler`, `exchange-sync-service`) ;
- les schedulers globaux utilisent `calculateAndStorePortfolioSummaryForAllUsers()`
  (`price-scheduler.ts`).

### 13.2 Surveillance on-chain read-only (opt-in)

- **Schéma** : modèle `WatchedAddress` (adresse ou xpub + wallet optional + gaps), métadonnées
  on-chain sur `BitcoinTransaction` (`txid`, `block_time`, `vout_index`, `source`, `confirmed_at`)
  en `BIGINT`, migration `20260928000000_add_onchain_address_watching` enregistrée dans
  `ALL_MIGRATIONS` (`scripts/migrate.js`).
- **Client** : `src/lib/esplora-client.ts` — HTTP read-only (tip height, `/address/:addr`,
  mempool, `/txs/chain` avec curseur, `/utxo`), gestion 404/500, `EsploraError` (voir §2 pour le
  piège ES5).
- **Dérivation** : `src/lib/onchain/address-derivation.ts` — parsing `xpub`/`ypub`/`zpub`/`tpub`/
  `upub`/`vpub`, dérivation `m/0/k` (receive) + `m/1/k` (change) via `@scure/bip32`, refus explicite
  des clés privées (`xprv`…) et des xpub P2WSH, `MAX_GAP_LIMIT = 200`.
- **Moteur** : `src/lib/onchain/onchain-sync-service.ts` — agrégation **par utilisateur** sur
  toutes les `WatchedAddress` actives (fusion efficace inter-wallets), snapshots par adresse,
  curseur incrémental (`lastSyncedTxid` + `getConfirmedTxsAfter` + fenêtre de 100 récentes, repli
  sur lecture complète), balayage RBF, réconciliation des lignes anciennes, attribution au plus
  petit `watchedAddressId` touché.
- **Scheduler** : `src/lib/onchain/onchain-scheduler.ts` — polling périodique, branché et arrêté
  proprement par `AppInitializationService`.
- **Validation** : `src/lib/onchain/settings-validation.ts` — schéma d'URL (HTTP(S) seulement,
  sans query/fragment), bornes (intervalle 1–1440 min, timeout 1000–120000 ms, gap 1–200),
  `OnchainSettingsError` ; `SettingsService.updateSettings` valide le bloc `onchain`,
  `/api/settings` répond 400 sur rejet.
- **API** : `/api/onchain/addresses`, `/[id]`, `/[id]/sync`, `/sync`, `/status` — routes dynamiques
  alignées Next 15 (`params: Promise`), ownership par `userId` (404 si record d'un autre), le xpub
  n'est **jamais** renvoyé (uniquement `hasXpub`), `DELETE` détache les transactions importées
  (`watchedAddressId = null`).
- **UI** : `src/components/OnchainPanel.tsx` (activation, endpoint + test, statut du scheduler,
  liste/watch, sync unitaire/global, suppression), onglet `On-chain` dans `src/app/settings/page.tsx`
  (le profil n'a pas été touché), `src/components/TransactionOnchainMeta.tsx` (badges pending /
  replaced / txid / confirmations) intégré dans `src/app/transactions/page.tsx`.
- **API transactions** : champs on-chain en snake_case exposés en alias dans
  `src/app/api/transactions/route.ts`.
- **Dépendances** : `@scure/bip32@2.4.0`, `@noble/hashes@2.4.0` ; `jest.config.js` reçoit un
  `transformIgnorePatterns` pour down-leveler ces paquets ESM en CJS pour Jest.
- **Docs** : `README.md` (§ on-chain + trade-off de confidentialité de l'endpoint),
  `docker-compose.yml` (recette `bitcoind` + `electrs` commentée), présent guide.

### 13.3 Bugs corrigés sur cette feature

1. **ES5 + `extends Error`** — `EsploraError` et `OnchainSettingsError` perdent leur chaîne de
   prototypes sans `Object.setPrototypeOf` : sans ça, les `instanceof` ne matchent jamais (voir §2).
2. **Porteuses multiples vers la même adresse** — la dédup des jambes est indexée sur
   `vin`/`vout`, pas sur l'adresse, sinon une seule sortie était conservée et les autres tombées.
3. **Agrégation adresse par adresse** — un transfert entre deux wallets surveillés serait importé
   comme `TRANSFER_OUT` du montant entier et figé par l'index unique `[userId, txid]` : corrigé
   par `syncBatch` (couvert par `src/tests/onchain/onchain-sync-batch.test.ts`).
4. **Curseur** — `lastSyncedTxid` était stocké mais jamais lu : le service relisait tout à chaque
   tick. Il est maintenant utilisé (voir §13.2).
5. **Backend sans `/txs/chain`** — un mempool self-hosted (électrum, comme celui
   de l'utilisateur : `"electrum": true`) n'expose pas les routes esplora pagées
   (`/address/:addr/txs/chain`, `/txs/mempool`) et répond 404. Le client lisait
   ce 404 comme « historique vide » : sync OK (stats/UTXOs) mais **0 ligne
   importée**. Corrigé dans `EsploraClient` : un 404/400 **sur la première page**
   bascule sur la surface mempool-native — **marche paginée de `/address/:addr/txs`
   avec `?after_txid=`** (page par page jusqu'à la fin), puis complément par les
   funding-txs des UTXOs (`/tx/:txid`) pour les backends qui ignorent le curseur.
   Sur page suivante, 404 = fin d'historique (inchangé). Validé à la main contre
   l'instance locale de l'utilisateur (marche `after_txid` : 35/35 txs sur 4 pages,
   puis 0 complément nécessaire) et par `src/tests/onchain/esplora-client.test.ts`
   (suite *mempool subset fallback* : paging, complément UTXO, adresse inconnue,
   propagation d'échec).
   Note : l'URL `https://100.113.245.42:2102` d'electrs vue chez l'utilisateur est
   la **page web Umbrel de l'app** (un SPA Express), pas une API Esplora — electrs
   parle le protocole Electrum (socket), pas HTTP. L'app n'en a donc pas besoin.

### 13.4 Tests

25 suites / 380 tests (dont 116 on-chain). Vérifié le 29/09/2026 : `npx tsc --noEmit`,
`npx next lint` et `npm test` passent. Comptes docs vérifiés : 58 `route.ts`, 213 TS/TSX,
25 suites de test. Le `tsconfig.json` modifié inclut `src/tests/**` dans le type-check
(`types: ["node","jest"]`, `ignoreDeprecations: "5.0"`) ; corollaires : la valeur `6.0` de
`ignoreDeprecations` est invalide (seule `5.0` est acceptée), et deux tests ont dû être
branchés compatibles ES5 (pas de BigInt literal).

### 13.5 « Total invested » on-chain et backfill du prix historique

Depuis ce changement, « Total invested » (et `averageBuyPrice`) du portfolio est calculé sur
**tout ce que l'utilisateur a financé**, pas seulement les `BUY` :

- Le pool d'acquisition = lignes `BUY` + lignes `TRANSFER` (`source == 'onchain'`,
  `transferType == 'TRANSFER_IN'`, `originalTotalAmount > 0`). Les imports on-chain
  valorisent chaque ligne au prix de clôture du jour du bloc ; c'est ainsi que le tracker
  découvre le coût de BTC possédés *avant* le scan.
- Les transferts `manual`/internes sont exclus : ils déplacent du BTC déjà dans le
  portfolio, les compter re-compterait l'investi.
- Une ligne importée sans base de coût (`originalTotalAmount == 0`) est exclue.
- `averageBuyPriceUSD = weightedBuyPriceSumUSD / totalAcquiredBTC` (volume acquis, pas le
  solde courant).
- **Calculateurs alignés sur le même pool** (helper partagé `isOnchainAcquisition`, dans
  `src/lib/acquisition.ts` depuis la fusion v0.8.0, §9.11) : `/api/portfolio-metrics` (widget Investment + page analytics
  via `?detailed=true`) et `/api/analytics` (supprimée à la fusion v0.8.0, §18) comptent tous
  deux le pool dans « Total invested »
  et `totalBtcAcquired` comme dénominateur d'`averageBuyPrice`. C'est le point de divergence
  qui causait un « Total invested = 0 » sur les vues analytics alors que `d543be3` avait déjà
  corrigé le calcul central. Le breakdown mensuel detaille bucket « buys » (BUY **ou**
  acquisition on-chain) vs « sells » (SELL **ou** `TRANSFER_OUT` on-chain), transferts internes
  ignorés des deux côtés. **Remplacé à la fusion v0.8.0 (§18)** : un transfert n'est jamais une
  vente ; un envoi on-chain va dans `transferredOut`, une réception on-chain valorisée reste un
  achat et n'est pas recomptée en `transferredIn`.
- **Backfill *gagé*** : `getOrFetchPriceForDate` ne laisse passer la demande Yahoo que si la
  table `bitcoin_price_history` contient **au moins un enregistrement** (une fenêtre locale
  existe). Sur une base vide (base neuve, tortues de test), il retourne `null` **sans toucher au
  réseau** — sans ce garde-fou, un import sur base vierge déclenchait un appel Yahoo réel et
  faisait passer `npm test` en flake (6 tests dépendaient de la réponse réseau).
- **Include in DCA (un clic)** : une ligne on-chain éligible se promeut en `BUY` via
  `POST /api/transactions/[id]/include-in-dca` (withAuth + ownership, validation
  `isOnchainAcquisition`, recalcule le portfolio). La ligne convertie garde `source='onchain'`,
  `transferType` et sa base de coût inférée ; la réconciliation on-chain n'y touche pas (elle ne
  force `TRANSFER` que si le montant/fees/transferType *driftent*). DCA reste **BUY-only** —
  explication assumée : un `TRANSFER_IN` n'est pas un achat prouvé. Bouton « Include in DCA »
  dans le menu de la ligne (desktop + mobile, `src/app/transactions/page.tsx`), affiché si
  `source === 'onchain'` et `original_total_amount > 0`.
- **Exclude from DCA (annulation)** : l'inverse symétrique — `POST /api/transactions/[id]/exclude-from-dca`
  remet `type → 'TRANSFER'` sur une ligne **déjà promue** (`type='BUY' && source='onchain' &&
  transferType='TRANSFER_IN' && originalTotalAmount > 0`, sinon 400, ownership 404). La base de
  coût est conservée (la ligne reste comptée dans « Total invested ») et le resync on-chain ne la
  re-promouvra pas. Menu « Exclude from DCA » affiché mutuellement exclusif avec « Include ».
- **Ajout groupé au DCA (sélection)** : `POST /api/transactions/bulk-include-in-dca` prend
  `{ ids: number[] }` (validation 400), ne traite que les lignes éligibles appartenant à
  l'utilisateur (`isOnchainAcquisition`), `updateMany` en `BUY`, un seul recalc, réponse
  `{ included, skipped, totalSelected }` (sémantique partielle, jamais d'échec global). Côté UI,
  bouton « Add to DCA » dans la barre d'actions groupées (désactivé si aucune sélection éligible),
  basé sur le mode `bulkActionMode` déjà existant.

Le backfill (`BitcoinPriceService.getOrFetchPriceForDate`) : quand une date de bloc précède
la fenêtre locale (~365 j), l'historique quotidien Yahoo survit à la demande (**une seule
fois par session**, `dailyHistoryBackfills`) puis la ligne est re-lue. `saveHistoricalData`
fait des `upsert` par date (non destructif). Si le backfill échoue, l'import retombe sur le
prix actuel et n'est jamais bloqué ; retomber sans prix écrit quand même la ligne avec une
base nulle (jamais perdre d'histoire réelle). Couvert par
`src/tests/bitcoin-price-service.test.ts`, `src/tests/api/portfolio-metrics.test.ts`,
`src/tests/api/include-in-dca.test.ts`, `src/tests/api/exclude-from-dca.test.ts` et
`src/tests/api/bulk-include-in-dca.test.ts`.

---

## 14. Série §14 (committée le 29/09/2026)

La série suivante est **committée** (`1b4c17f`, « fix: keep on-chain sync cursors per address »,
10 fichiers : curseurs par adresse, PATCH xpub, UI, tests ; inclut `tsconfig.json` et
`AGENTS.md`). La feature §13.5 (Total invested on-chain + backfill) est traitée séparément,
cf. §15. Le commit `47e769f` n'est pas réécrit.

1. **`OnchainPanel.syncAll`** (`src/components/OnchainPanel.tsx`) — teste désormais
   `!response.ok || !body.success` : `/api/onchain/sync` répond 200 avec `success: false` en
   cas d'échec partiel, le toast ne l'annonçait plus.
2. **Toast d'ajout** (`OnchainPanel.tsx`) — le POST déclenche déjà le premier sync
   serveur (`onchain/addresses/route.ts`), donc chaîner `syncOne(id)` ferait une double
   synchro. Le panneau affiche maintenant le `body.message` réel renvoyé par le POST au
   lieu du fixe « Syncing it now ».
3. **Remplacement d'xpub** (`src/app/api/onchain/addresses/[id]/route.ts`) — `buildDerivationLabel`
   extrait vers `address-derivation.ts` ; POST et PATCH partagent le même label. Le PATCH
   re-dérive la première adresse receive de la nouvelle clé (`deriveAddresses(…, 1, rowChain)`),
   met à jour `data.address` + `scriptType`, vide le curseur (`lastSyncedTxid` **et**
   `lastSyncedAddress`), et refuse la collision sur une adresse déjà suivie (409). La logique
   de rejet testnet/mainnet compare la clé à la `chain` immuable de la ligne (et non à une
   chaîne recalculée à partir de la clé, ce qui neutralisait le contrôle).
4. **Curseur par adresse** (`src/lib/onchain/onchain-sync-service.ts`) — la map `cursors`
   est keyée `${recordId}:${address}` : un curseur stocké n'est réutilisé que pour
   l'adresse qui l'a produit (`lastSyncedAddress` comparé au contexte), jamais sondé contre
   une autre adresse dérivée du même xpub (404 Esplora sûr). La persistance retient le
   curseur du plus haut `blockHeight` par record. Le stub Esplora des tests sert désormais
   un vrai 404 pour un txid étranger à l'adresse interrogée, comme le backend réel.
5. **Tests ajoutés** (353) : PATCH xpub (re-dérivation adresse+label, curseur vidé, rejet
   testnet, conflit 409), non-régression du label au POST, et scénario multi-adresses dans
   `onchain-sync-batch.test.ts` (un xpub dérive plusieurs receive/change, le curseur suit
   `getConfirmedTxsAfter` sans re-import ni re-lecture complète).

---

## 16. Série §13.5 complétée le 29/09/2026 : « Total invested » partout + Include in DCA

Cette série finalise la §13.5 (traitée « séparément » dans la §14). Elle part de `d543be3`
(calcul central du pool) et corrige le point de divergence : `portfolio-metrics` et
`analytics` ne sommaient que les `BUY` → « Total invested = 0 ». L'ensemble est couvert par
`src/tests/bitcoin-price-service.test.ts`, `src/tests/api/portfolio-metrics.test.ts` et
`src/tests/api/include-in-dca.test.ts`, et validé (`tsc`, `next lint`, `npm test` : 22 suites,
365 tests). La suite se poursuit en §17 (Exclude + ajout groupé).

1. **Helper partagé** (`src/lib/bitcoin-price-service.ts`) — `isOnchainAcquisition` /
   `AcquisitionCandidate` exporté ; `calculatePortfolioFromTransactions` refactoré dessus et
   toutes les routes consomment le même pool (§13.5).
2. **`/api/portfolio-metrics`** — ajoute `onchainAcquisitions` / `onchainInBtc` dans le pool,
   `totalBtcAcquired` comme dénominateur d'`averageBuyPrice`, et un **monthly breakdown**
   corrigé : bucket « buys » = `BUY` ou acquisition on-chain, bucket « sells » = `SELL` ou
   `TRANSFER_OUT` on-chain, transferts internes ignorés (avant, tout non-`BUY` était compté
   sell). *Le bucket « sells » ne contient plus que `SELL` depuis la fusion v0.8.0 (§18).* C'est l'unique source du widget Investment **et** de la page analytics
   (`?detailed=true`).
3. **`/api/analytics`** — aligné sur le même pool (route non consommée par l'UI). *Supprimée
   par upstream dans v0.8.0 (#231), suppression acceptée à la fusion (§18).*
4. **Backfill gagé** — `getOrFetchPriceForDate` ne tente `ensureDailyHistory()` que si
   `bitcoin_price_history` a au moins une ligne ; sinon `null` sans réseau. C'est ce qui a
   corrigé les 6 tests flakes de l'utilisateur (un import sur base de test vide partait en
   appel Yahoo réel).
5. **Include in DCA** — nouvelle route `POST /api/transactions/[id]/include-in-dca` +
   bouton dans le menu ligne (desktop + mobile) de `src/app/transactions/page.tsx`, critère
   d'affichage `source === 'onchain'` avec base de coût > 0 (§13.5).
6. **Tests** — pool service + backfill gagé + skip réseau (4), déterminisme du backfill restauré
   dans `bitcoin-price-service.test.ts` (fenêtre locale requise pour déclencher le fetch),
   portfolio-metrics routé réel (3 : investi, transfert manuel exclu, breakdown mensuel) et
   include-in-dca routé réel (3 : promotion, rejet 400, ownership 404).

---

## 17. Série §16 complétée le 29/09/2026 : Exclude from DCA + ajout groupé au DCA

Suite directe de la §16 : rend la promotion réversible et la banalise en groupé.
Validé (`tsc`, `next lint`, `npm test` : 25 suites, 380 tests).

1. **Exclude from DCA** — `POST /api/transactions/[id]/exclude-from-dca/route.ts` (nov.) : revert
   `type → 'TRANSFER'` pour rattraper une promo par erreur. Garde `type='BUY' && source='onchain'
   && transferType='TRANSFER_IN' && originalTotalAmount > 0` (400 sinon), ownership 404, base de
   coût conservée, la réconciliation on-chain ne la re-promouvra pas. Menu « Exclude from DCA »
   (desktop + mobile) mutuellement exclusif avec « Include » (`src/app/transactions/page.tsx`).
2. **Bulk include** — `POST /api/transactions/bulk-include-in-dca/route.ts` (nov.) : `{ ids }`
   filtre `isOnchainAcquisition` + ownership, `updateMany` en `BUY`, un seul recalc, réponse
   partielle `{ included, skipped, totalSelected }` (200 même si 0 éligible). Côté UI, bouton
   « Add to DCA » dans la barre d'actions groupées du mode sélection (désactivé si aucune
   sélection éligible), helper `eligibleSelectedForDca()`.
3. **Tests** — `exclude-from-dca.test.ts` (3 : revert base conservée, rejet 400, ownership 404)
   et `bulk-include-in-dca.test.ts` (4 : 2 incluses + 1 manuelle ignorée, 0 éligible, ids
   invalides 400, ownership ignoré).

---

## 18. Fusion de la v0.8.0 officielle (11/10/2026)

Branche `merge/upstream-v0.8.0`, commit de fusion `507633b` (`upstream/main` = `f7c63df`,
PR #247 de `wilqq-the/BTC-Tracker`). Base commune avec le fork : `bffd293`. Validé : `tsc`,
`next lint`, `npm test` (38 suites, 693 tests), `next build`, migration réelle sur une copie de
base, et test manuel de l'app par l'utilisateur.

### Récupéré de la v0.8.0
- **Sécurité (#231)** : middleware sur toutes les `/api`, `withAuth`/`withAdminAuth` partout,
  opérations serveur réservées à l'admin, wallets d'une transaction vérifiés par `userId`.
- **Mises à jour sûres (#246)** : sauvegarde avant migration, plus de `db push` destructif (§11).
- Nouveau design, mode BTC/sats, sauvegarde/restauration, imports Cash App / Revolut X, réceptions
  Strike, export avec wallets et tags, modes de frais des transferts (#168), images ARM natives.

### Conservé du fork
Portfolio par utilisateur (§13.1, upstream calcule toujours sans `userId`), module on-chain
(§13.2), « Total invested » on-chain (§13.5), Include / Exclude / Add to DCA (§16, §17), cartes
timing / régularité / bilan mensuel de l'analyse DCA.

### Décisions de fusion
| Conflit | Décision |
|---|---|
| Calcul du solde (`bitcoin-price-service`, `portfolio-metrics`) | Modes de frais appliqués partout via `transferHoldingsDelta` (§9.10). Upstream ignorait encore `TRANSFER_IN`/`TRANSFER_OUT` dans le total. |
| Envois on-chain | Écrits en `ON_TOP` ; migration de rattrapage `20261011000000` ; aucun solde ne bouge. |
| Bilan mensuel | Règle upstream (#225) : un transfert n'est jamais une vente. En plus : une réception on-chain valorisée compte une seule fois, comme achat. |
| `POST /api/bitcoin-price` | Admin seulement (upstream), mais recalcule le résumé de **chaque** utilisateur (`…ForAllUsers`) au lieu d'un résumé partagé. |
| `GET /api/bitcoin-price?endpoint=portfolio`, `/api/analytics` | Supprimés comme upstream (aucun consommateur). |
| `migrate.js` | Les trois migrations dans l'ordre : `20260928…onchain`, `20261009…transfer_fee_mode`, `20261011…backfill`. |
| Page Planning | Page upstream reprise ; nos cartes portées dans `components/planning/DCAAnalysisPanel.tsx`. |
| Page Transactions | Page upstream reprise ; badges on-chain et actions DCA réappliqués (menu de ligne commun desktop/mobile, barre d'actions groupées). |
| `package-lock.json` | Lockfile upstream + `@scure/bip32` / `@noble/hashes` (`npm install --package-lock-only`). |

### Durcissement ajouté pendant la fusion
- **Réglages `onchain` réservés à l'admin** (§2, règle 4). Avant, n'importe quel compte pouvait
  changer l'endpoint et donc recevoir les adresses de tous les utilisateurs.
- **Réglages on-chain appliqués à chaud** (§7) ; `start()` ne peut plus armer deux timers.
- **Panneau on-chain rafraîchi toutes les 30 s** quand l'onglet est visible (adresses + statut,
  jamais les réglages en cours d'édition) — commit `cc3d7d0`, juste avant la fusion.
- `isOnchainAcquisition` déplacé dans `src/lib/acquisition.ts` (§9.11).
- Encadré de confidentialité et badges on-chain passés sur les teintes du design (§6).
- Tests : routes on-chain et DCA ajoutées à la matrice d'auth, réglages on-chain 403/400,
  `onchain-fee-mode.test.ts` (10 tests : delta par type et mode, `classify`, cohérence service /
  route, bilan mensuel, scheduler à chaud et course au démarrage).

### Ce qui change pour l'utilisateur
- Un envoi on-chain n'apparaît plus comme une vente dans le bilan mensuel.
- Un non-admin voit l'onglet On-chain en lecture seule pour les réglages serveur.
- Activer l'on-chain ou changer l'intervalle ne demande plus de redémarrage.

---

## 15. Todo — prochaines étapes

1. **Fusionner `merge/upstream-v0.8.0` dans `main`** (PR), puis garder `upstream` comme remote
   pour les prochaines versions : `git fetch https://github.com/wilqq-the/BTC-Tracker.git main:refs/remotes/upstream/main`.
2. **Avertissements Tailwind** au build (`ease-[cubic-bezier(...)]` ambigu) : viennent d'upstream,
   sans effet visible ; à remonter upstream plutôt qu'à corriger ici.
3. **Réglages par utilisateur** (§9.3) : toujours globaux des deux côtés. Les sections serveur
   sont protégées, mais devise / display restent partagés.
4. **`lastSyncBlock`** : il reflète le tip au dernier sync réussi, mais un remplacement de clé le
   garde tel quel alors que le curseur est vidé — décider si on le réinitialise aussi dans le
   PATCH xpub (actuellement volontairement conservé : c'est une donnée de santé, pas une ancre).
5. **Étendre le test xpub au change** : ajouter un cas où le `gapLimit` croît et où l'adresse
   primaire reste stable.
6. **Templates `[84h/0h/0h]zpub…`** : la détection bracket n'est que documentée via le label
   « (bracketed export) » ; pas de test du non-déterminisme entre deux exports de la même clé.
