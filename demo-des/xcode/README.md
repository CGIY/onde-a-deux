# ONDE — démo iPhone pour Xcode

Une application de test locale : **D6 pour la catégorie, D4 pour la carte, D20 pour le défi facultatif**. Le prototype est embarqué dans une vue WebKit, avec les dés, les 57 cartes de démonstration et le score commun et deux profils simulés. Le jeu fonctionne sans serveur.

## Démarrer en quatre étapes

1. Décompresser le dossier complet, puis ouvrir **`OndeDemo.xcodeproj`** dans Xcode.
2. Dans la barre d’outils, choisir le schéma **OndeDemo**.
3. Choisir un **simulateur iPhone** avec iOS 17 ou une version ultérieure. Si aucun simulateur n’est proposé, installer le composant iOS depuis les réglages de Xcode.
4. Cliquer sur **Run ▶**, ou utiliser **⌘R**. Une fois l’app ouverte, lancer le D6 puis le D4 ; changer de profil en haut pour répondre à l’invitation.

Le simulateur permet de commencer sans distribution TestFlight ni sélection d’une équipe de signature. Choisir un appareil simulé précis, et non « Any iOS Device ».

## Essayer sur un iPhone physique

Dans les réglages de Xcode, ajouter son compte Apple. Dans la cible **OndeDemo → Signing & Capabilities**, conserver **Automatically manage signing**, puis choisir sa propre **Team**. Remplacer au besoin `fr.onde.prototype` par un identifiant unique. Connecter l’iPhone, sélectionner celui-ci comme destination et exécuter l’app. Suivre les éventuelles demandes de jumelage ou d’activation du mode développeur affichées par Xcode et l’iPhone.

Aucun compte, certificat ou identifiant d’équipe n’est inclus dans le projet. Le projet ne réalise aucun envoi à App Store Connect.

## Modifier la démo

Le fichier à modifier est **`OndeDemo/Web/index.html`**. Il contient l’interface, les styles, le catalogue, la logique et le rendu des dés. Après une modification, enregistrer puis relancer **⌘R** : Xcode recopie la ressource dans l’application.

Pour remplacer le prototype par une nouvelle version, remplacer ce fichier en conservant son nom et son emplacement. Il n’y a ni installation de paquets, ni commande de génération, ni serveur à lancer.

Les fichiers Swift se trouvent dans **`OndeDemo/Sources/`** :

- `OndeDemoApp.swift` : point d’entrée de l’app.
- `ContentView.swift` : fond et espace d’affichage respectant les zones de sécurité.
- `GameWebView.swift` : chargement du jeu local et ouverture des liens de sources dans le navigateur système.

## Version 0.2.0

L’onglet **Nous** affiche un score commun : **1 carte marquée partagée = 1 point**, puis le détail par catégorie. Les cartes passées, acceptées sans réalisation ou écartées au dé ne donnent pas de point. L’ancien état local est repris à l’ouverture ; le score ne dépend plus du nombre d’entrées d’historique conservées.

Le catalogue ajoute 21 propositions adaptées des titres de STCK ; les durées et PV sont des valeurs de prototype. Les rubriques « Les derniers moments » et « Mouvements réduits » ont été retirées. La préférence d’accessibilité de mouvement du système continue d’être respectée automatiquement.

## Ce qui est simulé

Les deux profils s’utilisent sur le même appareil. Les invitations, accords et notifications sont des interactions de démonstration ; aucun message ni rappel système n’est envoyé. La synchronisation entre deux téléphones n’est pas implémentée.

Les cartes peuvent être passées avant ou après un défi. L’échec d’un lancer ne valide jamais automatiquement une proposition.

Le stockage local du jeu utilise le magasin de données persistant de WebKit. Une désinstallation ou une remise à zéro peut supprimer les données de test. Après une mise à jour du catalogue ou des règles, il peut être utile d’utiliser **Nous → Effacer la partie de démonstration**.

## Vérification et limites

Le projet a été préparé dans un environnement Linux, sans Xcode ni `xcodebuild`. Sa structure, les fichiers plist/XML et les références des ressources peuvent y être contrôlés, mais **la compilation iOS n’a pas été exécutée ici**. Le premier lancement sur le Mac confirmera la compatibilité avec la version locale de Xcode et du simulateur.

Les animations WebGL doivent aussi être observées sur un iPhone réel : le simulateur ne représente pas exactement ses performances. Un rendu de secours est présent lorsque WebGL n’est pas disponible.

### Vérification en ligne de commande sur le Mac

```sh
xcodebuild -list -project OndeDemo.xcodeproj
xcodebuild -project OndeDemo.xcodeproj -scheme OndeDemo -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Références Apple

- [Exécuter une app sur un appareil simulé ou physique](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
- [Charger un fichier local dans WKWebView](https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl(_:allowingreadaccessto:))
- [Magasin de données persistant WKWebsiteDataStore](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)

