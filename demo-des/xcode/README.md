# Dés·ir — démo iPhone pour Xcode

Une application de test locale : **D6 pour la catégorie et D4 pour la carte**. Le D20 permet de tenter d’écarter une carte selon les PV attribués à son action. Le prototype est embarqué dans une vue WebKit, avec les dés, 88 cartes en six catégories, le score commun et deux profils simulés. Le jeu fonctionne sans serveur. Cette version porte le numéro **0.3.0**, **build 6**.

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

## Version 0.3.0

Le D6 choisit parmi six catégories, puis le D4 tire une carte parmi quatre. La personne qui tire peut proposer directement ou tenter d’écarter la carte en deux jets de D20 maximum. Le total doit atteindre les PV indiqués sur la carte. En cas d’échec, elle est proposée automatiquement à l’autre profil, qui peut accepter ou tenter son propre D20.

Les 88 cartes appartiennent aux catégories Complicité, Détente, Projets, Attentions, Bouffe et Intimité. Leurs PV sont des estimations initiales : plus le seuil est élevé, plus la carte est difficile à écarter. Les actions simples, à moins de 20 € ou sexuellement simples ont des seuils élevés ; les actions plus coûteuses ou engageantes ont des seuils plus bas. Chaque carte affiche un résultat chiffré distinct et sourcé, avec ses limites de pertinence. Le contexte des études est dépliable. Aucune durée n’est imposée aux nouvelles cartes.

L’onglet **Nous** affiche un score commun : **1 action cochée par les deux profils = 1 point**, avec le détail par catégorie. Le stockage local reprend les sauvegardes précédentes et conserve les PV de la manche commencée. Les rôles alternent, une seule manche reste active et il n’y a pas de quota quotidien. Le catalogue public a été retiré pour préserver la surprise. Le deuxième onglet « À faire » contient les actions validées, six heures maximum. Les deux cases sont indépendantes et l’action disparaît au second clic ou à l’expiration.

## Ce qui est simulé

Les deux profils s’utilisent sur le même appareil. Les invitations, accords et notifications sont des interactions de démonstration ; aucun message ni rappel système n’est envoyé. La synchronisation entre deux téléphones n’est pas implémentée.

Le stockage local du jeu utilise le magasin de données persistant de WebKit. Cette mise à jour conserve la clé de stockage pour reprendre les profils, la partie et le score. Une désinstallation ou une remise à zéro peut supprimer les données de test. **Nous → Effacer la partie de démonstration** permet de recommencer volontairement.

## Vérification et limites

Le build 6 avec 88 cartes et 88 résultats distincts a été compilé pour le simulateur iOS. Les parcours D6/D4/D20 et les écrans ont été contrôlés dans le navigateur au format téléphone. Les animations sur un iPhone physique restent à observer.

Les tests automatisés ne remplacent pas une vérification manuelle de chaque parcours dans l’interface. Les animations WebGL doivent aussi être observées sur un iPhone réel : le simulateur ne représente pas exactement ses performances. Un rendu de secours est présent lorsque WebGL n’est pas disponible.

### Vérification en ligne de commande sur le Mac

```sh
xcodebuild -list -project OndeDemo.xcodeproj
xcodebuild -project OndeDemo.xcodeproj -scheme OndeDemo -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Références Apple

- [Exécuter une app sur un appareil simulé ou physique](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
- [Charger un fichier local dans WKWebView](https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl(_:allowingreadaccessto:))
- [Magasin de données persistant WKWebsiteDataStore](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)

