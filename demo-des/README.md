# ONDE — démo jouable 0.3.0, build 5

[Jouer](https://cgiy.github.io/onde-a-deux/demo-des/) · [Projet Xcode et ZIP](https://cgiy.github.io/onde-a-deux/demo-des/ONDE-Xcode.zip)

Six catégories : Complicité, Détente, Projets, Attentions, Bouffe et Intimité. Le D6 choisit la catégorie, le D4 révèle l’une des quatre cartes cachées. Le catalogue consultable a été retiré pour préserver les découvertes.

## Règles

- Une seule manche active ; pas de quota quotidien. Les rôles alternent au tour suivant.
- Une catégorie sur six, puis une carte sur quatre, à chances égales. Les cartes récemment tirées sont évitées quand le nombre de cartes le permet.
- Proposer directement ou tenter le D20 : deux jets maximum par personne. Leur somme doit atteindre les PV de la carte pour l’écarter.
- Après deux jets insuffisants de la personne qui tire, la proposition est envoyée automatiquement à l’autre profil. Les actions accepter, adapter, reporter et passer restent disponibles ; les deux confirmations sont requises pour un envoi automatique.
- Une carte marquée partagée rapporte un point commun. Accepter, passer ou écarter ne rapporte aucun point.

Les PV restent les premières estimations choisies avec l’utilisateur : gestes simples, achats sous 20 € et actes qualifiés de simples ont plus de résistance. La jauge montre les PV restants, les deux résultats et la probabilité exacte actualisée. Un seuil de 35 PV donne 5,25 % de réussite sur deux D20, contre 34 % à 25 PV et 77,25 % à 15 PV.

## Matières et statistiques

La forme de l’application est conservée : rubber, suédine, pigments minéraux et grain statique. Les retours de pression, la révélation et les transitions restent courts ; la jauge s’anime après chaque résultat. Les animations respectent la réduction du mouvement du système.

Les 88 cartes disposent de 88 résultats chiffrés distincts. Source, population, mesure et limites figurent dans « Source & contexte ». Plusieurs repères concernent un thème connexe : aucun bénéfice spécifique n’est attribué à une pratique sans étude correspondante. Les résultats d’enquêtes, corrélations et petites études ne sont pas des promesses individuelles. Le fichier `card-evidence.json` contient la traçabilité de chaque résultat.

## Démo et Xcode

Deux profils simulés sur un seul appareil, sans synchronisation entre téléphones ni notifications système. Les données restent dans le stockage local. La clé publique historique est conservée ; les anciens scores migrent et les PV d’une manche restent figés. Une sauvegarde non reconnue est conservée dans une copie locale de récupération avant le démarrage d’une nouvelle démo.

Décompresser le ZIP, ouvrir `OndeDemo.xcodeproj`, choisir le schéma **OndeDemo** et un simulateur iPhone iOS 17 ou plus, puis **⌘R**. Voir le [guide Xcode](xcode/README.md).

Les sources de référence sont dans `dev/src/`. Générer un aperçu avec `python3 demo-des/dev/build.py`, puis les ressources publiques, embarquées et le ZIP avec `python3 demo-des/dev/build.py --release`. Le générateur vérifie la couverture du catalogue et l’absence de doublons de résultats avant de construire.

Le build 5 a été compilé pour simulateur. Les parcours ont été contrôlés dans le navigateur ; les performances sur iPhone physique restent à observer.
