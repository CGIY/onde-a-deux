# Dés·ir — version web 0.3.0

[Ouvrir Dés·ir](https://cgiy.github.io/onde-a-deux/demo-des/)

Chaque personne se connecte sur son téléphone avec son identifiant et son mot de passe. Les deux comptes sont créés dans la base privée ; il n’y a ni inscription publique ni code d’association. Les noms ne sont retournés qu’après connexion. Le mot de passe n’est jamais conservé par l’application ; l’accès de cet appareil reste enregistré pour les prochaines ouvertures.

Au premier lancement sur cet appareil, un accueil résume le principe en trois phrases. « C’est parti » le ferme et mémorise ce choix pour les prochaines ouvertures.

Le tirage reste privé jusqu’à l’envoi de la proposition. L’autre personne reçoit alors une invitation qu’elle peut ouvrir et traiter plus tard. L’état, les tirages, les dates et le score sont partagés par le service. Une coupure du réseau conserve l’accès enregistré et propose « Réessayer » au lancement, ou signale l’indisponibilité dans la partie. Une action encore en attente garde son identifiant et n’empêche plus la lecture de l’état confirmé. Le retour du réseau ou de l’app relance l’actualisation ; un accès réellement révoqué demande une nouvelle connexion.

## Jouer

- **D4 catégorie → D6 challenge → D6 variante.** Complicité réunit les moments à deux et la détente. Plaisirs réunit les attentions et la cuisine. Avec Projets et Intimité, chaque catégorie propose six challenges et chacun possède six variantes, pour 144 issues possibles. Le D4 donne un poids de 11 à Complicité et Intimité et de 10 à Plaisirs et Projets. Les deux D6 restent uniformes. Les nouvelles manches proposent un seul tirage de challenge ; une ancienne manche conserve son parcours.
- Chaque personne dispose de **trois tirages par jour** (heure de Paris), renouvelés à 5 h. Seul le dé de catégorie réussi consomme un tirage. La prochaine disponibilité apparaît à sa place lorsque la cagnotte est vide. **Une relance du thème (D4) gratuite est en plus disponible une fois par jour et par personne**, utilisable avant le tirage de la carte ; elle ne consomme aucun ticket. Une fois par **semaine** (heure de Paris), un **joker** permet en plus de choisir sa catégorie au lieu du D4 : les quatre thèmes deviennent cliquables pendant un tour. Après une carte résolue ou passée, le tour suivant se relance automatiquement au bout de quelques secondes.
- Le samedi et le dimanche (heure de Paris), le poids d’**Intimité** au D4 passe de 11 à 22.
- Une **carte du jour** est tirée pour le duo au premier lancer de chaque journée (heure de Paris) ; elle est partagée et l’un des deux peut la proposer gratuitement une fois par jour avec « Proposer la carte du jour ».
- Quand le D4 tombe sur **Intimité**, un D20 supplémentaire décide : 10 ou moins, la manche continue normalement ; 11 ou plus, le jeu propose d’ouvrir une session **Hardcore**.
- Chaque joueur dispose de sa propre manche. Chacun peut tirer pendant que l’autre prépare sa carte ou attend une réponse. Une bannière ouvre l’invitation reçue ; « Mon tirage » retrouve la progression personnelle. Une seule manche reste active par joueur.
- **Relancer, proposer, répondre.** Une relance de carte gratuite est disponible une fois par tour avant l’envoi ; en parcours v2, elle retire aussi la variante déjà choisie et ramène au choix de variante. L’envoi transforme le brouillon en invitation. Le destinataire n’a que deux gestes : **J’accepte** ou **Passer**. Passer écarte la carte sans pénalité ni point.
- Une action validée à deux rejoint « À faire » pour vingt-quatre heures. Chacun coche sa propre case ; les deux coches retirent l’action et ajoutent un point commun. L’expiration ou une carte passée ne rapporte aucun point. Plusieurs actions validées peuvent rester en attente pendant un nouveau tour.

Le remplissage du bouton évolue du sable au corail pendant le maintien, avec un léger frémissement visuel qui suit la charge. Maintenir le bouton charge visuellement le dé. Le maximum est atteint après **1 200 ms**, avec **deux à cinq tours** selon la durée de maintien. Un clic court reste possible ; au clavier, Espace permet le maintien et Entrée le clic immédiat. La puissance change seulement le mouvement, jamais le résultat, les points ou le quota. Le lancer animé dure entre **1 650 et 2 500 ms** ; une attente réseau est signalée séparément. Les dés au repos gardent une orientation inclinée. Après l’arrêt du premier dé, sa catégorie reste affichée pendant 1,8 seconde. Après le dé de challenge, la carte sélectionnée se défloute dans la grille et reste affichée 2,8 secondes avant le dé de variante. La variante apparaît ensuite dans l’invitation et la liste À faire.

Les opérations sont confirmées côté serveur : une réponse répétée ne relance pas un dé et ne compte pas deux fois un point.

Dans « Nous », seul le grade le plus élevé atteint est affiché. Douze paliers suivent le score commun : **5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45 et 50 points**. Le nouveau grade remplace le précédent avec une courte transition. Sa palette bleu ardoise désaturé le distingue du score corail. Aucun nom de grade futur n’est affiché ; la barre indique seulement les points restant avant le prochain. Avant 5 points, un repère discret annonce le premier palier. Les grades suivent le total cumulé, même quand les anciennes actions quittent l’historique.

## Installer et recevoir les notifications

Sur iPhone ou iPad, ouvrir l’app dans Safari puis **Partager → Sur l’écran d’accueil**. Ouvrir ensuite Dés·ir depuis cette icône, se connecter et toucher **Nous → Activer les notifications**. Les notifications Web nécessitent iOS/iPadOS 16.4 ou plus et l’app ajoutée à l’écran d’accueil. Sur les autres navigateurs compatibles, le même bouton demande l’autorisation.

L’icône D6 sauge est fournie en PNG 180 px pour iPhone et 192/512 px pour l’installation web, avec le manifeste et les métadonnées Apple. Elle est opaque et conserve les matières et couleurs de l’application.

Les notifications signalent une invitation, une réponse, un dé disponible ou une action approchant de son expiration (trois heures avant l'échéance). Quand une mise à jour de l'app est prête, un bandeau « Recharger » apparaît en bas de l'écran ; l'ancienne version reste jouable jusqu'au rechargement. Leur texte reste générique, sans titre de carte. Aucune demande d’autorisation n’apparaît automatiquement. Au premier plan, les changements sont également actualisés périodiquement et lors du retour dans l’app.

## Direction artistique

La carte affiche le détail tiré. Les anciennes manches conservent leurs phrases d’origine. Les statistiques, leurs sources et la page de sélection ont été retirées. Le score commun et les grades restent les éléments du jeu.

La forme de l’application est conservée : rubber, suédine, pigments minéraux et grain statique. Le score commun et les accents passent au corail grisé, avec une texture propre au panneau pour rester visible. Pressions, révélations, jauge et cases en vague respectent la réduction du mouvement du système. Projets utilise le bleu ardoise, distinct du mauve Intimité ; l’ombre des dés reste discrète. Le chiffre du résultat s’éclaire progressivement en blanc ivoire brillant à la fin du lancer, y compris dans le rendu de secours.

L’[audit UI et direction artistique](dev/AUDIT_UI_DA.md) distingue les défauts mesurables, leurs corrections et les préférences de présentation. Les contrôles visuels réels et les limites matérielles y sont consignés séparément des calculs de couleur.


## Construire et vérifier

Les sources modifiables sont dans `dev/src/`. Les trois commandes suivantes écrivent l’aperçu dans `dev/dist/` :

```sh
python3 demo-des/dev/build.py              # démo locale isolée, sans connexion
python3 demo-des/dev/build.py --connected  # aperçu avec les comptes du service
python3 demo-des/dev/build.py --release    # aperçu connecté + index.html public
```

Un aperçu doit être servi par HTTP local. Les modes connectés lisent `config.js`, qui ne contient que l’URL du service et sa clé publiable. Ces paramètres sont incorporés au HTML pour éviter qu’un chargement de configuration manquant déclenche le mode démo. Une configuration manquante ou invalide bloque la construction connectée. Aucun identifiant, mot de passe ni secret serveur ne doit être ajouté à ce fichier.

Le générateur place le transport avant l’interface, copie les ressources PWA dans l’aperçu et synchronise le moteur canonique vers la fonction serveur. Le déploiement du service reste une étape distincte : voir [le guide serveur](server/README.md). La version web transmet le protocole de jeu 3 à la fonction Edge `desir-game`.

```sh
python3 demo-des/dev/tests/onde-build-check.py
node demo-des/dev/tests/onde-remote-check.cjs
node demo-des/dev/tests/onde-remote-ui-check.cjs
node demo-des/dev/tests/onde-visibility-check.cjs
node demo-des/dev/tests/onde-reroll-check.cjs
node demo-des/server/tests/backend-check.mjs
node demo-des/server/tests/push-check.mjs
```

Les contrôles automatisés couvrent les 144 résultats, les manches antérieures, la confidentialité des tirages, la relance et les points. Ils ne constituent pas un essai physique sur iPhone.

Les anciennes parties migrent automatiquement vers les deux manches personnelles, en conservant les cartes, tâches, points et historiques. Rouvrir l’app charge le protocole de connexion correspondant.

Le développement Xcode est mis de côté pendant l’essai web. Le [ZIP Xcode](ONDE-Xcode.zip) et son HTML embarqué restent l’archive locale du build 7 ; `--release` ne les reconstruit plus. Cette archive ne possède ni comptes distants ni notifications. Les performances et la réception des notifications sur deux téléphones physiques restent à observer pendant l’essai.

### Ergonomie iPhone

La version web privilégie les iPhone 17 Pro et 16 Pro Max : navigation permanente, contenu seul défilant, zones sûres et clavier pris en compte. Le dé conserve sa présence ; les modules secondaires sont compacts. La disparition de la bande sous le menu a été confirmée par l’utilisateur après relance sur iPhone 17 Pro sous iOS 27. Détails des changements et vérifications : [audit mobile du 3 novembre](dev/AUDIT_MOBILE.md).
