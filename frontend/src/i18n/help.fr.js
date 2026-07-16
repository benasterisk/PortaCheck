// Contenu d'aide structuré — français.

export const helpFr = {
  title: 'PortaCheck — Guide utilisateur',
  intro:
    "Un outil local pour vérifier la portabilité des numéros (SDA / DID) après une migration, en passant des appels de test pilotés via ADB depuis un téléphone Android, avec un verdict humain à l'oreille et un rapport comparatif inter-opérateurs.",
  sections: [
    {
      title: "Ce que fait cet outil",
      blocks: [
        { type: 'p', text: "Après le portage d'un lot de numéros, chacun doit être appelé depuis deux réseaux mobiles différents (ex. Orange et Free) pour confirmer qu'il aboutit sur la nouvelle infrastructure — un portage peut fonctionner entre un même opérateur tout en étant mal routé d'un opérateur à l'autre." },
        { type: 'p', text: "Vous écoutez l'annonce dans votre casque et décidez **OK** (aboutit sur la nouvelle infrastructure) ou **NOK** (ancienne infrastructure / échec). L'application automatise tout le reste : numérotation séquentielle via ADB, saisie des verdicts au clavier, reprise de session, et un rapport comparatif entre les passes des deux opérateurs. Le verdict reste humain — l'application ne le décide jamais à votre place." },
        { type: 'note', text: "L'audio (casque Bluetooth, « Lien avec Windows », etc.) est hors périmètre : l'application ne pilote que la numérotation ; l'écoute vous revient." },
      ],
    },
    {
      title: "Prérequis",
      blocks: [
        { type: 'ul', items: [
          'Un PC Windows 10/11.',
          "Un **téléphone Android** connecté en USB, avec le **débogage USB activé** et le PC autorisé. (Un iPhone ne peut pas être piloté ainsi — iOS n'a pas d'équivalent ADB.)",
          "**ADB / platform-tools** disponible. Avec le `PortaCheck.exe` autonome, adb est déjà inclus — rien à installer. Sinon le chemin par défaut est `C:\\platform-tools\\adb.exe`, configurable dans `config.json`.",
          "**Python 3.11+** et **Node.js** — uniquement pour les développeurs qui construisent depuis les sources, pas pour l'exe packagé.",
        ] },
        { type: 'note', text: "Un seul téléphone suffit. Pour une vérification complète, il faut deux SIM (deux opérateurs) — insérez-en une, faites une passe, changez de SIM, faites la seconde passe. L'application est aussi pleinement utilisable avec une seule SIM." },
      ],
    },
    {
      title: "Installation & lancement",
      blocks: [
        { type: 'steps', items: [
          "Le plus simple : double-cliquez sur **PortaCheck.exe** — rien à installer (Python, dépendances, interface et adb sont tous inclus).",
          "Une fenêtre console s'ouvre (le serveur). **Laissez-la ouverte** pendant l'utilisation — la fermer arrête le serveur.",
          "Votre navigateur s'ouvre automatiquement sur `http://localhost:8765`. Sinon, ouvrez cette adresse manuellement.",
        ] },
        { type: 'note', text: "Tout s'exécute localement sur votre machine — aucune donnée ne quitte le PC, aucun appel réseau externe, aucune télémétrie." },
      ],
    },
    {
      title: "Utilisation pas à pas",
      blocks: [
        { type: 'steps', items: [
          "**Créez une campagne** (ex. « Migration Site Lyon ») sur la page Campagnes.",
          "**Importez vos numéros.** Chargez un fichier **Excel (.xlsx)** ou CSV/TXT, ou collez-les. L'application détecte les colonnes et vous laisse choisir celle du numéro et celle du libellé ; cliquez **Prévisualiser** pour vérifier les comptes, puis **Importer**. Toutes les colonnes du fichier sont conservées et affichées pendant la passe. Les fichiers sans ligne d'en-tête sont gérés.",
          "**Lancez une passe.** Choisissez la SIM/opérateur (seules les SIM joignables sont proposées ; en mono-SIM elle est présélectionnée), confirmez, et entrez dans le cockpit.",
          "**Travaillez dans le cockpit** (voir les raccourcis clavier ci-dessous). Appelez le numéro, écoutez, donnez un verdict. Toutes les colonnes du fichier sont affichées pour le contexte. Les commentaires sont horodatés et ajoutés à la suite.",
          "**Faites la seconde passe** avec l'autre SIM (insérez-la, cliquez « Réactualiser l'inventaire SIM »), puis recommencez.",
          "**Ouvrez le rapport.** Une vue croisée par numéro avec la classification automatique, des filtres, et l'export CSV / XLSX.",
        ] },
      ],
    },
    {
      title: "Le cockpit (écran d'appel)",
      blocks: [
        { type: 'p', text: "Le cœur de l'outil, conçu pour être piloté entièrement au clavier :" },
        { type: 'shortcuts', items: [
          { keys: ['Espace'], label: 'Composer le numéro courant' },
          { keys: ['Échap'], label: 'Raccrocher' },
          { keys: ['O'], label: 'Verdict OK' },
          { keys: ['N'], label: 'Verdict NOK' },
          { keys: ['S'], label: 'Passer' },
          { keys: ['R'], label: 'Recomposer' },
          { keys: ['C'], label: 'Aller au champ commentaire' },
          { keys: ['←', '→'], label: 'Naviguer entre les fiches' },
        ] },
        { type: 'ul', items: [
          "**Navigation libre** — les flèches déplacent sur n'importe quel numéro du fichier, pas seulement le prochain non traité. Vous pouvez revenir corriger un verdict, ajouter une note, ou rappeler.",
          "**Correction** — sur une fiche déjà traitée, un nouveau verdict remplace l'ancien, tandis que le commentaire est ajouté (horodaté) pour conserver l'historique.",
          "**État d'appel en direct** — INACTIF / SONNERIE / EN COMMUNICATION est affiché depuis le téléphone, avec un chrono d'appel.",
          "**Commentaires fréquents** — vos commentaires passés apparaissent en tuiles cliquables et dans une liste déroulante du champ commentaire, pour standardiser la classification.",
          "**Mode auto** (désactivé par défaut) — après l'avoir armé explicitement, le numéro suivant est composé automatiquement après le délai. En mode manuel, chaque composition nécessite Espace ou un clic.",
          "**STOP** met la passe en pause proprement ; vous pouvez reprendre plus tard — elle repart au premier numéro sans verdict. Aucun verdict n'est jamais perdu.",
          "**Tous les numéros traités** — un bandeau vert apparaît ; cliquez « Terminer + rapport » pour clôturer la passe et ouvrir le rapport.",
        ] },
      ],
    },
    {
      title: "Le rapport comparatif",
      blocks: [
        { type: 'p', text: "Classification automatique par numéro, sur les passes de la campagne :" },
        { type: 'legend', items: [
          { badge: 'emerald', title: 'Conforme', text: 'OK + OK — route correctement sur les deux opérateurs.' },
          { badge: 'amber', title: '⚠ Routage inter-opérateurs suspect', text: 'OK d\'un côté, NOK de l\'autre — le cas clé à surveiller.' },
          { badge: 'rose', title: '✖ Portage KO', text: 'NOK + NOK — le portage a échoué.' },
          { badge: 'slate', title: 'Partiel', text: 'une seule passe faite (mono-SIM, ou seconde passe pas encore réalisée).' },
          { badge: 'slatedim', title: 'Non testé', text: 'passé sur cette passe.' },
        ] },
        { type: 'p', text: "Filtrez par catégorie / verdict / texte, et exportez en **CSV** ou **XLSX**. Le rapport reste cohérent et exploitable même avec une seule passe." },
      ],
    },
    {
      title: "Dépannage",
      blocks: [
        { type: 'ul', items: [
          "**Bandeau « Téléphone déconnecté »** — vérifiez le câble USB et que le débogage USB est autorisé sur le téléphone. Si cela persiste, débranchez/rebranchez, ou lancez `adb kill-server` puis relancez.",
          "**Aucune SIM affichée** — réveillez/déverrouillez le téléphone, puis cliquez « Réactualiser l'inventaire SIM » sur le tableau de bord SIM. Une SIM retirée n'apparaîtra simplement pas (le mode mono-SIM est normal).",
          "**L'écran d'appel reste masqué sous l'écran verrouillé** — le téléphone a un verrou sécurisé. L'application garde l'écran allumé pendant une passe ; déverrouillez-le une fois au début de la passe.",
          "**Historique des commandes ADB** — la page « Journal ADB » liste les dernières commandes ADB avec leurs codes retour ; le journal complet est dans `logs/adb.log`.",
        ] },
      ],
    },
    {
      title: "Garanties de sécurité",
      blocks: [
        { type: 'ul', items: [
          "Ne compose jamais sans action explicite (sauf mode auto armé pour la passe en cours).",
          "Minimum 1 s entre un raccroché et la composition suivante (défaut 2 s), imposé aussi côté serveur.",
          "Une SIM injoignable ne bloque jamais l'autre — le mono-SIM est pleinement supporté.",
          "Chaque verdict est persisté immédiatement — rien n'est perdu en cas de plantage ou de déconnexion.",
          "Tout est local : aucun appel réseau sortant, aucun numéro envoyé à l'extérieur, aucune télémétrie.",
        ] },
      ],
    },
  ],
  footer: "PortaCheck — application locale · vos données ne quittent jamais ce PC",
}
