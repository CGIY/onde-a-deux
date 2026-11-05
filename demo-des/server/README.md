# Dés·ir — service de jeu

Le service utilise le moteur canonique `demo-des/dev/src/onde-app-core.js`, copié dans `functions/desir-game/core.js` avant déploiement. Les tirages, les dates, les PV et les deux coches sont traités côté serveur. Le navigateur reçoit uniquement la projection autorisée pour son compte.

## Configuration

Appliquer dans cet ordre :

1. `schema.sql` : tables, comptes fermés, sessions, quotas et transactions.
2. `push-schema.sql` : abonnements et livraisons Web Push.
3. `push-scheduler.sql` : échéancier des notifications et appel cron protégé.
4. `additive-device-index.sql` : index supplémentaire des appareils par compte.
5. `migrations/20261105105858_desir_parallel_rounds.sql` : disponibilité des deux manches et identifiants des notifications.
6. `migrations/20261105131855_desir_hardcore_live.sql` : sessions Hardcore privées et versionnées, reçus et validation de session en lecture seule.

Les fichiers de `migrations/` reproduisent les migrations appliquées sur le projet hébergé. Les dates de version proviennent de son historique Supabase.

Créer une salle avec un état `G.createRoom()`, puis exactement deux lignes privées dans `desir_accounts`, acteurs `a` et `b`, même `room_id`. Les identifiants et noms affichés sont fournis à la base privée ; aucun nom réel ni mot de passe ne fait partie des sources publiques. Stocker uniquement des empreintes bcrypt coût 12, compatibles `extensions.crypt` (`$2a$` recommandé). La fonction refuse les mots de passe de plus de 72 octets, pour éviter la troncature bcrypt.

Les opérations `create` et `join` sont fermées. Le déploiement utilise `verify_jwt=false` pour cette fonction uniquement : ses sessions opaques ne sont pas des JWT Supabase Auth. Le handler vérifie lui-même chaque session, et les tables/RPC sont interdites à `anon`, `authenticated` et `PUBLIC`. Seul le rôle serveur peut les atteindre. Les RPC s’exécutent en `SECURITY INVOKER`.

Variables serveur : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (fournies par Supabase), `DESIR_ALLOWED_ORIGINS` facultatif (origines séparées par des virgules ; défaut `https://cgiy.github.io`), `DESIR_RATE_SECRET` facultatif (défaut secret serveur). Aucune clé serveur ne doit apparaître dans la configuration du navigateur.

Le module Push génère et conserve les clés VAPID côté serveur. Configurer le cron via `desir_configure_push_scheduler` avec l’URL Edge, un secret aléatoire dédié et éventuellement la clé publique du projet. Ce secret autorise uniquement `drain_push`, pas les comptes de jeu.

## API

Toutes les opérations utilisent `POST` JSON. Les réponses ne sont jamais mises en cache.

- `login` : `{op:"login", username, password}` et `Authorization: Bearer <session-prospective>`. Les identifiants sont normalisés en minuscules, sans accents ; le mot de passe reste exact. Le client génère et conserve auparavant 32 octets aléatoires encodés en base64url (43 caractères). La réponse ajoute `connection:{token,roomId,actor}`.
- `state` : session existante, retour du snapshot courant et expiration des tâches selon l’horloge serveur.
- `action` : `{op:"action", requestId:<UUID>, action:{type,roundId,taskId?,checked?}}`.
- `hardcore` : session existante, `{op:"hardcore",gameVersion:3,action:null|<commande>,requestId?:<UUID>}`, retour `{session,revision,actor,serverTime}` ; contrat détaillé ci-dessous.
- `push_config` : session existante, retour `{vapidPublicKey}`.
- `subscribe` : session existante, `{op:"subscribe",subscription:<PushSubscriptionJSON>}`.
- `drain_push` : réservé au cron avec l’en-tête `X-Desir-Cron`, réponse 202 après mise en file et traitement différé.

Snapshot : `{roomId,state,revision,actor,paired,quota,serverTime,roll?}`. `serverTime` est rafraîchi à chaque réponse, même lorsqu’un ancien reçu est rejoué, pour le décompte des six heures sur un téléphone dont l’horloge est décalée. `roll` ne figure que sur la réponse à un lancer autorisé. Les erreurs 409 de conflit ou de phase incluent le snapshot actuel. Le client ne doit pas remplacer un snapshot par une révision inférieure : une réponse idempotente ancienne peut être rejouée exactement.

Les seuls types d’action exposés sont `ROLL_CATEGORY`, `ROLL_CARD`, `ROLL_VARIANT`, `REROLL_CARD`, `CHALLENGE_DRAFT`, `ROLL_DRAFT_DEFENSE`, `SEND`, `CHALLENGE`, `ROLL_DEFENSE`, `ACCEPT`, `NEW_ROUND`, `TOGGLE_TASK_CHECK`. Tout `actor`, `value`, `hand`, `at` ou jeton de lancer envoyé par le client est rejeté. L’identité vient de la session ; le hasard et les horodatages viennent du serveur.

## Lancement Hardcore à deux

Le mode possède sa propre session par duo dans `desir_hardcore_sessions`. Ses révisions restent croissantes même lorsqu’une nouvelle session remplace la précédente. Il ne modifie ni les manches normales, ni les tickets, ni les points ou notifications. `desir_hardcore_auth` valide à chaque requête le jeton, son expiration, sa révocation et les deux comptes actifs, sans réécrire les présences toutes les 500 ms. Toutes les nouvelles tables ont RLS activé ; leurs droits et ceux de leurs RPC sont réservés à `service_role`, en `SECURITY INVOKER` avec `search_path` vide.

`action:null` lit la session, ou renvoie `session:null` lorsqu’aucune n’existe. Les commandes sont `CREATE`, `OPT_IN {sessionId,enabled}`, `PRESS {sessionId,pressId,sequence,held}`, `ACK {sessionId,preparationId,pressId}`, `ATTACK {sessionId,slot:1|2}` et `CANCEL {sessionId}`. Chaque mutation porte un UUID `requestId` distinct. Les reçus portent `(roomId,actor,requestId)` ; un rejeu rend l’état courant, sans nouveau tirage. Un identifiant réutilisé avec un autre contenu est refusé. L’acteur, le résultat, la catégorie, les dégâts ou l’horloge ne sont jamais acceptés du client.

Chaque compte valide son propre accord, puis maintient son bouton. Les appuis ont un bail de deux secondes, renouvelé toutes les 500 ms. Le chevauchement des deux comptes prépare le lancer ; les deux écrans acquittent automatiquement la préparation tout en maintenant leur appui. Le second acquittement programme un départ commun 1 100 ms plus tard et une révélation 2 200 ms après ce départ. Le serveur utilise son heure courante après les lectures et à chaque tentative CAS : un retard de base ne prolonge pas un ancien appui. Les numéros de séquence et les identifiants fermés empêchent un maintien retardé de rouvrir un bouton relâché, même si le relâchement est arrivé avant son premier maintien.

Après les deux acquittements, le résultat engagé est livré aux deux écrans avec son calendrier de départ futur : les animations peuvent ainsi démarrer à cette échéance, sans attendre une lecture réseau après le départ. L’interface ne dévoile la face et son titre qu’à la révélation. Une préparation annulée avant le départ conserve son résultat déjà choisi uniquement côté serveur, pour empêcher une annulation sélective de relancer le dé. Le client doit envoyer le relâchement immédiatement sur `pointerup`, `pointercancel`, perte de focus ou écran masqué, hors de la file du jeu normal. Une coupure est rattrapée par l’expiration du bail. Après le départ engagé, relâcher laisse finir le dé ; `CANCEL` et le retrait d’accord restent disponibles et annulent toute la session. La session expire après trente minutes. `desir_hardcore_settings.enabled=false` bloque aussi les appels directs, indépendamment du chemin caché de l’interface.

Le D20 commun sélectionne l’action et ne compte aucun dégât. Le boss a 48 PV. Chaque compte dispose d’exactement deux emplacements d’attaque D20 ; un emplacement déjà utilisé ne retire jamais de dégâts une seconde fois, même avec un autre `requestId`. Les quatre jets restent disponibles lorsqu’une victoire est atteinte après trois jets. Chaque impact possède son calendrier commun ; les dégâts sont dérivés une seule fois du registre serveur, aux échéances prévues. Après les quatre impacts : victoire pour une somme ≥ 48, soit 51 625 combinaisons sur 160 000 (**32,265625 %**), sinon défaite. Aucune issue n’accepte automatiquement une action.

Le client ignore une révision inférieure, mais accepte une révision identique avec une heure serveur plus récente : la révélation, les impacts et l’expiration sont dérivés du temps. Pendant un maintien, la réponse du renouvellement remplace la lecture périodique, afin de rester sous les limites de requêtes existantes. Le flux rapide n’est utilisé que lorsque l’écran Hardcore est ouvert. Une connexion Internet ne garantit pas un démarrage à la même image en cas de suspension ou coupure ; la reprise conserve le résultat et le calendrier autoritaires.

## Quotas et concurrence

Le client indique `gameVersion:3` à la racine des requêtes de jeu. L’état canonique de la salle utilise `version:2` et deux manches dans `lanes.a` et `lanes.b`, chacune appartenant à son initiateur. La séquence d’identifiants, les tâches, l’historique et les points restent communs. Le moteur migre les anciens états à manche unique lors de la première requête du nouveau client.

Le snapshot contient `state` pour la manche personnelle et `incoming` pour la manche reçue, uniquement lorsqu’elle a été envoyée. `drawAvailable` décrit la disponibilité réelle de la manche personnelle. Le client conserve son choix d’écran localement et adresse chaque action à son `roundId`. Une invitation reçue peut être traitée pendant que le tirage personnel reste en cours.

Les requêtes de jeu des anciens clients reçoivent `upgrade_required` avant toute mutation. Le nouveau transport abandonne un ancien reçu en attente lorsque cette réponse arrive, puis recharge immédiatement le snapshot courant. Une action déjà confirmée reste présente dans l’état migré. Les notifications utilisent le `roundId` de l’action, et leur disponibilité est calculée séparément pour les deux joueurs.

Le D4 de catégorie utilise 42 tickets équiprobables côté serveur. Complicité et Intimité en ont 11 chacune, Plaisirs et Projets en ont 10 chacun. Les deux D6 et le D20 restent uniformes.

Chaque compte dispose d’un tirage par plage de Paris de 6 h à 12 h, de 12 h à 18 h et de 18 h à 6 h. La consommation est enregistrée atomiquement avec le premier lancer de catégorie réussi. Les dés suivants de la manche et les jets de D20 ne consomment aucun ticket. Les changements d’heure sont calculés par PostgreSQL dans `Europe/Paris`.

La relance `REROLL_CARD` reste disponible uniquement pour les anciennes manches et retire alors le D20 initiateur. Dans le nouveau parcours, le D20 reste le moyen de tenter d’écarter une proposition. Aucun changement de schéma SQL n’est nécessaire.

`quota` contient `{remaining:0|1,window,label,nextAt}`. `window` désigne le début local de plage (`YYYY-MM-DDT06:00`, `T12:00` ou `T18:00`), `nextAt` une date UTC ISO.

Une manche personnelle reste active par initiateur, soit deux manches en parallèle dans la salle. Les propositions peuvent attendre une réponse ; leurs six heures commencent à la validation finale à deux. Plusieurs tâches validées peuvent rester dans la liste pendant les nouveaux tours. La résolution de la manche d’un joueur libère son prochain tour personnel.

Chaque écriture utilise une révision attendue et un verrou de ligne. Le reçu `(room,actor,requestId)` est créé dans la même transaction que le nouvel état, le ticket éventuel et la notification. Une requête répétée ne relance pas les dés et n’ajoute pas de points ni de notification. Les reçus restent sept jours ; la séquence de manche et les contraintes de phase continuent à empêcher les anciennes actions après cette durée. Le score et l’historique de jeu ne sont pas concernés par ce nettoyage.

## Contrat de présentation

Les douze grades dépendent du seul total partagé `stats.totalCompleted` : paliers **5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45 et 50**. L’interface ne présente que le grade acquis le plus élevé ; aucun stockage ou RPC de grade supplémentaire n’est nécessaire. Le grade bleu ardoise reste distinct du panneau de score corail.

La charge du bouton atteint son maximum visuel après **1 200 ms** et produit de **deux à cinq tours**, pour une animation bornée entre **1 650 et 2 500 ms**. Le D6 initial est incliné pour montrer trois faces. Ces choix concernent uniquement le renderer : les requêtes de jeu restent `{type,roundId}` et le serveur conserve le hasard. Ni `power`, ni un résultat, ni une orientation ne sont acceptés comme données de tirage.

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

Un contrôle PostgreSQL embarqué optionnel utilise `@electric-sql/pglite@0.5.14` et son vrai module pgcrypto, dans une base neuve en mémoire :

```sh
npm install --prefix /private/tmp/desir-sql-tools --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.14
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/postgres-check.mjs
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/hardcore-postgres-check.mjs
```

Les tests backend couvrent les 144 tirages de variante, les anciennes mains, les deux rôles, le quota, la compatibilité des clients, la confidentialité des dés et le rejeu concurrent d’une requête.

Le contrôle PostgreSQL vérifie aussi les mots de passe bcrypt, l’accès du rôle serveur, les sessions et le refus des lectures anonymes, sans compte réel ni accès au projet hébergé.

Avec Deno 2.9.6 : vérifier `functions/desir-game/index.ts` avec le `deno.json` et le lockfile fournis ; exécuter les tests d’import, de livraison et d’échéancier Push. `tests/database-check.sql` s’exécute après application du schéma comme propriétaire : il vérifie plages et DST, consommation atomique, CAS, rejouage, notifications et permissions dans une transaction intégralement annulée.

Documentation consultée : [authentification Edge](https://supabase.com/docs/guides/functions/auth-headers), [configuration par fonction](https://supabase.com/docs/guides/functions/function-configuration), [droits et RLS](https://supabase.com/docs/guides/api/securing-your-api), [changelog](https://supabase.com/changelog). Aucun changement de configuration Supabase Auth globale n’est requis.
