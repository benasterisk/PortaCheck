# CLAUDE.md — PortaCheck : vérificateur de portabilité SDA par appels mobiles pilotés (ADB)

> Instruction générale pour Claude Code : lis ce fichier en entier avant d'agir.
> Le développement est INTERDIT tant que la **Phase 0 (pré-vol interactif)** n'est pas
> terminée et validée par l'utilisateur dans le terminal. Toute l'interface, les
> messages et les rapports sont **en français**.

---

## 1. Contexte métier (à comprendre, pas à coder)

L'utilisateur est Responsable Téléphonie. Lors de migrations de sites vers une nouvelle
infrastructure Avaya, il fait porter des lots de 30 à 150 numéros SDA. Après chaque
portage, il doit appeler **chaque SDA depuis deux réseaux mobiles distincts** — SIM
Orange (opérateur de l'entreprise) et SIM Free (perso) — car un portage peut être
effectif en Orange→Orange tout en étant **mal routé sur les réseaux inter-opérateurs**.

Le verdict est **humain et auditif** : l'utilisateur écoute l'annonce diffusée dans son
casque (l'audio transite par Lien Mobile / Bluetooth Windows — **hors périmètre de
cette application**) et reconnaît si l'appel aboutit sur la **nouvelle** infrastructure
(verdict OK) ou sur l'**ancienne** / en échec (verdict NOK). Les codes réseau ne
suffisent pas : un appel peut « aboutir » techniquement sur la mauvaise infra.

L'application automatise tout le reste : numérotation séquentielle via ADB, choix de la
SIM, saisie rapide des verdicts, reprise de session, et **rapport comparatif** entre les
passes des deux opérateurs.

Matériel : **un seul téléphone**, Samsung Galaxy A25 5G (SM-A256B/DSN), double SIM
(slot 1 / slot 2, mapping opérateurs à confirmer en Phase 0), relié au PC Windows en
USB. Dual-SIM **Dual Standby** : un seul appel actif à la fois — le fonctionnement est
de toute façon strictement séquentiel.

---

## 2. Environnement cible

- PC Windows 10/11, shell **PowerShell**.
- ADB : SDK platform-tools. Chemin par défaut `C:\platform-tools\adb.exe`,
  **configurable** dans `config.json`. Si absent, guider l'installation
  (https://developer.android.com/tools/releases/platform-tools) avant de continuer.
- Téléphone en USB, débogage USB autorisé (empreinte PC acceptée). L'ADB Wi-Fi pourra
  être utilisé plus tard mais la mise au point se fait en USB.
- Aucune gestion audio dans l'application. Aucun autre matériel.

---

## 3. PHASE 0 — Pré-vol interactif dans le terminal (OBLIGATOIRE avant tout code)

Dérouler ce protocole **étape par étape dans le chat**, en exécutant les commandes, en
montrant les sorties brutes à l'utilisateur et en lui posant les questions indiquées.
Sauvegarder chaque sortie brute dans `samples/phase0/` (elles serviront de fixtures de
tests pour les parseurs). Ne passer en Phase 1 qu'après un **GO explicite**.

| # | Vérification | Commande | Critère / action |
|---|--------------|----------|------------------|
| 0.1 | ADB présent | `adb version` | Sinon : guider téléchargement platform-tools + PATH |
| 0.2 | Appareil visible | `adb devices -l` | État `device` attendu. Si `unauthorized` : faire accepter la popup sur le téléphone. Noter le **serial**. |
| 0.3 | Inventaire SIM | `adb shell dumpsys isub` | Extraire par SIM active : `subId`, `slotIndex`, `carrierName`/`displayName`. **Demander à l'utilisateur de confirmer** quel opérateur est dans quel slot. |
| 0.4 | État réseau | `adb shell dumpsys telephony.registry` | Relever `mServiceState` par phoneId (IN_SERVICE ?) et `mCallState`. |
| 0.5 | SIM voix par défaut | `adb shell settings get global multi_sim_voice_call` | Noter la valeur (subId attendu, possiblement `null` ou `-1`). |
| 0.6 | **Méthode A** : bascule SIM | `adb shell settings put global multi_sim_voice_call <subId>` puis relire (0.5) | Demander à l'utilisateur de vérifier dans Paramètres > Gestionnaire SIM que la SIM d'appel par défaut a changé. Si concluant dans les deux sens : **méthode A validée**. |
| 0.7 | **Méthode B** (facultative) : choix par appel | `adb shell am start -a android.intent.action.CALL -d tel:<numero_test> --ei simSlot 1` (puis variante `--ei com.android.phone.extra.slot 1`) | Demander un numéro de test à l'utilisateur (son fixe). Vérifier quelle SIM a réellement composé. Les One UI récentes ignorent souvent ces extras : ne pas insister, consigner le résultat. |
| 0.8 | Appel + raccroché | `adb shell am start -a android.intent.action.CALL -d tel:<numero_test>` puis `adb shell input keyevent KEYCODE_ENDCALL` | L'appel doit partir et se raccrocher. Pendant l'appel, vérifier `mCallState=2` (OFFHOOK) via 0.4, puis `0` après raccroché. |
| 0.9 | Écran verrouillé | Verrouiller le téléphone, refaire 0.8 | Si la composition échoue écran verrouillé : prévoir en début de passe `adb shell input keyevent KEYCODE_WAKEUP` + `adb shell svc power stayon usb` (et `svc power stayon false` en fin de passe), et noter qu'un déverrouillage initial est requis. |
| 0.10 | Format de numéro | Tester 0.8 en `tel:+33XXXXXXXXX` **et** en `tel:0XXXXXXXXX` | Consigner le(s) format(s) qui compose(nt) correctement. |

**Sortie de phase** : créer `device_profile.json` :

```json
{
  "serial": "...",
  "sims": [
    {"slot": 0, "subId": 1, "operator": "Orange", "label": "Pro"},
    {"slot": 1, "subId": 2, "operator": "Free", "label": "Perso"}
  ],
  "sim_switch_method": "A",          // "A" | "B" | "manual"
  "dial_format": "e164",             // "e164" | "national"
  "call_intent_locked_screen": true, // résultat 0.9
  "keep_screen_on_during_run": false,
  "notes": "…"
}
```

Résumer le profil à l'utilisateur et demander : **« GO pour le développement ? »**

**Règle fondamentale dès la Phase 0** : si une seule SIM est détectée ou joignable,
le signaler, le consigner dans le profil, et **continuer** — l'application doit être
pleinement fonctionnelle en mono-SIM. Une SIM injoignable ne bloque jamais l'autre.

---

## 4. Architecture imposée

- **Backend** : Python 3.11+, **FastAPI + uvicorn**, port local 8765.
  - Module `adb_service.py` : wrapper `subprocess` autour de `adb.exe`
    (`[adb_path, "-s", serial, ...]`), timeout 10 s (30 s pour `dumpsys`),
    capture stdout/stderr, **journalisation intégrale** dans `logs/adb.log`
    (horodatage, commande, code retour, sortie tronquée à 2 000 caractères).
    Aucune bibliothèque ADB tierce : uniquement subprocess.
  - Module `adb_parsers.py` : parsing de `dumpsys isub` et
    `dumpsys telephony.registry`, **testé unitairement** sur les fixtures de
    `samples/phase0/` (le parsing de dumpsys est fragile, il doit être isolé).
  - **WebSocket** `/ws/state` : pousse toutes les secondes l'état téléphone
    (device connecté ?, état réseau par SIM, `mCallState`, chrono d'appel).
- **Base** : SQLite, fichier `portacheck.db` (stdlib `sqlite3` ou SQLAlchemy, au choix).
- **Frontend** : **React 18 + Vite + Tailwind CSS**. Thème sombre par défaut
  (commutable). Design sobre et dense, façon console d'exploitation. Build de
  production servi en statique par FastAPI ; proxy Vite en dev.
- **Lancement** : `start.ps1` → vérifie l'environnement, lance uvicorn, ouvre
  `http://localhost:8765` dans le navigateur. Prévoir aussi `dev.ps1`.
- **Interdits** : Electron, localStorage pour les données métier (tout en SQLite),
  appels réseau externes (tout est local).

---

## 5. Modèle de données (SQLite)

```sql
campaigns(id, name, notes, created_at)
numbers(id, campaign_id, raw, e164, national, label, ord)         -- label = site/commentaire d'import, facultatif
runs(id, campaign_id, sim_subid, sim_operator, sim_slot,
     started_at, finished_at, status)                              -- status: en_cours | terminee | interrompue
calls(id, run_id, number_id, attempt, dialed_at, ended_at,
      duration_s, verdict, comment)                                -- verdict: OK | NOK | SKIP | NULL
```

- Reprise de session = premier `number` du run sans verdict (ordre `ord`).
- `attempt` s'incrémente en cas de « Recomposer » ; le verdict porte sur la dernière tentative.

---

## 6. Fonctionnalités

### 6.1 Import du listing
- Deux modes : **upload CSV/TXT** ou **collage brut** dans un textarea.
- Formats tolérés par ligne : `numéro` seul, ou `numéro;libellé` (séparateurs `;` `,` ou tabulation).
- Normalisation : supprimer espaces/points/tirets/parenthèses ; accepter `0X…`,
  `+33X…`, `0033X…` ; stocker E.164 (`+33XXXXXXXXX`) **et** format national
  (`0XXXXXXXXX`) ; rejeter avec message clair ce qui n'est pas un numéro FR à 10
  chiffres (ou E.164 valide).
- Dédoublonnage (sur E.164) avec compte rendu ; **écran de prévisualisation** avant
  validation (total, doublons retirés, rejets listés).

### 6.2 Tableau de bord SIM
- Une carte par SIM : opérateur, slot, subId, état réseau (EN SERVICE / HORS SERVICE /
  ABSENTE), rafraîchie via le WebSocket.
- SIM injoignable → carte grisée + badge « injoignable », **mais l'autre SIM reste
  pleinement utilisable**. Bandeau global si le téléphone est déconnecté.
- Bouton « Réactualiser l'inventaire SIM » (relance dumpsys isub).

### 6.3 Lancement d'une passe
- Sélection : campagne + SIM (uniquement parmi les joignables ; en mono-SIM, la seule
  disponible est présélectionnée).
- Avant démarrage, selon `sim_switch_method` du profil :
  - **A** : `settings put global multi_sim_voice_call <subId>` → relecture de contrôle
    → si la relecture ne confirme pas, basculer en mode **manual** : afficher
    « Basculez manuellement la SIM d'appel par défaut sur <opérateur>
    (Paramètres > Gestionnaire SIM > Appels), puis confirmez » avec bouton de
    confirmation. **Ne jamais bloquer.**
  - **B** : passer l'extra validé en Phase 0 à chaque composition.
  - **manual** : afficher directement la consigne + confirmation.
- Message de confirmation final avant le premier appel :
  « SIM voix active : **Free (slot 2)** — démarrer la passe (N numéros) ? »

### 6.4 Écran de passe — le cockpit (cœur de l'application)
- Affichage **très gros** du numéro courant (format national) + libellé + progression
  `n / N` + opérateur de la passe + chrono d'appel + état réel de l'appel
  (INACTIF / EN COURS via `mCallState`).
- Boutons : **Composer**, **Raccrocher**, **OK**, **NOK**, **Passer**, **Recomposer** ;
  champ **commentaire** (facultatif, enregistré avec le verdict).
- **Raccourcis clavier** (l'utilisateur travaille au casque, mains sur le clavier) :
  `Espace` Composer · `O` OK · `N` NOK · `S` Passer · `R` Recomposer ·
  `C` focus commentaire · `Échap` Raccrocher. Les raccourcis sont inactifs quand le
  focus est dans le champ commentaire (sauf `Échap`).
- Enchaînement après verdict : raccrocher si l'appel est encore actif → enregistrer →
  délai configurable (défaut **2 s**, min 1 s) → afficher le numéro suivant.
- **Mode auto** (désactivé par défaut) : compose automatiquement le suivant après le
  délai. Activation explicite par interrupteur + confirmation. En mode manuel, chaque
  composition exige `Espace` ou clic.
- **STOP** : interrompt proprement la passe (status `interrompue`), reprise possible
  depuis la liste des passes (reprend au premier numéro sans verdict).
- Si le téléphone se déconnecte en cours de passe : pause automatique, bandeau
  d'alerte, reprise quand il revient. Aucun verdict perdu (persistance immédiate).

### 6.5 Rapport comparatif
- Vue croisée par numéro : une colonne par run (opérateur + date), avec verdict,
  durée, commentaire.
- **Classification automatique** par numéro :
  - OK + OK → **Conforme**
  - OK (Orange) + NOK (Free) — ou l'inverse → **⚠ Routage inter-opérateurs suspect**
  - NOK + NOK → **✖ Portage KO**
  - Verdict sur une seule passe → **Partiel** (cas mono-SIM ou passe non faite)
  - SKIP → **Non testé** sur cette passe
- Compteurs de synthèse par catégorie + filtres (catégorie, verdict, texte).
- **Exports** : CSV (UTF-8, `;`) et **XLSX** (openpyxl) — nommage
  `rapport_<campagne>_<AAAAMMJJ-HHMM>.xlsx`, une ligne par numéro, colonnes :
  numéro (national), E.164, libellé, puis par run : opérateur, date, verdict, durée,
  commentaire, et enfin la classification.
- Le rapport reste **cohérent et exploitable avec une seule passe**.

### 6.6 Journal
- Page « Journal » : dernières commandes ADB (horodatage, commande, code retour,
  extrait de sortie), erreurs en évidence. Lien vers `logs/adb.log`.

---

## 7. Détails d'implémentation ADB

- Composer : `am start -a android.intent.action.CALL -d "tel:<numero>"` — format
  (`+33…` ou `0…`) selon `dial_format` du profil.
- Raccrocher : `input keyevent KEYCODE_ENDCALL`.
- État d'appel : `dumpsys telephony.registry` → `mCallState`
  (0 = IDLE, 1 = RINGING, 2 = OFFHOOK). Polling 1 s pendant un appel, 3 s au repos.
- État SIM/réseau : croiser `dumpsys isub` (inventaire) et
  `dumpsys telephony.registry` (`mServiceState` par phoneId).
- Réveil / maintien écran (si requis par le profil) : `input keyevent KEYCODE_WAKEUP`,
  `svc power stayon usb` en début de passe, `svc power stayon false` en fin.
- Toute commande passe par `adb_service.py` (timeout, log, gestion des erreurs
  `device offline` / `unauthorized` / adb absent → messages UI explicites en français).

---

## 8. Garde-fous (non négociables)

1. **Jamais de composition sans action utilisateur explicite**, sauf mode auto
   explicitement armé pour la passe en cours.
2. Délai minimal de 1 s entre un raccroché et la composition suivante (défaut 2 s).
3. Une SIM injoignable, absente ou en échec de bascule **n'empêche jamais** une passe
   sur l'autre SIM.
4. Persistance immédiate de chaque verdict (aucune perte en cas de crash/déconnexion).
5. Tout reste en local : aucun appel réseau sortant, aucun numéro transmis à
   l'extérieur, pas de télémétrie.
6. Ne jamais stocker de secret. `config.json` ne contient que des chemins/ports.

---

## 9. Critères d'acceptation

- [ ] Phase 0 déroulée dans le chat, sorties sauvegardées dans `samples/phase0/`,
      `device_profile.json` créé et validé par l'utilisateur.
- [ ] Import par fichier **et** par collage ; normalisation, dédoublonnage,
      prévisualisation, rejets expliqués.
- [ ] Bascule de SIM opérationnelle selon la méthode du profil, avec repli « manual »
      jamais bloquant.
- [ ] SIM injoignable visible (carte grisée) et **non bloquante** pour l'autre.
- [ ] Une passe complète est réalisable **au clavier seul**.
- [ ] État d'appel réel affiché (mCallState) + chrono.
- [ ] STOP / reprise de passe au premier numéro sans verdict.
- [ ] Rapport croisé avec classification automatique, filtres, exports CSV et XLSX,
      y compris en mono-passe.
- [ ] Journal ADB consultable dans l'UI ; `logs/adb.log` complet.
- [ ] `start.ps1` lance le serveur et ouvre le navigateur sans manipulation.
- [ ] Tests unitaires des parseurs dumpsys sur les fixtures de Phase 0.

---

## 10. Phase finale — Recette guidée dans le terminal

Une fois les critères cochés, dérouler avec l'utilisateur :
1. Import d'une mini-liste de 3 numéros réels fournis par lui.
2. Passe SIM 1 complète (verdicts au clavier), puis passe SIM 2
   (ou constat mono-SIM proprement géré).
3. Génération du rapport, vérification de la classification, exports CSV + XLSX
   ouverts et contrôlés.
4. Corriger jusqu'à validation explicite de l'utilisateur.

## 11. Hors périmètre (v1)

- Capture ou enregistrement audio des appels (piste v2 : trace opposable pour les
  litiges de routage inter-opérateurs).
- ADB Wi-Fi automatisé (utilisable manuellement, non géré par l'UI).
- Pilotage d'un iPhone.
- Détection automatique du verdict (analyse d'annonce) — le verdict reste humain.
