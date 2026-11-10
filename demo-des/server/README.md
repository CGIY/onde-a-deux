# D6 à deux — service de jeu

Le service utilise le moteur canonique `demo-des/dev/src/onde-app-core.js`, copié dans `functions/desir-game/core.js` avant déploiement. Les tirages, les dates et les deux coches sont traités côté serveur. Le navigateur reçoit uniquement la projection autorisée pour son compte.

## Configuration

Pour une base neuve, appliquer les schémas consolidés dans cet ordre :

1. `schema.sql` : tables, comptes fermés, sessions, quotas et transactions.
2. `push-schema.sql` : abonnements et livraisons Web Push.
3. `push-scheduler.sql` : échéancier des notifications et appel cron protégé.
4. `additive-device-index.sql` : index supplémentaire des appareils par compte.
5. `hardcore-schema.sql` : tables historiques du combat retiré, conservées pour la compatibilité administrative et les sauvegardes ; aucune route de jeu actuelle ne les utilise.
6. `portraits-schema.sql` : portraits privés du duo, lus par la fonction après vérification de la session.

Sur une base existante, appliquer uniquement les migrations manquantes de `migrations/`, dans l’ordre de leur version. Ne pas rejouer ces anciennes migrations par-dessus une installation des schémas consolidés : elles décrivent les états antérieurs de la base.

Pour les prolongations, appliquer `20261110215418_desir_task_reminder_deadline.sql` avant le déploiement de `desir-game`. Le planificateur peut alors créer un rappel à la nouvelle échéance, et le worker écarte un rappel encore en attente qui correspond à l’ancienne.

Pour la gestion des appareils, appliquer d’abord `20261110084051_desir_revoke_sessions.sql`, puis déployer la fonction `desir-game`, puis publier le client web. La fonction ne permet de révoquer que les sessions du compte appelant et retire les abonnements push des appareils révoqués. Pour une installation neuve par schémas consolidés, appliquer `revoke-sessions.sql` après `schema.sql` et `push-schema.sql`.

La migration `20261107222844_desir_daily_draw_counter.sql` corrige le compteur après `20261107131541_desir_daily_draw_pool.sql`. Le quota annonçait trois tirages, mais la clé primaire autorisait une seule ligne par compte et par journée : le deuxième tirage échouait avec `23505`, puis sa reprise automatique empêchait le rafraîchissement du client. Le compteur `draw_count`, borné de 1 à 3, conserve cette clé et l’horodatage initial. Chaque ligne existante vaut un tirage consommé ; les sessions, les reçus, l’état de jeu et le déclenchement des notifications restent inchangés. L’incrément conditionnel, le reçu et l’état sont validés dans la même transaction.

Créer une salle avec un état `G.createRoom()`, puis exactement deux lignes privées dans `desir_accounts`, acteurs `a` et `b`, même `room_id`. Les identifiants et noms affichés sont fournis à la base privée ; aucun nom réel ni mot de passe ne fait partie des sources publiques. Stocker uniquement des empreintes bcrypt coût 12, compatibles `extensions.crypt` (`$2a$` recommandé). La fonction refuse les mots de passe de plus de 72 octets, pour éviter la troncature bcrypt.

Les opérations `create` et `join` sont fermées. Le déploiement utilise `verify_jwt=false` pour cette fonction uniquement : ses sessions opaques ne sont pas des JWT Supabase Auth. Le handler vérifie lui-même chaque session, et les tables/RPC sont interdites à `anon`, `authenticated` et `PUBLIC`. Seul le rôle serveur peut les atteindre. Les RPC s’exécutent en `SECURITY INVOKER`.

Variables serveur : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (fournies par Supabase), `DESIR_ALLOWED_ORIGINS` facultatif (origines séparées par des virgules ; défaut `https://cgiy.github.io`), `DESIR_RATE_SECRET` facultatif (défaut secret serveur). Aucune clé serveur ne doit apparaître dans la configuration du navigateur.

Le module Push génère et conserve les clés VAPID côté serveur. Configurer le cron via `desir_configure_push_scheduler` avec l’URL Edge, un secret aléatoire dédié et éventuellement la clé publique du projet. Ce secret autorise uniquement `drain_push`, pas les comptes de jeu.

## API

Toutes les opérations utilisent `POST` JSON. Les requêtes du client indiquent `gameVersion:6` à la racine. Les réponses ne sont jamais mises en cache.

- `login` : `{op:"login", username, password}` et `Authorization: Bearer <session-prospective>`. Les identifiants sont normalisés en minuscules, sans accents ; le mot de passe reste exact. Le client génère et conserve auparavant 32 octets aléatoires encodés en base64url (43 caractères). La réponse ajoute `connection:{token,roomId,actor}`.
- `state` : session existante, retour du snapshot courant et expiration des tâches selon l’horloge serveur.
- `portraits` : session existante, portraits JPEG des membres de sa propre salle. Le client les conserve en mémoire.
- `action` : `{op:"action", requestId:<UUID>, action:{type,roundId,taskId?,checked?}}`.
- `hardcore` : ancienne route retirée ; protocole 6 → HTTP 410 `mode_removed`, avant tout RPC, reçu, présence ou mutation. Les protocoles antérieurs reçoivent d’abord `upgrade_required`.
- `push_config` : session existante, retour `{vapidPublicKey}`.
- `subscribe` : session existante, `{op:"subscribe",subscription:<PushSubscriptionJSON>}`.
- `drain_push` : réservé au cron avec l’en-tête `X-Desir-Cron`, réponse 202 après mise en file et traitement différé.

Snapshot : `{roomId,state,revision,actor,paired,quota,serverTime,badges?,roll?}`. `serverTime` est rafraîchi à chaque réponse, même lorsqu’un ancien reçu est rejoué, pour le décompte des vingt-quatre heures sur un téléphone dont l’horloge est décalée. `roll` ne figure que sur la réponse à un lancer autorisé. Les erreurs 409 de conflit ou de phase incluent le snapshot actuel. Le client ne doit pas remplacer un snapshot par une révision inférieure : une réponse idempotente ancienne peut être rejouée exactement.

Un snapshot de protocole 8 avec `canExtendTasks:true` annonce l’action `EXTEND_TASK`, qui prend le `taskId` d’une mission active. Elle ajoute 24 h à son échéance une seule fois et débite la réserve de l’acteur authentifié dans le même commit. La limite d’une dépense par jour de Paris est commune aux relances de carte et aux prolongations.

Le snapshot ajoute `badges`, projection versionnée du catalogue de 90 définitions `G.badgeCatalog` : 30 individuelles et 60 partagées. `G.badgeView(room, actor)` expose les progressions et gains individuels du lecteur ainsi que ceux du duo, sans les compteurs, calendriers ou gains privés du partenaire. Le registre interne `progression` reste réservé à l’état canonique du serveur ; il n’est pas inclus dans la projection de jeu `state`. Le champ reste optionnel dans le validateur de transport pour une reprise sans collection ; la dernière collection vérifiée de la même identité reste affichée jusqu’à la lecture enrichie. Les reçus des protocoles précédents ne sont jamais rejoués comme des commandes du protocole 6.

Les seuls types d’action exposés sont `ROLL_CATEGORY`, `ROLL_CARD`, `ROLL_VARIANT`, `REROLL_CARD`, `REROLL_CATEGORY`, `JOKER_DRAW`, `SEND`, `REFUSE_TASK`, `NEW_ROUND`, `TOGGLE_TASK_CHECK`. `REROLL_CATEGORY` est limitée à une fois par jour de Paris et par acteur (état `dailyReroll` de la salle) et ne consomme pas de ticket. `JOKER_DRAW` choisit la catégorie (champ `category`, 1–4) une fois par semaine ISO de Paris (état `joker` de la salle) et consomme un tirage du jour comme un `ROLL_CATEGORY`. Le quota est une cagnotte de trois tirages par jour de Paris renouvelée à 5 h (migrations `20261107131541_desir_daily_draw_pool.sql` puis `20261107222844_desir_daily_draw_counter.sql`). La carte du jour n’est plus générée et `SEND_DAILY`, `ACCEPT`, `PASS` ne sont plus exposés. Tout `actor`, `value`, `hand`, `at`, `directQueue` ou jeton de lancer envoyé par le client est rejeté. L’identité vient de la session ; le hasard et les horodatages viennent du serveur.

`SEND` ajoute directement le challenge à la liste partagée pour vingt-quatre heures et ouvre une nouvelle manche privée pour son initiateur. Le moteur conserve son ancien nom de phase interne `accepted`, marqué `directQueued:true`, mais `toConfirmed` reste faux : aucun accord du destinataire n’est fabriqué. `REFUSE_TASK` exige le `taskId` d’un challenge dont l’acteur est le destinataire. Le résultat D20 uniforme vient du serveur et est enregistré avec le reçu ; toutes les faces retirent le challenge, sans point ni ticket. Les deux coches de réalisation restent nécessaires pour ajouter un point commun.

## Intimité et Hardcore réunis

Les nouvelles manches utilisent `catalogueVersion:3`. La catégorie Intimité conserve sa pondération principale. Le serveur choisit ensuite le sous-pool classique ou Hardcore avec une probabilité de 50 % chacun ; ce choix, stocké dans la manche, ne consomme pas de ticket supplémentaire et ne produit pas d’animation de mode. Une relance de catégorie ou un joker Intimité effectue le même choix. Une relance de carte conserve le sous-pool et la main.

Chaque main contient six identifiants distincts. Le sous-pool classique utilise les six familles existantes, puis une variante uniforme D6. Le sous-pool Hardcore échantillonne six titres parmi les vingt identifiants `hardcore-01` à `hardcore-20`, sans filtrage des cartes vues ; le D6 de carte mène directement au brouillon. La main et la carte préparée restent privées jusqu’à l’envoi, comme les autres catégories.

Le challenge utilise ensuite les mêmes tâches, échéances, reçus, notifications, deux coches, points et badges. Les manches et tâches des catalogues 1 et 2 restent lisibles et terminables sans conversion des résultats déjà tirés. Les titres Hardcore existants sont repris sans réécriture.

Le client ne monte plus le contrôleur du combat et le handler ne charge plus son module. Les anciennes tables et sources historiques sont conservées, mais `op:hardcore` est fermé avant toute requête de base. Aucun maintien partagé, bail, acquittement, point de vie ou attaque n’est nécessaire au nouveau parcours. Cette publication ne réinitialise aucune partie et ne nécessite aucune migration SQL.

## Quotas et concurrence

Le client indique `gameVersion:6` à la racine des requêtes de jeu. L’état canonique de la salle utilise `version:2` et deux manches dans `lanes.a` et `lanes.b`, chacune appartenant à son initiateur. La séquence d’identifiants, les tâches, l’historique et les points restent communs. Le moteur conserve la lecture des anciennes sauvegardes et migre les états à manche unique.

Le snapshot contient `state` pour la manche personnelle et les tâches partagées. Les champs historiques `incoming` et `pendingOutgoing` restent lisibles pour la compatibilité des sauvegardes ; aucun nouvel envoi ne crée d’invitation. `drawAvailable` décrit la disponibilité réelle de la manche personnelle. Le client adresse chaque action de tirage à son `roundId` et chaque coche ou refus à son `taskId`.

Les clients des protocoles 1 à 5 reçoivent `upgrade_required` avant toute reprise de reçu ou mutation, y compris pour Hardcore. Le nouveau transport écarte une ancienne action persistée avant sa validation avec les types actuels, puis recharge le snapshot courant. Il ne transforme jamais un ancien envoi en commande du protocole 6. Les accès appareils sont conservés. Les notifications utilisent l’identifiant du challenge partagé, même lorsque l’initiateur a déjà changé de manche.

En semaine, le D4 de catégorie utilise 42 tickets équiprobables côté serveur : Complicité et Intimité en ont 11 chacune, Plaisirs et Projets en ont 10 chacun. Le samedi et le dimanche à Paris, les poids deviennent **22, 20, 20 et 93 sur 155**, soit **60 % exactement pour Intimité**. Le début du week-end se calcule à minuit, indépendamment de la fenêtre de quota à 5 h. Les relances de catégorie suivent la même règle ; les D6 de carte et, lorsqu’elle existe, de variante restent uniformes. Les 60 % du week-end couvrent les deux sous-pools : 30 % classique et 30 % Hardcore parmi les tirages de catégorie.

Chaque compte dispose de trois tirages par journée renouvelée à 5 h, heure de Paris. La consommation est enregistrée atomiquement avec le premier lancer de catégorie réussi. Les dés suivants de la manche ne consomment aucun ticket. Les changements d’heure sont calculés par PostgreSQL dans `Europe/Paris` ; la fenêtre quotidienne et son compteur remplacent l’ancien quota horaire.

La relance `REROLL_CARD` est disponible une fois par tour avant l’envoi, dans les anciennes manches comme dans les parcours modernes ; pour une carte classique moderne, elle retire aussi la variante choisie. Pour une carte Hardcore v3, elle mène directement au brouillon sans variante. Les commandes de l’ancienne négociation et d’acceptation sont refusées par l’API actuelle.

`quota` contient `{remaining:0|1|2|3,window,label,nextAt}`. `window` désigne le jour de la fenêtre locale (`YYYY-MM-DD`), `label` vaut « Aujourd’hui » ou « Cette nuit », et `nextAt` indique la prochaine échéance de 5 h en UTC ISO.

Une manche personnelle reste active par initiateur, soit deux manches en parallèle dans la salle. Les vingt-quatre heures d’un challenge commencent à l’envoi. Plusieurs challenges peuvent rester dans la liste pendant les nouveaux tours ; l’envoi libère immédiatement le prochain tour personnel.

Chaque écriture utilise une révision attendue et un verrou de ligne. Le reçu `(room,actor,requestId)` est créé dans la même transaction que le nouvel état, le ticket éventuel et la notification. Une requête répétée ne relance pas les dés et n’ajoute pas de points ni de notification. Les reçus restent sept jours ; la séquence de manche et les contraintes de phase continuent à empêcher les anciennes actions après cette durée. Le score et l’historique de jeu ne sont pas concernés par ce nettoyage.

## Progression et attribution des badges

Le registre des badges est mis à jour à partir de la transition confirmée du moteur, dans le même état et la même transaction que le challenge et son reçu. Un tirage initial réussi crédite son auteur, un envoi ayant réellement ajouté une tâche crédite une proposition, et seule la clôture après les deux coches crédite une réalisation. Les refus, expirations, relances et requêtes déjà traitées ne créent aucune réalisation supplémentaire. Les identifiants Hardcore comptent dans les catégories, réalisations et cartes distinctes ; ils ne créent aucune entrée de variante, ce qui préserve les critères exacts des cartes classiques.

Les compteurs individuels et partagés sont cumulatifs et bornés à des structures connues : quatre catégories, les cartes du catalogue, leurs variantes et au plus 120 attributions pour le duo (30 pour chaque personne, 60 partagées). Les dates d’activité individuelles appartiennent à l’auteur réel de l’action. Le calendrier partagé utilise les dates des clôtures. Les séries sont calculées sur les jours civils de Paris, y compris lors des changements d’heure.

Chaque définition a un identifiant stable, une portée, un seuil et un critère. L’attribution n’est créée qu’une fois. Son identifiant, sa date serveur et son ordre restent stables lors des rejeux et des actualisations. Les attributions partagées conservent un ordre pour chaque acteur ; la projection ne révèle donc pas, par des trous de séquence, les gains privés du partenaire. Une nouvelle génération après reset distingue les nouveaux gains des anciens marqueurs locaux.

Un ancien état sans registre reste lisible sans écriture supplémentaire. La reprise utilise uniquement les totaux cumulatifs et les événements encore prouvés ; elle n’invente ni date, ni rôle, ni variante disparue de l’historique. Les gains repris portent une date inconnue et sont présentés silencieusement. La première transition réelle persiste ce registre avant d’ajouter son propre événement, sans double comptage. Les lectures suivantes utilisent les compteurs persistés.

L'extension à 90 définitions conserve les 60 précédentes. Les 30 ajouts partagés demandent trois clôtures : quinze variantes classiques identifiées par `cardId` et `variantRoll`, et quinze cartes Hardcore identifiées par `cardId` seul. Un registre antérieur sans `catalogueVersion: 2` est projeté avec ses nouveaux gains déjà qualifiés, marqués `source: "imported"` et `at: null`, sans écriture en lecture. Le prochain événement crédité persiste cette reprise avant son propre incrément. Un compteur passant alors de deux à trois reçoit une attribution datée normale ; un compteur déjà à trois conserve un import silencieux. L'époque, les attributions anciennes et leurs séquences ne sont pas remplacées.

Le navigateur affiche les cinq gains les plus récents et conserve les identifiants des popups déjà présentés, séparément pour chaque service, duo et acteur. Ce stockage ne contient ni jeton d’accès ni contenu de challenge. La première visite sur un nouvel appareil établit un état initial silencieux ; les nouveaux gains sont ensuite présentés une fois sur ce navigateur. La collection synchronisée reste la référence des badges obtenus.

Le protocole 6 empêche les clients antérieurs de muter un état comportant le catalogue 3 et la progression des 90 badges. Les connexions enregistrées restent utilisables après rechargement. Un ancien moteur serveur qui ne comprend pas ces catalogues ou ne conserve pas `progression` ne doit plus être rétabli. Déployer et vérifier les sources de la fonction Edge avant de publier les nouveaux assets ; pour corriger un défaut, préserver les catalogues antérieurs et la progression dans le correctif suivant.

## Remise à zéro autorisée d’un duo

`reset-game.sql` est une opération administrative ponctuelle, sans route publique. Pour une remise à zéro explicitement demandée, vérifier la salle concernée et sa révision, puis fournir `desir.reset_room` et `desir.reset_revision` avec `set_config(..., true)` dans la même transaction que le script. Le verrou de salle et la révision attendue font échouer intégralement l’opération si la partie a changé entre la lecture et l’exécution.

Le script vide les points, l’historique, les cartes vues, les tâches, les invitations, les manches en cours, les compteurs de tirage et de relance, le joker et les reçus de commandes. Il ferme également la session Hardcore. Les noms, préférences, favoris, comptes, appareils, abonnements, secrets de configuration et limites de sécurité restent conservés. Les révisions du jeu normal et de Hardcore augmentent ; les deux nouvelles manches utilisent des identifiants supérieurs aux précédents. Une ancienne réponse ou une écriture déjà en vol ne peut donc pas remettre l’état précédent à sa place.

Les notifications en attente sont neutralisées, y compris celles déjà réclamées par un worker. Les clés de déduplication sont conservées et un rappel de dé disponible est supprimé pour la fenêtre quotidienne courante afin que le reset ne déclenche pas de notification artificielle. Le worker vérifie à nouveau la présence de l’événement et du challenge avant l’envoi. Les lectures ordinaires de l’état ne lancent plus de vidage redondant de la file Push ; les actions et le cron conservent ce traitement.

## Contrat de présentation

Les douze grades dépendent du seul total partagé `stats.totalCompleted` : paliers **5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45 et 50**. L’interface ne présente que le grade acquis le plus élevé ; aucun stockage ou RPC de grade supplémentaire n’est nécessaire. Le grade bleu ardoise reste distinct du panneau de score corail.

La charge du bouton ajuste le mouvement du dé, sans effet sur son résultat. Les pauses de présentation sont raccourcies et les dos des cartes n’ont plus d’apparition collective en transparence. Le D6 initial est incliné pour montrer trois faces. Ces choix concernent uniquement le renderer : les requêtes de tirage restent `{type,roundId}` et le serveur conserve le hasard. Ni `power`, ni un résultat, ni une orientation ne sont acceptés comme données de tirage.

Les contrôles de contraste, d’attente réseau, de cibles et de défilement sont documentés dans l’[audit UI/DA](../dev/AUDIT_UI_DA.md). Les calculs statiques ne remplacent ni le rendu navigateur ni les essais sur téléphone.

## Confidentialité

Avant envoi, le destinataire reçoit une manche neutre et valide, sans catégorie, carte, main, PV ou historique privé. `seen` n’est jamais envoyé. Après envoi, seule la carte choisie est révélée : les autres identifiants de la main sont remplacés par des leurres déterministes pour préserver le schéma du moteur, sans divulguer les autres tirages. Les noms des deux comptes ne sont retournés qu’après authentification. Les notifications n’incluent ni titre de carte ni identifiant privé.

Les sessions sont stockées uniquement sous leur SHA-256 et expirent après 90 jours d’inactivité. Les limites de requêtes stockent des seaux HMAC, jamais les IP brutes. Les réponses d’erreur ne répercutent aucun message SQL, mot de passe ou contenu de carte.

## Vérifier

```sh
node demo-des/server/tests/backend-check.mjs
node demo-des/server/tests/hardcore-check.mjs
node demo-des/server/tests/push-check.mjs
```

Les contrôles PostgreSQL embarqués utilisent `@electric-sql/pglite@0.5.14` et son vrai module pgcrypto, dans des bases neuves en mémoire. La CI exécute le schéma consolidé et le parcours de migration quotidien :

```sh
npm install --prefix /private/tmp/desir-sql-tools --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.14
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/postgres-check.mjs
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/daily-quota-check.mjs
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/hardcore-postgres-check.mjs
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/reset-game-check.mjs
```

Les tests backend couvrent les 144 variantes classiques, les 20 cartes Hardcore, les anciennes mains, les deux rôles, le quota, la compatibilité des clients, la confidentialité des dés et le rejeu concurrent d’une requête.

Le contrôle PostgreSQL vérifie aussi les mots de passe bcrypt, l’accès du rôle serveur, les sessions et le refus des lectures anonymes, sans compte réel ni accès au projet hébergé. `daily-quota-check.mjs` reproduit d’abord l’erreur du deuxième tirage sur les anciennes migrations, puis vérifie la conservation des données, la reprise de cette même requête, trois tirages autorisés, le quatrième refusé, les rejouages, les conflits de révision et le retour arrière transactionnel.

`reset-game-check.mjs` compare le résultat SQL au reset canonique du moteur. Il vérifie aussi le maintien des accès, l’absence d’effet sur une autre salle, le retour arrière après une erreur tardive, les révisions croissantes, les requêtes périmées et la neutralisation des anciennes notifications.

Avec Deno 2.9.6 : vérifier `functions/desir-game/index.ts` avec le `deno.json` et le lockfile fournis ; exécuter les tests d’import, de livraison et d’échéancier Push. `tests/database-check.sql` s’exécute après application du schéma comme propriétaire : il vérifie plages et DST, consommation atomique, CAS, rejouage, notifications et permissions dans une transaction intégralement annulée.

Documentation consultée : [authentification Edge](https://supabase.com/docs/guides/functions/auth-headers), [configuration par fonction](https://supabase.com/docs/guides/functions/function-configuration), [droits et RLS](https://supabase.com/docs/guides/api/securing-your-api), [changelog](https://supabase.com/changelog). Aucun changement de configuration Supabase Auth globale n’est requis.

## Déploiement et sauvegarde continus

Le workflow GitHub « D6 à deux — web checks » relance les tests, reconstruit la sortie connectée puis déploie `functions/desir-game` à chaque push sur `main`, dès que la variable de dépôt `DESIR_DEPLOY` vaut `true` et que le secret `SUPABASE_ACCESS_TOKEN` (jeton d'accès Supabase) existe. La vérification `git diff --exit-code` garantit que le moteur publié correspond aux sources ; le déploiement manuel reste possible avec les mêmes commandes.

Le workflow « D6 à deux — weekly encrypted backup » (lundi 03:17 UTC) exporte le schéma public via le pooler Supabase, chiffre le dump en AES-256 et le conserve 120 jours en artefact. Il requiert la variable `DESIR_BACKUP` à `true` et les secrets `SUPABASE_DB_PASSWORD` (mot de passe postgres du projet) et `DESIR_BACKUP_PASSPHRASE`. Aucun secret n'entre dans le dépôt ; l'artefact chiffré n'est lisible qu'avec la phrase secrète.
