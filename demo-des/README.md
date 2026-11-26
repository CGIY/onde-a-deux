# D6 à deux — version web 0.5.3

## Matière cosmique des dés

Pendant le lancer WebGL, la matière du dé devient un nuage de particules lumineuses traversé de filaments et de nappes spectrales. L'effet est calculé dans les coordonnées du dé et limité à sa géométrie réelle : aucun dessin flottant ajouté autour. La face redevient lisible à la fin du lancer et garde une irisation légère. Les cartes et le menu reprennent ces reflets ; le trait de liaison et le texte du résultat restent lumineux. Les étoiles disponibles scintillent lentement entre blanc et corail, avec des rythmes différents. L'effet ne dépend ni du résultat ni de la face choisie ; réduction des mouvements, arrière-plan et durées existantes sont respectés. Le rendu de secours conserve le dé minéral.

## Le choix du compagnon — 0.5.0

Le compagnon tire le nombre de variantes possibles puis choisit celle à réaliser. La carte Passer offre une seconde chance à l’expéditeur. Vingt-quatre constellations supplémentaires portent la collection à 144 titres. Les notifications disposent de cinquante titres en majuscules.

## Carnet allégé et fluidité — 0.4.17

Le Carnet conserve uniquement **Au fil des tirages** et **Réglages**. Les aides restent dans Réglages ; les comparatifs, le module hebdomadaire, leurs animations et leur chargement ne sont plus embarqués. Le vocabulaire Missions est harmonisé, les deux coches sont nommées explicitement et toucher l’onglet actif conserve la position. Une aide ouverte reste ouverte lors d’une actualisation des réglages.

Le rendu des dés évite les rayons hors de leur volume visible et les redessins à taille inchangée, en conservant leur matière, leur géométrie et leurs animations. Les limites sont vérifiées numériquement, y compris les bords adoucis. Le contrôle de l’aperçu mobile vérifie le rendu ; le gain de fluidité sur les téléphones physiques reste à observer. Les règles, les données de partie et l’archive Xcode sont conservées.

[Ouvrir D6 à deux](https://cgiy.github.io/onde-a-deux/demo-des/)

Les étoiles forment des constellations autour des profils et servent à relancer une carte ou à prolonger une mission. « Une idée à deux » se trouve dans Duo. Sur iPhone, la navigation utilise davantage le bas de l’écran.

Chaque personne se connecte sur son téléphone avec son identifiant et son mot de passe. Les deux comptes sont créés dans la base privée ; il n’y a ni inscription publique ni code d’association. Les noms ne sont retournés qu’après connexion. Le mot de passe n’est jamais conservé par l’application ; l’accès de cet appareil reste enregistré pour les prochaines ouvertures.

Au premier lancement sur cet appareil, un accueil résume le principe en trois phrases. « C’est parti » le ferme et mémorise ce choix pour les prochaines ouvertures.

Le tirage reste privé jusqu’à l’envoi du challenge. La proposition rejoint le compagnon, qui peut choisir sa variante ou passer. L’état, les tirages, les dates et le score sont partagés par le service. Une coupure du réseau conserve l’accès enregistré et propose « Réessayer » au lancement, ou signale l’indisponibilité dans la partie. Une action encore en attente garde son identifiant et n’empêche plus la lecture de l’état confirmé. Le retour du réseau ou de l’app relance l’actualisation ; un accès réellement révoqué demande une nouvelle connexion.

## Jouer

- Chaque personne prépare sa propre carte. Le D4 détermine le thème et le D8 choisit l’action dans le catalogue actuel.
- Proposer envoie l’action au compagnon. Le destinataire lance gratuitement un D6, y compris avec une réserve d’étoiles vide. Le résultat détermine combien de variantes distinctes sont proposées, de une à six.
- Les variantes sont échantillonnées sans doublon côté serveur parmi les six variantes existantes de la carte et du profil concerné. Le tirage reste identique après fermeture, actualisation, reconnexion ou reprise d’une requête.
- Le compagnon sélectionne une variante puis confirme. La confirmation crée la mission et démarre son délai de 24 h. Chacun coche sa case après réalisation et les deux coches rapportent un point commun.
- La carte « Une autre idée ? » permet de passer gratuitement, avant ou après le lancer des variantes. Le premier passage offre à l’expéditeur une relance du dé d’action dans la même catégorie, en excluant la carte passée. Cette relance n’utilise ni ticket ni étoile. L’expéditeur découvre le résultat puis décide de proposer cette nouvelle carte.
- Une seule relance offerte est disponible par proposition initiale. Passer la seconde carte termine la manche sans mission ni point. Les autres tirages personnels peuvent continuer pendant l’échange.
- Chaque personne conserve ses trois tirages quotidiens, renouvelés à 5 h à Paris, sa relance quotidienne du thème et le joker hebdomadaire existant. Le quota est consommé au tirage initial de catégorie.
- Après confirmation du choix, une case vide à l’échéance peut coûter une étoile au destinataire, dans la limite du solde et d’une pénalité par jour. Le passage gratuit intervient avant cette confirmation.
- Une étoile permet toujours de prolonger une mission active de 24 h, une fois par mission. La limite de dépense volontaire reste commune aux actions payantes existantes.
- Les anciennes manches restent jouables avec leur dé, leur catalogue et leur variante enregistrés. Le protocole 9 protège les nouvelles propositions contre les actions d’un client ancien.

Les notifications de réception, de changement de proposition, de disponibilité et de rappel utilisent cinquante titres et cinq textes par type d’événement. Titres et textes sont en majuscules. Leur contenu reste générique et les rappels conservent l’échéance réelle.

Les révélations de variantes sont décalées de 55 ms, sur une transition de 300 ms. Les animations utilisent le rendu de dés existant et respectent la réduction du mouvement, le passage en arrière-plan et la reprise réseau.

## Collection de badges

Chaque profil peut collectionner **144 constellations, dont 30 individuelles et 114 partagées**. « Nous » affiche les **cinq derniers débloqués** ; « Tout afficher » ouvre la galerie complète, avec les filtres « Tous », « À moi » et « À deux ». Toucher un médaillon montre son titre, sa condition exacte, sa progression et sa date de gain dans le même panneau. Les badges individuels du partenaire ne sont pas exposés.

Les 90 emblèmes originaux suivent la direction « Le trait complice » : scènes humaines en lignes souples ardoise, fonds mats pêche, ivoire, sauge et rose pâle, double contour discret. Cinq silhouettes composent la collection : cercle, écusson, hexagone arrondi, ovale et rosace. Chaque identifiant conserve une scène distincte ; les paliers d'une famille changent de geste et de contexte. Les situations intimes sont suggérées par les postures et les lieux, sans représentation sexuelle explicite. Le rendu verrouillé conserve la scène dans une palette atténuée. Les dessins vectoriels sont incorporés au jeu, sans requête d'image supplémentaire, et mis en cache côté interface. Leur version autonome est disponible dans la [galerie des emblèmes](badges/) et dans [l'archive des 90 SVG](badges/desir-badges.zip). Cette galerie publique montre les dessins et leurs conditions, sans progression de compte.

Les sources éditables sont séparées en vocabulaire de dessin (`onde-badge-drawing.js`), trois séries de trente scènes (`onde-badge-scenes-*.js`) et cadre commun (`onde-badge-frame.js`). Le build valide l'ordre et la couverture du catalogue avant de générer le module autonome `onde-badge-art.js`, les SVG et leur archive. L'application, la collection et le popup utilisent ainsi exactement le même dessin.

Les critères couvrent les tirages, les propositions, les réalisations, les catégories, la diversité des cartes et variantes, les jours d’activité et les jalons communs. Les réalisations Hardcore comptent pour les totaux, la catégorie Intimité et les badges de cartes différentes. Les badges de variantes gardent leurs critères et identifiants : une carte Hardcore sans variante ne remplace pas une variante classique. Les réalisations ne comptent qu’après les deux coches. Un refus, une expiration ou le rejeu d’une requête n’ajoute aucune réalisation. Les jours sont calculés à Paris à partir des actions de la personne concernée ; cocher aujourd’hui ne crée pas une journée d’activité pour le partenaire qui avait coché hier.

Les compteurs et les gains sont persistés dans l’état du duo, indépendamment des 80 lignes d’historique conservées. Un badge gagné reste acquis jusqu’à une remise à zéro explicite. Les variantes précises ont leur propre critère : trois réalisations d’une carte avec une autre variante ne débloquent pas le badge de celle-ci. Les trente ajouts portent sur quinze variantes Intimité précises et quinze cartes Hardcore, avec un seuil de trois réalisations. Ils ne modifient aucune des soixante définitions précédentes.

À la mise à jour, les nouveaux badges déjà justifiés par les compteurs cumulatifs sont repris silencieusement, sans inventer de date de gain. Un seuil franchi par une nouvelle réalisation déclenche normalement son popup. Les identifiants, dates et ordres des attributions précédentes restent conservés ; cette mise à jour ne remet aucune progression à zéro.

Un gain déclenche une notification dans l’app avec son titre et un accès à la collection. Plusieurs gains attendent leur tour ; la présentation respecte les lancers en cours, les panneaux ouverts, la visibilité de la page et la préférence de mouvement réduit. Les actualisations et reconnexions sur le même navigateur ne répètent pas les gains déjà présentés. La première ouverture sur un nouveau navigateur établit silencieusement la liste des gains existants ; la collection reste consultable. Aucun abonnement Push supplémentaire n’est nécessaire.

## Installer et recevoir les notifications

Sur iPhone ou iPad, ouvrir l’app dans Safari puis **Partager → Sur l’écran d’accueil**. Ouvrir ensuite D6 à deux depuis cette icône, se connecter et toucher **Info → Réglages → Activer les notifications**. Les notifications Web nécessitent iOS/iPadOS 16.4 ou plus et l’app ajoutée à l’écran d’accueil. Sur les autres navigateurs compatibles, le même bouton demande l’autorisation.

L’icône représente un dé minéral à deux points cyan et mauve. Elle est fournie en PNG opaque de 180 px pour iPhone et de 192/512 px pour l’installation web, avec le manifeste et les métadonnées Apple.

Les notifications signalent un nouveau challenge, un dé disponible ou un challenge approchant de son expiration (trois heures avant l'échéance). Quand une mise à jour de l'app est prête, un bandeau « Recharger » apparaît en bas de l'écran. Le passage au nouveau protocole peut imposer ce rechargement avant la prochaine action ; les accès enregistrés sont conservés. Leur texte reste générique, sans titre de carte. Aucune demande d’autorisation n’apparaît automatiquement. Au premier plan, les changements sont également actualisés périodiquement et lors du retour dans l’app.

## Direction artistique

La carte affiche le détail tiré. Les anciennes manches conservent leurs phrases d’origine. Le carnet Info rassemble les repères sur la libido de la page de référence, les tirages personnels, les cartes partagées et les réglages. Le score commun et les grades restent les éléments du jeu.

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

Le générateur place le transport et le moteur de médaillons avant l’interface, copie les ressources PWA dans l’aperçu et synchronise le moteur canonique vers la fonction serveur. Il vérifie la couverture exacte du catalogue par les dessins, puis exporte les SVG, leur manifeste, la galerie et l'archive reproductible. Le déploiement du service reste une étape distincte : voir [le guide serveur](server/README.md). La version web transmet le protocole de jeu 9 à la fonction Edge `desir-game`. Les actions en attente des protocoles 6 et 7 gardent leur identifiant de reprise. Si le serveur les refuse définitivement, le client recharge la partie avec la connexion existante.

```sh
python3 demo-des/dev/tests/onde-build-check.py
node demo-des/dev/tests/onde-remote-check.cjs
node demo-des/dev/tests/onde-remote-ui-check.cjs
node demo-des/dev/tests/onde-visibility-check.cjs
node demo-des/dev/tests/onde-reroll-check.cjs
node demo-des/dev/tests/onde-direct-flow-check.cjs
node demo-des/dev/tests/onde-badges-check.cjs
node demo-des/dev/tests/onde-badge-expansion-check.cjs
node demo-des/dev/tests/onde-badge-art-check.cjs
node demo-des/dev/tests/onde-weekend-check.cjs
node demo-des/dev/tests/onde-intimacy-mix-check.cjs
node demo-des/server/tests/backend-check.mjs
node demo-des/server/tests/push-check.mjs
```

Les contrôles automatisés couvrent les 144 variantes classiques et les 20 cartes Hardcore, les manches antérieures, la confidentialité des tirages, la relance et les points. Ils ne constituent pas un essai physique sur iPhone.

Les anciennes parties migrent automatiquement vers les deux manches personnelles, en conservant les cartes, tâches, points et historiques. Rouvrir l’app charge le protocole de connexion correspondant.

Le développement Xcode est mis de côté pendant l’essai web. Le [ZIP Xcode](ONDE-Xcode.zip) et son HTML embarqué restent l’archive locale du build 7 ; `--release` ne les reconstruit plus. Cette archive ne possède ni comptes distants ni notifications. Les performances et la réception des notifications sur deux téléphones physiques restent à observer pendant l’essai.

### Ergonomie iPhone

La version web privilégie les iPhone 17 Pro et 16 Pro Max : navigation permanente, contenu seul défilant, zones sûres et clavier pris en compte. Le dé conserve sa présence ; les modules secondaires sont compacts. La disparition de la bande sous le menu a été confirmée par l’utilisateur après relance sur iPhone 17 Pro sous iOS 27. Détails des changements et vérifications : [audit mobile du 3 novembre](dev/AUDIT_MOBILE.md).
