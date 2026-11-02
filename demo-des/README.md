# ONDE — démo jouable 0.3.0

[Jouer dans le navigateur](https://cgiy.github.io/onde-a-deux/demo-des/) · [Télécharger le projet Xcode](https://cgiy.github.io/onde-a-deux/demo-des/ONDE-Xcode.zip)

## Essayer

Le D6 choisit une catégorie parmi six, puis le D4 tire une carte parmi quatre. La personne qui tire peut la proposer directement ou tenter de l’écarter avec deux jets de D20 au maximum : leur total doit atteindre les PV de la carte. Si elle échoue, la proposition part automatiquement à l’autre personne, qui peut encore accepter, adapter, reporter ou passer. Un jet ne remplace jamais un accord.

Les seuils sont une première estimation : les actions simples, à moins de 20 € ou sexuellement simples ont davantage de PV et sont donc plus difficiles à écarter ; les actions plus engageantes ou coûteuses en ont moins. La fiche indique aussi la probabilité d’atteindre son seuil en deux jets.

Le catalogue comprend 88 cartes en six catégories. Chaque carte présente un fait positif avec sa source et son contexte ; lorsque l’étude porte sur un thème proche plutôt que sur l’action précise, la fiche le dit clairement. Les nouvelles cartes n’ont pas de durée imposée.

Le projet Xcode 0.3.0 build 4 a été reconstruit pour le simulateur iOS. Le rendu sur un iPhone physique n’a pas été vérifié.

## Couleurs, mouvement et repères sourcés

Les catégories ont des couleurs minérales plus présentes. Les changements d’étape, les cartes et les dés sont animés ; les trois dés portent des chiffres. Les cartes dépliées peuvent défiler pour lire la consigne, la variante et les informations associées. Les animations suivent automatiquement la préférence d’accessibilité du système.

Les repères chiffrés des cartes indiquent leur source et le contexte de l’étude : population, mesure et limites utiles. Ils apportent un éclairage sur le sujet, sans promettre qu’un défi produira le même résultat pour votre duo. Le dossier de recherche est fourni dans `card-evidence.json` lorsqu’il est inclus dans cette version.

Les deux profils sont **simulés sur un seul appareil**. Les notifications sont des aperçus. Cette démo n’a ni synchronisation entre téléphones ni service distant de collecte. Les données de test restent dans le stockage local de la page ou de l’app.

## Score commun et catalogue STCK

Dans **Nous**, une carte marquée **partagée** ajoute **1 point au duo**, avec une répartition par catégorie. Passer une invitation n’ajoute aucun point. Le total cumulé reste conservé indépendamment de la limite technique de l’ancien historique. Les anciens tours partagés encore disponibles sont repris lors de la mise à jour ; les tours déjà évincés ne peuvent pas être reconstitués.

La section chronologique « Les derniers moments » et le réglage manuel « Mouvements réduits » ont été retirés. Les animations respectent automatiquement la préférence d’accessibilité du système.

Le catalogue contient **88 cartes sélectionnées par Clément** dans six catégories : Complicité, Détente, Projets, Attentions, Bouffe et Intimité. Certains titres réutilisent des cartes STCK ; leur provenance est conservée dans les données. Les sources factuelles n’apparaissent que lorsque l’étude concerne réellement le sujet de la carte.


## Dans Xcode

Décompresser `ONDE-Xcode.zip`, ouvrir `OndeDemo.xcodeproj`, choisir le schéma **OndeDemo**, un simulateur iPhone avec iOS 17 ou plus, puis **⌘R**. Le [guide du projet](xcode/README.md) explique aussi le lancement sur iPhone physique.

Le fichier à modifier pour tester rapidement est **`xcode/OndeDemo/Web/index.html`**. Il contient tout le jeu ; une relance de l’app recopie la ressource. Le wrapper SwiftUI utilise WKWebView et les zones de sécurité natives. Les liens de sources s’ouvrent dans le navigateur système.

Les sources iOS ne nécessitent ni générateur de projet ni installation de paquets. La compilation et la signature d’un appareil physique demandent Xcode sur macOS. Le workflow GitHub `ONDE demo — Xcode` vérifie la compilation pour simulateur ; voir son résultat pour le commit concerné.

## Mettre à jour les deux versions

Après une modification dans `xcode/OndeDemo/Web/index.html`, lancer `python3 sync-demo.py` depuis ce dossier pour recopier le jeu vers `index.html` et reconstruire le ZIP. Aucune commande n’est nécessaire pour exécuter le projet dans Xcode.

La version et le rapport de retour portent le numéro **0.3.0**, et le projet iOS utilise le **build 4**. Les profils sont génériques ; cette page et son code sont publics. La mise à jour conserve la même clé de stockage local pour reprendre la partie et le score existants.
