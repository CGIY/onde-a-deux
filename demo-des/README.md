# D6 à deux — version web 0.4.10

[Ouvrir D6 à deux](https://cgiy.github.io/onde-a-deux/demo-des/)

Les étoiles forment des constellations autour des profils et servent à relancer une carte ou à prolonger une mission. « Une idée à deux » se trouve dans Duo. Sur iPhone, la navigation utilise davantage le bas de l’écran.

Chaque personne se connecte sur son téléphone avec son identifiant et son mot de passe. Les deux comptes sont créés dans la base privée ; il n’y a ni inscription publique ni code d’association. Les noms ne sont retournés qu’après connexion. Le mot de passe n’est jamais conservé par l’application ; l’accès de cet appareil reste enregistré pour les prochaines ouvertures.

Au premier lancement sur cet appareil, un accueil résume le principe en trois phrases. « C’est parti » le ferme et mémorise ce choix pour les prochaines ouvertures.

Le tirage reste privé jusqu’à l’envoi du challenge. Il rejoint alors directement « À faire », sans invitation à accepter. L’état, les tirages, les dates et le score sont partagés par le service. Une coupure du réseau conserve l’accès enregistré et propose « Réessayer » au lancement, ou signale l’indisponibilité dans la partie. Une action encore en attente garde son identifiant et n’empêche plus la lecture de l’état confirmé. Le retour du réseau ou de l’app relance l’actualisation ; un accès réellement révoqué demande une nouvelle connexion.

## Jouer

Dans Info → Réglages, chaque personne peut déconnecter cet appareil ou retirer l’accès de ses autres appareils. Le compte et les appareils du partenaire ne sont pas concernés. Une action encore en attente doit d’abord être confirmée.

Pour lancer le dé, touche-le ou fais-le glisser dans la direction de ton choix. Un appui maintenu donne plus d’élan. Le résultat reste choisi par le serveur.

- **D4 catégorie → D6 challenge → variante D6 si la carte en possède une.** Complicité réunit les moments à deux et la détente ; Plaisirs, les attentions et la cuisine. Avec Projets et Intimité, le catalogue classique conserve ses 24 challenges et 144 variantes. Les 20 cartes Hardcore existantes rejoignent Intimité, soit 164 résultats au total. Les mains comportent toujours six cartes et le D6 reste uniforme. Les anciennes manches conservent leur carte et leur parcours.
- Chaque personne dispose de **trois tirages par jour** (heure de Paris), renouvelés à 5 h. Seul le dé de catégorie réussi consomme un tirage. La prochaine disponibilité apparaît à sa place lorsque la cagnotte est vide. **Une relance du thème (D4) gratuite est en plus disponible une fois par jour et par personne**, utilisable avant le tirage de la carte ; elle ne consomme aucun ticket. Une fois par **semaine** (heure de Paris), un **joker** permet en plus de choisir sa catégorie au lieu du D4 : les quatre thèmes deviennent cliquables pendant un tour. Après une carte résolue ou passée, le tour suivant se relance automatiquement au bout de quelques secondes.
- Le samedi et le dimanche, de minuit le samedi à minuit le lundi **heure de Paris**, **Intimité a exactement 60 % de probabilité** au D4. Les 40 % restants conservent le rapport 11:10:10 entre Complicité, Plaisirs et Projets : les tickets sont donc 22, 20, 20 et 93 sur 155. La semaine conserve les poids 11, 10, 10 et 11 sur 42. La relance du thème suit la même pondération ; le joker reste un choix direct.
- Quand le D4 tombe sur **Intimité**, le serveur choisit à parts égales le catalogue classique ou Hardcore. Ce choix ne demande aucun dé supplémentaire : une main de six cartes apparaît dans le parcours habituel. Pour Hardcore, les six cartes sont échantillonnées uniformément sans doublon parmi les vingt titres existants, sans favoriser les cartes non vues. Le D6 sélectionne directement la carte finale ; aucune variante factice n’est ajoutée. Le combat, les PV et l’écran de session séparé sont retirés. Les deux types de cartes utilisent la même liste « À faire », les deux coches, le point commun et les badges.
- Chaque joueur dispose de sa propre manche. Chacun peut tirer pendant que l’autre prépare sa carte. Envoyer un challenge libère immédiatement un nouveau tirage personnel, dans la limite des tickets disponibles.
- **Relancer, proposer, réaliser ou refuser.** Une relance de carte gratuite est disponible une fois par tour avant l’envoi ; pour une carte classique moderne, elle retire aussi la variante déjà choisie ; pour Hardcore, elle donne directement une autre carte de la même main. Le sous-pool reste fixé pendant la manche ; relancer la catégorie effectue un nouveau choix à 50/50. L’envoi place le challenge dans « À faire » pour vingt-quatre heures. Le destinataire peut choisir **Refuser · D20** : le serveur tire un D20 uniforme, le dé s’anime puis le challenge est retiré. Toutes les faces respectent le refus, sans point ni consommation de ticket.
- Chacun coche sa propre case pour signaler la réalisation ; les deux coches retirent le challenge et ajoutent un point commun. L’expiration ou le refus ne rapporte aucun point. L’ajout à la liste ne vaut pas accord du destinataire. Plusieurs challenges peuvent rester dans la liste pendant un nouveau tour.
- Dans **Missions**, chacun peut dépenser une étoile de sa réserve pour ajouter **24 h à l’échéance** d’un challenge en cours. La prolongation s’applique aux deux profils, une seule fois par challenge. La limite d’une étoile par jour et par personne (heure de Paris) est commune aux relances et aux prolongations.
- À l’échéance d’une nouvelle mission, le destinataire perd une étoile si sa case est vide, dans la limite de son solde et d’une étoile perdue par jour (heure de Paris). Le rappel trois heures avant l’échéance indique le risque de perdre une étoile si le malus peut s’appliquer. À zéro étoile, les dés attendent la recharge. Le refus reste possible sans lancer le D20.

Le remplissage du bouton évolue du sable au corail pendant le maintien, avec un léger frémissement visuel qui suit la charge. Un clic court reste possible ; au clavier, Espace permet le maintien et Entrée le clic immédiat. La puissance change seulement le mouvement, jamais le résultat, les points ou le quota. Une attente réseau est signalée séparément. Les dés au repos gardent une orientation inclinée. Les pauses après résultat passent de 1 800 à 450 ms pour la catégorie et de 2 800 à 900 ms pour la carte. Les dos des cartes apparaissent directement avec leur couleur et leur grain ; aucun fondu collectif ne retarde leur matière. Seule la carte sélectionnée se révèle avant le dé de variante. Les actualisations inchangées ne reconstruisent pas la grille.

Les opérations sont confirmées côté serveur : une réponse répétée ne relance pas un dé et ne compte pas deux fois un point.

Dans « Nous », seul le grade le plus élevé atteint est affiché. Douze paliers suivent le score commun : **5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45 et 50 points**. Le nouveau grade remplace le précédent avec une courte transition. Sa palette bleu ardoise désaturé le distingue du score corail. Aucun nom de grade futur n’est affiché ; la barre indique seulement les points restant avant le prochain. Avant 5 points, un repère discret annonce le premier palier. Les grades suivent le total cumulé, même quand les anciennes actions quittent l’historique.

## Collection de badges

Chaque profil peut collectionner **90 badges : 30 individuels et 60 partagés**. « Nous » affiche les **cinq derniers débloqués** ; « Tout afficher » ouvre la galerie complète, avec les filtres « Tous », « À moi » et « À deux ». Toucher un médaillon montre son titre, sa condition exacte, sa progression et sa date de gain dans le même panneau. Les badges individuels du partenaire ne sont pas exposés.

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

Le générateur place le transport et le moteur de médaillons avant l’interface, copie les ressources PWA dans l’aperçu et synchronise le moteur canonique vers la fonction serveur. Il vérifie la couverture exacte du catalogue par les dessins, puis exporte les SVG, leur manifeste, la galerie et l'archive reproductible. Le déploiement du service reste une étape distincte : voir [le guide serveur](server/README.md). La version web transmet le protocole de jeu 8 à la fonction Edge `desir-game`. Les actions en attente des protocoles 6 et 7 gardent leur identifiant de reprise. Si le serveur les refuse définitivement, le client recharge la partie avec la connexion existante.

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
