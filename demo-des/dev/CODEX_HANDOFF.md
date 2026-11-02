# ONDE — passage de relais à Codex

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
