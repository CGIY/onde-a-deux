# ONDE — démo jouable 0.3.0

[Jouer dans le navigateur](https://cgiy.github.io/onde-a-deux/demo-des/) · [Télécharger le projet Xcode](https://cgiy.github.io/onde-a-deux/demo-des/ONDE-Xcode.zip)

## Essayer

Lancer le **D6** pour choisir une catégorie, puis le **D4** pour tirer une carte. La personne qui tire peut proposer la carte directement ou tenter de l’écarter avec le **D20** : elle dispose de deux jets au maximum pour atteindre les PV de la carte avec leur total.

Si ce total reste inférieur aux PV après le second jet, la carte est **automatiquement proposée à l’autre profil**. Changer de profil en haut de l’écran pour accepter, adapter, proposer un autre moment ou tenter à son tour un défi avec deux nouveaux jets de D20. Si l’autre accepte une carte proposée automatiquement, la personne qui l’a tirée doit encore **confirmer son accord** avant que la carte soit acceptée à deux. Une proposition envoyée volontairement suit le parcours d’accord habituel.

Avant la proposition, la personne qui tire choisit entre l’envoyer directement et tenter le D20. Elle ne peut pas écarter la carte en la passant : après deux jets insuffisants, la proposition part automatiquement à l’autre profil. Une fois la carte reçue, l’autre personne peut la passer sans pénalité. Le dé ne vaut jamais accord.

Les 57 cartes de démonstration, les favoris, les variantes et le score commun sont utilisables localement. Les dés ont une animation WebGL et un rendu de secours lorsque WebGL est indisponible.

La compilation pour simulateur avec Xcode 27.2 a réussi et l’application a été lancée sur un iPhone 18 Pro simulé. Les tests fournis du parcours D20 (366 assertions), du score (43 assertions) et des dés passent. Une vérification complète de tous les parcours dans l’interface et la fluidité sur iPhone physique restent à observer.

## Couleurs, mouvement et repères sourcés

Les catégories ont des couleurs minérales plus présentes. Les changements d’étape, les cartes et les dés sont animés ; les trois dés portent des chiffres. Les cartes dépliées peuvent défiler pour lire la consigne, la variante et les informations associées. Les animations suivent automatiquement la préférence d’accessibilité du système.

Les repères chiffrés des cartes indiquent leur source et le contexte de l’étude : population, mesure et limites utiles. Ils apportent un éclairage sur le sujet, sans promettre qu’un défi produira le même résultat pour votre duo. Le dossier de recherche est fourni dans `card-evidence.json` lorsqu’il est inclus dans cette version.

Les deux profils sont **simulés sur un seul appareil**. Les notifications sont des aperçus. Cette démo n’a ni synchronisation entre téléphones ni service distant de collecte. Les données de test restent dans le stockage local de la page ou de l’app.

## Score commun et catalogue STCK

Dans **Nous**, une carte marquée **partagée** ajoute **1 point au duo**, avec une répartition par catégorie. Accepter, passer ou écarter une carte au D20 n’ajoute aucun point. Le total cumulé reste conservé indépendamment de la limite technique de l’ancien historique. Les anciens tours partagés encore disponibles sont repris lors de la mise à jour ; les tours déjà évincés ne peuvent pas être reconstitués.

La section chronologique « Les derniers moments » et le réglage manuel « Mouvements réduits » ont été retirés. Les animations respectent automatiquement la préférence d’accessibilité du système.

Le catalogue reprend **21 nouvelles cartes** des collections Amour, Massage, Soin, Fast Food, Pâtissier et Canapé de [STCK](https://github.com/CGIY/stck/blob/98119ed48b8af6e868582eeeed0912214e007e9c/src/catalog.json). Trois propositions déjà présentes (massage de la tête, câlin et petit mot caché) sont reliées à leur équivalent sans créer de doublon. Les titres proviennent de STCK ; les consignes, variantes, durées estimées et PV provisoires sont adaptés pour ONDE. La traçabilité complète est dans `stck-adaptations.json`.


## Dans Xcode

Décompresser `ONDE-Xcode.zip`, ouvrir `OndeDemo.xcodeproj`, choisir le schéma **OndeDemo**, un simulateur iPhone avec iOS 17 ou plus, puis **⌘R**. Le [guide du projet](xcode/README.md) explique aussi le lancement sur iPhone physique.

Le fichier à modifier pour tester rapidement est **`xcode/OndeDemo/Web/index.html`**. Il contient tout le jeu ; une relance de l’app recopie la ressource. Le wrapper SwiftUI utilise WKWebView et les zones de sécurité natives. Les liens de sources s’ouvrent dans le navigateur système.

Les sources iOS ne nécessitent ni générateur de projet ni installation de paquets. La compilation et la signature d’un appareil physique demandent Xcode sur macOS. Le workflow GitHub `ONDE demo — Xcode` vérifie la compilation pour simulateur ; voir son résultat pour le commit concerné.

## Mettre à jour les deux versions

Après une modification dans `xcode/OndeDemo/Web/index.html`, lancer `python3 sync-demo.py` depuis ce dossier pour recopier le jeu vers `index.html` et reconstruire le ZIP. Aucune commande n’est nécessaire pour exécuter le projet dans Xcode.

La version et le rapport de retour portent le numéro **0.3.0**, et le projet iOS utilise le **build 3**. Les profils sont génériques ; cette page et son code sont publics. La mise à jour conserve la même clé de stockage local pour reprendre la partie et le score existants.
