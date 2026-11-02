# ONDE — démo iPhone pour Xcode

Une application de test locale : **D6 pour la catégorie, D4 pour la carte, D20 pour le défi facultatif**. Le prototype est embarqué dans une vue WebKit, avec les dés, les 57 cartes de démonstration, le score commun et deux profils simulés. Le jeu fonctionne sans serveur. Cette version porte le numéro **0.3.0**, **build 3**.

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

Après le D6 et le D4, la personne qui tire la carte peut la proposer directement ou tenter de l’écarter au **D20**. Elle dispose de **deux jets au maximum**, dont le total doit atteindre les PV de la carte. Si le total reste insuffisant après le second jet, la carte est **automatiquement proposée à l’autre profil**.

L’autre personne peut accepter, adapter, proposer un autre moment, passer ou tenter son propre défi avec deux nouveaux jets de D20. Si elle accepte une proposition envoyée automatiquement, la personne qui a tiré la carte doit encore **confirmer son accord** avant que le jeu la considère acceptée à deux. Changer de profil en haut de l’écran permet de tester chaque réponse. Il reste possible d’arrêter ou de passer à tout moment, sans pénalité ; un échec au dé ne remplace jamais un accord.

L’interface renforce les couleurs minérales des catégories et les animations de transition, de cartes et de dés. Les D4, D6 et D20 portent tous des chiffres. Les cartes dépliées défilent pour garder la consigne, la variante et les repères lisibles sur iPhone.

Les chiffres présentés dans les cartes sont accompagnés de leurs sources et du contexte de mesure. Ils éclairent le sujet de la carte, sans promettre un effet particulier pour votre duo. Les références sont intégrées au jeu ; le dossier de recherche `card-evidence.json` accompagne aussi la version navigateur lorsqu’il est disponible.

L’onglet **Nous** affiche un score commun : **1 carte marquée partagée = 1 point**, puis le détail par catégorie. Les cartes passées, acceptées sans réalisation ou écartées au dé ne donnent pas de point. L’ancien état local est repris à l’ouverture ; le score ne dépend plus du nombre d’entrées d’historique conservées.

Le catalogue ajoute 21 propositions adaptées des titres de STCK ; les durées et PV sont des valeurs de prototype. Les rubriques « Les derniers moments » et « Mouvements réduits » ont été retirées. La préférence d’accessibilité de mouvement du système continue d’être respectée automatiquement.

## Ce qui est simulé

Les deux profils s’utilisent sur le même appareil. Les invitations, accords et notifications sont des interactions de démonstration ; aucun message ni rappel système n’est envoyé. La synchronisation entre deux téléphones n’est pas implémentée.

Les cartes peuvent être passées avant ou après un défi. L’échec du défi de la personne qui tire peut envoyer une proposition, mais ne la valide jamais automatiquement.

Le stockage local du jeu utilise le magasin de données persistant de WebKit. Cette mise à jour conserve la clé de stockage pour reprendre les profils, la partie et le score. Une désinstallation ou une remise à zéro peut supprimer les données de test. **Nous → Effacer la partie de démonstration** permet de recommencer volontairement.

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

