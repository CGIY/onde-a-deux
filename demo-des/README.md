# Dés·ir — version web 0.3.0

[Ouvrir Dés·ir](https://cgiy.github.io/onde-a-deux/demo-des/)

Chaque personne se connecte sur son téléphone avec son identifiant et son mot de passe. Les deux comptes sont créés dans la base privée ; il n’y a ni inscription publique ni code d’association. Les noms ne sont retournés qu’après connexion. Le mot de passe n’est jamais conservé par l’application ; l’accès de cet appareil reste enregistré pour les prochaines ouvertures.

Au premier lancement sur cet appareil, un accueil résume le principe en trois phrases. « C’est parti » le ferme et mémorise ce choix pour les prochaines ouvertures.

Le tirage reste privé jusqu’à l’envoi de la proposition. L’autre personne reçoit alors une invitation qu’elle peut ouvrir et traiter plus tard. L’état, les tirages, les dates et le score sont partagés par le service ; une coupure du réseau conserve l’écran de connexion ou signale l’indisponibilité, sans créer de partie locale de remplacement.

## Jouer

- Six catégories : Complicité, Détente, Projets, Attentions, Bouffe et Intimité. Le D6 choisit la catégorie ; le D4 révèle l’une des quatre cartes cachées. Aucun catalogue ne dévoile les cartes.
- Avant l’envoi et avant de commencer son D20, la personne qui tire peut relancer le D4 une fois. Une autre carte de la même main est garantie. Cette relance supprime son D20 pour cette carte ; le destinataire garde le sien. Aucun point n’est retiré et aucun ticket supplémentaire n’est consommé.
- Chaque personne dispose d’un tirage D6 puis D4 par plage de Paris : 6–12 h, 12–18 h, 18–6 h. Le ticket est consommé uniquement par le D6 réussi. La prochaine disponibilité apparaît à sa place lorsqu’il est utilisé.
- Une seule manche active. Les rôles alternent au nouveau tour ; une invitation en attente garde sa place jusqu’à sa réponse. Les plages ne créent pas de manches parallèles.
- Proposer directement ou tenter le D20 : deux jets maximum par personne, dont la somme doit atteindre les PV de la carte. Deux jets insuffisants de la personne qui tire envoient automatiquement la proposition à l’autre. Un envoi automatique nécessite ensuite les deux confirmations.
- Une action validée à deux rejoint « À faire » pour six heures. Chacun coche sa propre case ; les deux coches retirent l’action et ajoutent un point commun. L’expiration ou le D20 ne rapporte aucun point. Plusieurs actions validées peuvent rester en attente pendant un nouveau tour.

Maintenir le bouton charge visuellement le dé : le maximum est atteint après **1 200 ms**, avec **deux à cinq tours** selon la durée de maintien. Un clic court reste possible ; au clavier, Espace permet le maintien et Entrée le clic immédiat. La puissance change seulement le mouvement, jamais le résultat, les PV, les points ou le quota. Le lancer animé dure entre **1 650 et 2 500 ms** ; une attente réseau est signalée séparément. Le D6 au repos est incliné pour laisser voir trois faces.

Les PV restent des premières estimations. La jauge montre les PV restants et les deux résultats. Les opérations sont confirmées côté serveur : une réponse répétée ne relance pas un dé et ne compte pas deux fois un point.

Dans « Nous », seul le grade le plus élevé atteint est affiché. Douze paliers suivent le score commun : **5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45 et 50 points**. Le nouveau grade remplace le précédent avec une courte transition. Sa palette bleu ardoise désaturé le distingue du score corail. Aucun nom de grade futur n’est affiché ; la barre indique seulement les points restant avant le prochain. Avant 5 points, un repère discret annonce le premier palier. Les grades suivent le total cumulé, même quand les anciennes actions quittent l’historique.

## Installer et recevoir les notifications

Sur iPhone ou iPad, ouvrir l’app dans Safari puis **Partager → Sur l’écran d’accueil**. Ouvrir ensuite Dés·ir depuis cette icône, se connecter et toucher **Nous → Activer les notifications**. Les notifications Web nécessitent iOS/iPadOS 16.4 ou plus et l’app ajoutée à l’écran d’accueil. Sur les autres navigateurs compatibles, le même bouton demande l’autorisation.

L’icône D6 sauge est fournie en PNG 180 px pour iPhone et 192/512 px pour l’installation web, avec le manifeste et les métadonnées Apple. Elle est opaque et conserve les matières et couleurs de l’application.

Les notifications signalent une invitation, une réponse, un dé disponible ou une action approchant de son expiration. Leur texte reste générique, sans titre de carte. Aucune demande d’autorisation n’apparaît automatiquement. Au premier plan, les changements sont également actualisés périodiquement et lors du retour dans l’app.

## Matières et statistiques

La forme de l’application est conservée : rubber, suédine, pigments minéraux et grain statique. Le score commun et les accents passent au corail grisé, avec une texture propre au panneau pour rester visible. Pressions, révélations, jauge et cases en vague respectent la réduction du mouvement du système. Projets utilise le bleu ardoise, distinct du mauve Intimité ; l’ombre des dés reste discrète. Le chiffre du résultat s’éclaire progressivement en blanc ivoire brillant à la fin du lancer, y compris dans le rendu de secours.

L’[audit UI et direction artistique](dev/AUDIT_UI_DA.md) distingue les défauts mesurables, leurs corrections et les préférences de présentation. Les contrôles visuels réels et les limites matérielles y sont consignés séparément des calculs de couleur.

Les 88 cartes disposent de 88 résultats chiffrés distincts, dont 72 en pourcentage. Source, population, mesure et limites figurent dans « Source & contexte ». Plusieurs repères concernent un thème connexe : aucun bénéfice spécifique n’est attribué à une pratique sans étude correspondante. Les résultats ne sont pas des promesses individuelles. `card-evidence.json` contient leur traçabilité.

## Construire et vérifier

Les sources modifiables sont dans `dev/src/`. Les trois commandes suivantes écrivent l’aperçu dans `dev/dist/` :

```sh
python3 demo-des/dev/build.py              # démo locale isolée, sans connexion
python3 demo-des/dev/build.py --connected  # aperçu avec les comptes du service
python3 demo-des/dev/build.py --release    # aperçu connecté + index.html public
```

Un aperçu doit être servi par HTTP local. Les modes connectés lisent `config.js`, qui ne contient que l’URL du service et sa clé publiable. Ces paramètres sont incorporés au HTML pour éviter qu’un chargement de configuration manquant déclenche le mode démo. Une configuration manquante ou invalide bloque la construction connectée. Aucun identifiant, mot de passe ni secret serveur ne doit être ajouté à ce fichier.

Le générateur contrôle la couverture et l’unicité des repères, place le transport avant l’interface, copie les ressources PWA dans l’aperçu et synchronise le moteur canonique vers la fonction serveur. Le déploiement du service reste une étape distincte : voir [le guide serveur](server/README.md). La fonction Edge `desir-game` **version 3** est déployée pour cette révision.

```sh
python3 demo-des/dev/tests/onde-build-check.py
node demo-des/dev/tests/onde-remote-check.cjs
node demo-des/dev/tests/onde-remote-ui-check.cjs
node demo-des/dev/tests/onde-visibility-check.cjs
node demo-des/dev/tests/onde-reroll-check.cjs
node demo-des/server/tests/backend-check.mjs
node demo-des/server/tests/push-check.mjs
```

Vérifications automatisées de cette révision : **234 contrôles UI**, **102 transport**, **790 backend** et **1 003 assertions de relance D4**, en plus des contrôles des règles, statistiques, tâches, dés et ressources PWA. Elles ne constituent pas un essai physique sur iPhone.

Le développement Xcode est mis de côté pendant l’essai web. Le [ZIP Xcode](ONDE-Xcode.zip) et son HTML embarqué restent l’archive locale du build 7 ; `--release` ne les reconstruit plus. Cette archive ne possède ni comptes distants ni notifications. Les performances et la réception des notifications sur deux téléphones physiques restent à observer pendant l’essai.

### Ergonomie iPhone

La version web privilégie les iPhone 17 Pro et 16 Pro Max : navigation permanente, contenu seul défilant, zones sûres et clavier pris en compte. Le dé conserve sa présence ; les modules secondaires sont compacts. Détails des changements et vérifications : [audit mobile du 3 novembre](dev/AUDIT_MOBILE.md).
