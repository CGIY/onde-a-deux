# ONDE — démo jouable 0.1.0

[Jouer dans le navigateur](https://cgiy.github.io/onde-a-deux/demo-des/) · [Télécharger le projet Xcode](https://cgiy.github.io/onde-a-deux/demo-des/ONDE-Xcode.zip)

## Essayer

Lancer le **D6** pour choisir une catégorie, puis le **D4** pour tirer une carte. Proposer la carte au second profil, puis changer de profil en haut de l’écran pour accepter, adapter, proposer un autre moment ou passer. Le défi facultatif permet de cumuler au maximum deux jets de D20 contre les PV de la carte. Passer reste toujours possible ; un échec ne vaut jamais accord.

Les 36 cartes de démonstration, les favoris, les variantes et l’historique sont utilisables localement. Les dés ont une animation WebGL et un rendu de secours lorsque WebGL est indisponible.

Les deux profils sont **simulés sur un seul appareil**. Les notifications sont des aperçus. Cette démo n’a ni synchronisation entre téléphones ni service distant de collecte. Les données de test restent dans le stockage local de la page ou de l’app.

## Faire un retour

Ouvrir **Avis** dans l’en-tête ou **Nous → Donner mon avis**. Écrire une observation puis copier le rapport et le coller dans la conversation. Le rapport indique la version et l’état utile du jeu ; il n’est jamais envoyé automatiquement.

## Dans Xcode

Décompresser `ONDE-Xcode.zip`, ouvrir `OndeDemo.xcodeproj`, choisir le schéma **OndeDemo**, un simulateur iPhone avec iOS 17 ou plus, puis **⌘R**. Le [guide du projet](xcode/README.md) explique aussi le lancement sur iPhone physique.

Le fichier à modifier pour tester rapidement est **`xcode/OndeDemo/Web/index.html`**. Il contient tout le jeu ; une relance de l’app recopie la ressource. Le wrapper SwiftUI utilise WKWebView et les zones de sécurité natives. Les liens de sources s’ouvrent dans le navigateur système.

Les sources iOS ne nécessitent ni générateur de projet ni installation de paquets. La compilation et la signature d’un appareil physique demandent Xcode sur macOS. Le workflow GitHub `ONDE demo — Xcode` vérifie la compilation pour simulateur ; voir son résultat pour le commit concerné.

## Mettre à jour les deux versions

Après une modification dans `xcode/OndeDemo/Web/index.html`, lancer `python3 sync-demo.py` depuis ce dossier pour recopier le jeu vers `index.html` et reconstruire le ZIP. Aucune commande n’est nécessaire pour exécuter le projet dans Xcode.

La version et le rapport de retour portent le numéro **0.1.0**. Les profils sont génériques ; cette page et son code sont publics.
