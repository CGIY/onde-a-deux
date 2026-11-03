# Dés·ir — passage de relais à Codex

## Révélation D4 et curation stricte — 3 novembre 2026 (prioritaire)

- D4 : résultat confirmé → fin du lancer → défloutage de la tuile choisie (380 ms) → pause de lecture de 1 100 ms → fiche d’invitation. Même parcours en relance, ancienne carte lisible et exclue. Présentation transitoire locale uniquement ; aucune phase ou règle serveur ajoutée. Annulations et perte de session couvertes par les tests.
- Statistiques : le nouveau prompt remplace les repères de proximité thématique. **48 cartes sourcées, 67 variantes ; 40 absences documentées**. Deux cartes ont trois variantes, quinze en ont deux, trente et une en ont une. Ne pas restaurer les anciens chiffres pour remplir les manques.
- `data/card-evidence.json` contient `activeEvidence` (1–3 variantes, principale aplatie) et `unavailableEvidence` (raison, sources consultées). Liste autorisée stricte, y compris pour les anciennes sauvegardes. Rotation stable selon la manche partagée. `data/card-evidence-audit.json` documente les exclusions.
- Le générateur produit `statistiques.json` depuis les mêmes données et copie `src/onde-statistics-review.html` vers `statistiques.html`, dans l’aperçu et la publication. Cette page de choix reste hors de la navigation du jeu. Coches locales + export JSON, aucune écriture dans la partie.
- Validation avant toute écriture : 88 cartes couvertes par données ou absences, source HTTPS, pourcentage 0–100 et valeur identiques, angles distincts, déduplication globale source/chiffre et mesure. Les couvertures partielles ne sont pas étiquetées complètes.
- Une seule phrase statistique sur la carte ; source dépliable ; aucune case vide ou texte « INTROUVABLE » dans le jeu. Le relevé conserve les manques et limites de marque/durée/budget.
- Vérifications : 8 tests de construction, contrôle des repères, 329 contrôles UI, 28 contrôles de la page de sélection, contrôles visuels mobiles et révélation chronométrée. Détails : [AUDIT_STATISTIQUES.md](AUDIT_STATISTIQUES.md). Pas d’essai physique iPhone. Aucun compte, tirage réel ou score touché. Xcode/ZIP toujours en pause.

## Ergonomie mobile — 3 novembre 2026 (prioritaire)

- Cibles initiales : **iPhone 17 Pro et iPhone 16 Pro Max**. Plein écran mobile : coquille bornée par le viewport, aucun défilement de la page ; `main` seul défile, navigation hors de cette zone et toujours accessible après connexion. Introduction et connexion conservent leur parcours propre avant les onglets.
- `viewport-fit=cover`, insets haut/bas et latéraux ; hauteur `visualViewport` à zoom normal avec repli `100dvh`, pour le clavier et les barres Safari. Zoom conservé. Portrait et paysage étroit pris en charge.
- **Ne pas réduire le dé pour faire tenir le contenu.** Demande explicite de l’utilisateur après un premier essai trop petit : D6 avec scène 272–320 px, D4/D20 au moins 238 px. Les catégories deviennent six bandeaux informatifs compacts ; titre introductif du D6 masqué visuellement mais conservé sémantiquement. Identités, marges et jauge resserrées ; cibles de navigation 48 px et aide 44 px.
- Actions de carte ancrées dans main quand nécessaire ; Proposer sur toute la largeur, D20 et relance côte à côte. Aucun texte/statistique tronqué. Attente de relance sous forme de ligne d’état, pas de faux bouton désactivé. Quatre emplacements et ancienne carte exclue conservés. Les actions ancrées apparaissent en fondu sans translation sous le menu.
- Nouvelle vue : retour en haut de main. Mise à jour de fond : position, source ouverte et focus conservés. Modale : main verrouillé puis restauré sans saut.
- Vérification : 269 contrôles UI, 211 observations navigateur de cadres mesurés, dont 196 en portrait aux quatre configurations, 14 en paysage et une connexion à hauteur clavier. Aucun tirage réel consommé. Voir [AUDIT_MOBILE.md](AUDIT_MOBILE.md) pour le périmètre et les limites. Aucun essai physique iPhone effectué.

## État courant — essai web connecté, 2 novembre 2026

Cette section remplace les consignes historiques qui suivent lorsqu’elles divergent. Le nom visible est **Dés·ir**. L’utilisateur a mis Xcode de côté pour tester l’application web sur deux téléphones pendant quelques semaines, avec Supabase et GitHub Pages.

- Deux comptes précréés : connexion par identifiant et mot de passe, sans inscription ni code d’association. Noms et empreintes de mot de passe dans la base privée uniquement ; aucun identifiant personnel dans les sources publiques. Le navigateur conserve un jeton d’appareil, jamais le mot de passe.
- Chaque compte reste dans son propre monde ; changer de profil est réservé à la démo locale. Avant l’envoi, le serveur filtre le tirage et son historique privé. L’invitation reste disponible jusqu’à la réponse.
- Serveur autoritaire : identité issue du jeton, hasard et horodatages côté serveur, révisions monotones, requêtes d’action idempotentes. Pas de partie locale de secours lorsqu’une connexion échoue.
- Un D6 puis D4 par compte et par plage **Europe/Paris : 6–12 h, 12–18 h, 18–6 h**. Le D6 réussi consomme seul le ticket ; D4 et D20 restent utilisables ensuite. La disponibilité suivante apparaît seulement sur l’écran D6 après consommation. Aucune table de quotas ou de probabilités dans l’aide `?`.
- Une seule manche active ; les rôles alternent. Les tâches validées restent six heures et les deux coches valent exactement un point commun. Le service tranche les expirations. Passer/Plus tard/Adapter et le catalogue ne sont pas affichés.
- Notifications activées volontairement dans **Nous**, jamais au chargement. Sur iOS/iPadOS 16.4+, ajout à l’écran d’accueil requis. Le service worker ne cache que les ressources publiques ; les notifications ne révèlent aucun titre de carte.
- L’intégration distante se trouve dans `src/onde-app-remote.js`, avant l’interface. Les animations de dé attendent la face confirmée par le serveur ; les mises à jour concurrentes sont différées pendant leur déroulement. Une coche attend la confirmation serveur avant la vague.
- Accueil initial demandé ensuite : trois phrases et un bouton « C’est parti », affiché une fois par appareil avec la clé locale `desir-welcome-v1`. La restauration de session ne doit pas le remplacer avant fermeture. Les icônes iPhone/PWA sont intégrées et leurs fichiers publiés ont été contrôlés.
- Finition visuelle suivante : score corail grisé, accents corail désaturés et grain statique renforcé sur les panneaux ; chiffre résultat blanc ivoire avec reflet à l’arrêt sur les trois dés et le rendu de secours. Géométrie et ombres inchangées. La relance D4 a ensuite été acceptée et activée : une seule fois avant l’envoi et avant le D20 initiateur, autre carte garantie, D20 initiateur supprimé pour cette carte, D20 destinataire conservé, aucun point retiré ni ticket supplémentaire.
- Grades dans Nous : un seul grade atteint visible, remplacé au palier suivant. Paliers 5/8/10/12/15/20/25/30/35/40/45/50 ; noms dans `gradeLevels`. Avant 5 : aucun badge obtenu, seulement une progression discrète. Aucun nom futur dans le DOM. Déblocage depuis `stats.totalCompleted`, partagé et cumulé ; transition une fois au franchissement, jamais au poll ou à la restauration. Aucun stockage de grade supplémentaire. Le grade utilise un bleu ardoise désaturé, distinct du score commun corail.
- Charge visuelle : maximum atteint après **1 200 ms**, **deux à cinq tours** et animation bornée entre **1 650 et 2 500 ms**. Appui court ou maintien, Espace au clavier, Entrée pour le clic natif ; scroll, annulation et perte de focus ne lancent rien. La puissance ne rejoint jamais l’API et ne modifie aucune règle. Le D6 initial est incliné et montre trois faces.
- Audit et corrections UI : [AUDIT_UI_DA.md](AUDIT_UI_DA.md), avec mesures avant/après, matrice des états et séparation des défauts objectifs et des préférences. Les textes de carte reposent sur une surface plus sombre, les champs ont un bord lisible, les actions montrent leur attente, les toasts restent dans le viewport et les sources ont une cible de 44 px. La structure de l’application et son cadre sont conservés.
- Relance : `round.cardRerolled` booléen, `G.canRerollCard`, action `REROLL_CARD` côté moteur/transport/serveur. Tirage uniforme parmi trois autres faces ; même reçu en cas de reprise réseau. Le D4 reste affiché jusqu’à la fin de l’animation, avant la révélation. Migration des anciens rounds/historiques par normalisation, aucune réinitialisation de partie.

Construction depuis la racine :

```sh
python3 demo-des/dev/build.py              # aperçu local sans comptes, dans dev/dist
python3 demo-des/dev/build.py --connected  # aperçu avec service distant
python3 demo-des/dev/build.py --release    # publication web connectée uniquement
python3 demo-des/dev/tests/onde-build-check.py
node demo-des/dev/tests/onde-remote-check.cjs
node demo-des/dev/tests/onde-remote-ui-check.cjs
node demo-des/dev/tests/onde-visibility-check.cjs
node demo-des/dev/tests/onde-reroll-check.cjs
node demo-des/server/tests/backend-check.mjs
```

`config.js` ne contient que `endpoint` et `publishableKey`, incorporés au HTML connecté. S’il est absent ou invalide, le build connecté échoue avant d’écrire les livrables. Le build copie le moteur canonique vers `server/functions/desir-game/core.js`. Configuration du service, contrôles de concurrence et notifications : voir `../server/README.md`.

**Xcode et ZIP : archive build 7 conservée à l’identique depuis `325eba7`.** Ne plus synchroniser l’HTML web connecté dans l’archive ni régénérer le ZIP pendant cet essai. Les publications web ne reconstruisent plus Xcode. Les mesures sur matériel physique et la livraison de notifications sur les deux téléphones restent à vérifier ; les tests automatisés ne les remplacent pas.

### Publication et vérification du service

Version connectée publiée sur `main` et `codex/onde-v030-handoff`. Projet Supabase distinct à Paris, fonction `desir-game` version 3, quatre migrations présentes dans `server/migrations/`. L'ancien projet `onde-a-deux` a été mis en pause pour libérer l'emplacement gratuit, sans suppression de ses données.

- 48 vérifications HTTP sur le service hébergé : deux connexions, tirages privés, résultats serveur, rejeu idempotent, deux coches et point unique, quotas et contrôle des accès.
- Contrôles locaux : 374 assertions D20, 43 score, 61 règles, 89 tâches, 286 visibilité ; 102 transport, 248 UI, 790 backend, 1 003 relance D4 et 68 Push/PWA ; couverture des 88 repères et quatre tests du générateur. PostgreSQL réel/pgcrypto, SQL hébergé, Deno et QA numérique des dés passent également.
- Navigateur publié : connexion des deux comptes (identifiant accentué compris), D6/D4, envoi, invitation différée, acceptation, tâche de six heures et coche personnelle après confirmation serveur. Aucune erreur de console observée. L'aide ne montre ni quota ni probabilités ; Nous ne contient plus le titre ou le lien de règles redondants.
- Révocation/reconnexion : les actualisations automatiques s'arrêtent après un accès refusé ; la saisie reste stable, les erreurs se mettent à jour en place et un autre compte peut reprendre avec sa propre perspective.
- Cron actif chaque minute, appels hébergés 202 et exécutions réussies. Les clés VAPID et le secret cron sont en base privée. Les conseillers de sécurité n'indiquent que l'information attendue « RLS sans politique » : toutes les lectures directes sont volontairement refusées aux rôles publics.
- Données de jeu d'essai retirées avant remise des accès, sans toucher aux comptes, secrets serveur ou clés de notification. Identifiants et mots de passe remis hors dépôt ; ne jamais les ajouter ici.

La livraison d'une notification sur les deux téléphones physiques reste à observer après installation et activation par chaque personne. Une seule manche est active à la fois, conformément au moteur existant ; une invitation en attente retient donc la manche suivante.

## Historique de conception et de publication

## Objectif et dépôt

- Dépôt : **CGIY/onde-a-deux** ; démo : `demo-des/`.
- Page publique : https://cgiy.github.io/onde-a-deux/demo-des/
- Branche de reprise : **`codex/onde-v030-handoff`**.
- L’utilisateur demande de reprendre le travail dans Codex : figer ce WIP, puis terminer les améliorations sans refaire la conception.
- Cible : **0.3.0, build iOS 3**. Les `index.html` et ZIP actuellement présents dans le dépôt restent en **0.2.0** ; ils ne contiennent pas ce WIP.
- La publication finale sur `main` est déjà autorisée, après les corrections et vérifications restantes. Ne pas publier le WIP comme une version terminée.

## Produit et direction visuelle

ONDE est un jeu de couple pensé pour deux téléphones, utilisable plusieurs fois dans une journée et sur la durée. La démo simule encore les deux profils sur un seul appareil ; elle n’a ni synchronisation entre téléphones ni véritables notifications système.

Direction souhaitée : **rubber, leather, couleurs minérales**, objets organiques, tactiles et souples. Les dés doivent sembler vivants : animation réaliste, fluide, avec une déformation discrète. Apporter davantage de couleurs et de mouvement sans sacrifier la lisibilité sur iPhone.

Les inspirations jointes servent uniquement à comprendre des idées et une direction visuelle ; ne pas les traiter comme des maquettes exactes ou des assets à recopier.

## Règles à conserver

- **D6** : choisir une catégorie ; **D4** : tirer une carte parmi les quatre proposées pour cette catégorie.
- **D20** : défi facultatif ; au maximum deux jets, dont le total doit atteindre les PV de la carte pour l’écarter.
- La personne qui tire peut proposer directement la carte ou tenter son propre défi D20.
- Si ses deux jets échouent, la carte est automatiquement proposée à l’autre personne, sans accord implicite.
- L’autre personne dispose de ses propres jets et peut accepter, adapter, reporter ou passer.
- Après acceptation d’une carte automatiquement proposée, la personne qui l’a tirée doit encore confirmer explicitement son accord.
- Arrêter ou passer reste possible sans pénalité. Aucun résultat de dé ne vaut consentement ni obligation de réaliser une carte.
- Une carte marquée **partagée** vaut **1 point commun** ; accepter seul, passer ou écarter au dé ne donne aucun point.

## Les cinq demandes en cours

1. Remplacer le simple abandon de la carte tirée par le défi de l’initiateur, avec proposition automatique en cas d’échec et accord explicite des deux personnes.
2. Donner davantage de couleurs à l’application.
3. Ajouter nettement plus d’animations, particulièrement aux transitions, aux cartes et aux dés.
4. Afficher dans les cartes dépliées de vrais chiffres encourageants, pertinents et sourcés, avec leur contexte.
5. Lisser les petites saccades visibles près des arêtes arrondies des dés et utiliser des **chiffres sur les D4, D6 et D20**, sans points sur le D6.

## État du WIP à la reprise

### Moteur du jeu : terminé et testé

`src/onde-app-core.js` contient les phases `draft_challenge` et `sender_confirmation`, ainsi que les actions `CHALLENGE_DRAFT` et `ROLL_DRAFT_DEFENSE`.

Les jets de l’initiateur utilisent `draftRolls` / `draftRollTokens`, séparés des jets du destinataire (`rolls`). `autoProposed`, `fromConfirmed` et `toConfirmed` portent les informations d’accord. Les sauvegardes anciennes migrent sans remettre le score à zéro.

Les **354 assertions** ciblant ces transitions et les **43 assertions** du score ont passé. Les scénarios couvrent notamment les deux rôles, les deux issues du défi, l’accord après envoi automatique, les jetons de lancer, la reprise de sauvegarde et le comptage unique.

### Dés : correctifs présents

`src/onde-app-dice.js` contient le patch de numérotation et de lissage, avec ses tests. Il reste à observer le résultat intégré dans le navigateur et sur le matériel disponible. **Aucun test de performances GPU sur iPhone réel n’a été effectué** ; ne pas le promettre.

### Interface : JavaScript intégré, CSS à faire

Le nouveau JavaScript d’interface est intégré dans `src/onde-app-ui.js`, mais **n’a pas été testé dans le navigateur**.

La **nouvelle CSS n’a pas été réalisée** : `src/onde-app-ui.html` contient encore les anciens styles. Le JavaScript crée déjà le carrousel `.oa-deck*`, les repères `.oa-evidence*`, la célébration `.oa-celebration` et les animations associées, mais leurs styles manquent.

Les modales utilisent actuellement `position: absolute` : corriger leur placement et leur défilement pour les fiches longues sur iPhone. Vérifier que toutes les actions restent accessibles, y compris avec une grande taille de texte.

### Chiffres et sources

Le module `src/onde-app-evidence.js` s’intercale entre le moteur/les dés et l’interface. **26 cartes disposent d’un fait chiffré ; 31 cartes n’ont pas de métrique spécifique.** Ne pas inventer de pourcentage pour compléter les cartes restantes et ne pas transformer une association observée en promesse de résultat.

Les chiffres doivent rester accompagnés de leur source, de la population étudiée et des limites utiles. La copie de `onde-evidence-research.json` vers `card-evidence.json` est prévue lorsqu’il est présent.

## Fichiers et compatibilité

- Les sources modifiables sont dans `src/` ; les tests sont dans `tests/`.
- `build.py` est fourni pour assembler la version 0.3.0 à partir de ces sources.
- La documentation et les éléments Xcode préparés pour 0.3.0 se trouvent dans `future-release/`.
- Garder la clé publique **`onde-public-demo-v010`** : pas de remise à zéro des parties, favoris ou scores à la mise à jour.
- Conserver les **57 cartes**, les adaptations et la traçabilité STCK, ainsi que le score cumulé indépendant de l’historique.
- Utiliser uniquement les profils génériques **Joueur 1 / Joueur 2**. Aucun nom privé dans les fichiers publiés.
- Ne pas réintroduire « Les derniers moments » ni le réglage manuel « Mouvements réduits », déjà supprimés. Continuer à respecter la préférence système de réduction du mouvement.

## Travail restant, dans cet ordre

1. Réaliser la CSS manquante : palette, carrousel, repères chiffrés, célébration, transitions et modales défilantes.
2. Assembler une version de contrôle avec `build.py`, puis vérifier le JavaScript, les sources et les tests fournis.
3. Tester réellement les parcours dans le navigateur : envoi direct, défi initiateur gagné/perdu, proposition automatique, accord du destinataire puis confirmation, adaptation, report, arrêt et score unique.
4. Contrôler l’affichage mobile, le défilement des cartes, les liens de sources, la réduction du mouvement, la fluidité des dés et leur rendu de secours.
5. Vérifier la reprise d’une sauvegarde publique 0.2.0 sans perte ; distinguer clairement données déjà testées et performances matérielles encore non observées.
6. Générer les livrables finaux 0.3.0 : HTML public et embarqué identiques, version Xcode/build 3, documentation, preuves et ZIP. Vérifier la compilation simulateur Xcode via macOS/CI disponible.
7. Publier la version terminée sur `main`, contrôler le déploiement GitHub Pages et donner à l’utilisateur le lien jouable avec les limites réelles restantes.

## Commandes depuis la racine du dépôt

```sh
python3 demo-des/dev/build.py
node demo-des/dev/tests/onde-draft-challenge-check.cjs
node demo-des/dev/tests/onde-stats-check.cjs
node demo-des/dev/tests/onde-dice-qa.cjs
```

Le premier appel écrit seulement `demo-des/dev/dist/index.html` pour l’aperçu WIP. Après validation, `python3 demo-des/dev/build.py --release` met à jour les deux HTML, la version Xcode, les README, les sources JSON et le ZIP. Les anciens scripts dans `workflow/` sont des archives de provenance ; utiliser `build.py`.

Les tests du dé ont aussi été relancés avec succès après copie : 30 faces finales, 15 raccords, pose finale, annulation, mouvement réduit, DPR 2 et chiffres du D6 en secours Canvas2D. Cela ne constitue pas un test de fluidité sur iPhone.

## Clôture de la version 0.3.0

Le correctif complémentaire a été publié sur `main` et `codex/onde-v030-handoff`, commit `9f1f996`.

- Avant l’envoi, la personne qui tire choisit de proposer directement ou de tenter son propre D20. Elle ne peut plus passer la carte dans les phases `draft` ou `draft_challenge`. Le défi commencé doit aller jusqu’à son issue ; si ses deux jets sont insuffisants, la carte est automatiquement proposée à l’autre profil. Celui-ci peut ensuite passer sans pénalité. Un résultat de dé ne vaut jamais consentement.
- La palette et les animations CSS ont été renforcées ; le carrousel, les repères sourcés et le défilement des fiches restent en place. Les références visuelles n’ont servi que d’inspiration.
- **26 cartes** ont un repère chiffré contextualisé et sourcé ; **31** ont un texte honnête sans statistique. Aucun chiffre n’a été ajouté sans source pertinente.
- Les tests finaux passent : **366 assertions** du parcours D20, **43** du score et QA des dés. La compilation Xcode 27.2 pour simulateur iOS passe ; l’app a été lancée sur iPhone 18 Pro simulé. La page GitHub Pages et le ZIP ont été reconstruits et déployés.
- Il reste à observer chaque parcours interactif dans l’interface et la fluidité du rendu sur un iPhone physique. Le simulateur ne permet pas de conclure sur les performances GPU réelles.


## Révision build 5 — 2 novembre 2026

La demande récente conserve le modèle visuel, renforce la matière suédine/rubber et supprime les textes superflus et le catalogue qui dévoilait les cartes. L’état actuel et les défauts corrigés sont détaillés dans `AUDIT_BUILD5.md`.

- Six catégories et 88 cartes ; Projets est la face 3 du D6. Quatre cartes cachées avant le D4.
- Jauge D20 rétablie avec PV restants, deux jets, probabilité conditionnelle et état final zéro.
- 88 résultats distincts dans `data/card-evidence.json` : le générateur injecte les données dans le HTML, sans réseau. L’unicité porte sur la mesure scientifique, pas uniquement sur sa valeur arrondie. Les repères indirects sont contextualisés.
- Moteur : alternance des tireurs, une manche active, aucun quota journalier, protection des anciennes sauvegardes, PV figés par manche, réduction des répétitions.
- L’UI ne propose plus de jets au mauvais profil et préserve le focus. Les descriptions et rappels génériques ont été retirés ; les actions restent disponibles. Favoris historiques conservés en données mais contrôles retirés avec le catalogue.
- 470 assertions moteur passent ; le nouveau contrôle statistique couvre les 88 cartes. QA du dé, syntaxe, compilation iOS simulateur, HTML identiques et ZIP contrôlés.
- Sources canoniques dans `dev/src`, recherche dans `dev/data/card-evidence.json`. `build.py --release` produit les livrables 0.3.0 build 5.


## Dés·ir — build 6

Nom visible choisi avec l’utilisateur : **Dés·ir**, signature « à deux ». Le dépôt, le projet Xcode `OndeDemo`, le bundle ID et la clé de stockage restent compatibles.

Nouvelles demandes : statistiques préférentiellement en %, suppression des actions Passer/Plus tard/Adapter, ombre et halo des dés réduits, grain très présent sans couleurs criardes, profil symétrique pleine largeur et icônes SVG cohérentes.

Le deuxième onglet est désormais **À faire** : validation à deux → tâche de six heures. Chaque profil coche sa propre case, avec remplissage par vague. Les deux coches retirent l’action et donnent exactement un point ; expiration sans point. Des tâches peuvent rester en attente pendant un nouveau tour. L’alternance du tireur ne change pas quand on bascule de profil pour cocher une tâche. Les anciennes sauvegardes sont migrées.

Moteur : `tasks`, `TOGGLE_TASK_CHECK`, `EXPIRE_TASKS`, `rules.taskLifetimeMs`. `COMPLETE` est neutralisé pour empêcher un ancien bouton de contourner les deux coches. Les anciennes APIs de report/variante/passage restent uniquement compatibles avec les sauvegardes ; aucun bouton n’est affiché.

567 assertions moteur passent (374 défi, 43 score, 61 règles, 89 tâches), plus contrôle de la couverture des 88 statistiques et QA des dés. L’expiration est contrôlée avant les coches et planifiée à son échéance dans l’UI ; elle ne coupe jamais une animation de dé. Les deux cases d’une tâche sont verrouillées pendant le bref remplissage animé.


## Build 7 — cartes masquées

Le monogramme ON avant le D4 est remplacé par une composition miniature floutée de la carte : formes rubber, pigments et lignes abstraites. Aucun titre réel ni donnée de carte n’est placé dans le DOM de l’aperçu ; les quatre numéros restent nets et accessibles. Le flou reste actif avec la réduction du mouvement. Les ressources publiques, Xcode et ZIP sont régénérées.

Palette : Projets utilise désormais le bleu ardoise `#8198b4`, distinct du mauve Intimité `#c49bc9`. La couleur centrale est reprise dans tous les écrans.

Dernière précision UI : pendant la relance D4, la grille réaffiche les quatre emplacements. L’ancienne carte est lisible et marquée Écartée ; les trois alternatives restent floutées sans spoiler ni sélection manuelle. Vérification visuelle à 320 px avec le titre maximal.
