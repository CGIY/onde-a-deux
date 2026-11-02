# Dés·ir — service de jeu

Le service utilise le moteur canonique `demo-des/dev/src/onde-app-core.js`, copié dans `functions/desir-game/core.js` avant déploiement. Les tirages, les dates, les PV et les deux coches sont traités côté serveur. Le navigateur reçoit uniquement la projection autorisée pour son compte. La fonction Edge `desir-game` **version 3** est déployée pour cette révision.

## Configuration

Appliquer dans cet ordre :

1. `schema.sql` : tables, comptes fermés, sessions, quotas et transactions.
2. `push-schema.sql` : abonnements et livraisons Web Push.
3. `push-scheduler.sql` : échéancier des notifications et appel cron protégé.
4. `additive-device-index.sql` : index supplémentaire des appareils par compte.

Les fichiers de `migrations/` reproduisent les quatre migrations appliquées sur le projet hébergé. Les dates de version proviennent de son historique Supabase.

Créer une salle avec un état `G.createState()`, puis exactement deux lignes privées dans `desir_accounts`, acteurs `a` et `b`, même `room_id`. Les identifiants et noms affichés sont fournis à la base privée ; aucun nom réel ni mot de passe ne fait partie des sources publiques. Stocker uniquement des empreintes bcrypt coût 12, compatibles `extensions.crypt` (`$2a$` recommandé). La fonction refuse les mots de passe de plus de 72 octets, pour éviter la troncature bcrypt.

Les opérations `create` et `join` sont fermées. Le déploiement utilise `verify_jwt=false` pour cette fonction uniquement : ses sessions opaques ne sont pas des JWT Supabase Auth. Le handler vérifie lui-même chaque session, et les tables/RPC sont interdites à `anon`, `authenticated` et `PUBLIC`. Seul le rôle serveur peut les atteindre. Les RPC s’exécutent en `SECURITY INVOKER`.

Variables serveur : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (fournies par Supabase), `DESIR_ALLOWED_ORIGINS` facultatif (origines séparées par des virgules ; défaut `https://cgiy.github.io`), `DESIR_RATE_SECRET` facultatif (défaut secret serveur). Aucune clé serveur ne doit apparaître dans la configuration du navigateur.

Le module Push génère et conserve les clés VAPID côté serveur. Configurer le cron via `desir_configure_push_scheduler` avec l’URL Edge, un secret aléatoire dédié et éventuellement la clé publique du projet. Ce secret autorise uniquement `drain_push`, pas les comptes de jeu.

## API

Toutes les opérations utilisent `POST` JSON. Les réponses ne sont jamais mises en cache.

- `login` : `{op:"login", username, password}` et `Authorization: Bearer <session-prospective>`. Les identifiants sont normalisés en minuscules, sans accents ; le mot de passe reste exact. Le client génère et conserve auparavant 32 octets aléatoires encodés en base64url (43 caractères). La réponse ajoute `connection:{token,roomId,actor}`.
- `state` : session existante, retour du snapshot courant et expiration des tâches selon l’horloge serveur.
- `action` : `{op:"action", requestId:<UUID>, action:{type,roundId,taskId?,checked?}}`.
- `push_config` : session existante, retour `{vapidPublicKey}`.
- `subscribe` : session existante, `{op:"subscribe",subscription:<PushSubscriptionJSON>}`.
- `drain_push` : réservé au cron avec l’en-tête `X-Desir-Cron`, réponse 202 après mise en file et traitement différé.

Snapshot : `{roomId,state,revision,actor,paired,quota,serverTime,roll?}`. `serverTime` est rafraîchi à chaque réponse, même lorsqu’un ancien reçu est rejoué, pour le décompte des six heures sur un téléphone dont l’horloge est décalée. `roll` ne figure que sur la réponse à un lancer autorisé. Les erreurs 409 de conflit ou de phase incluent le snapshot actuel. Le client ne doit pas remplacer un snapshot par une révision inférieure : une réponse idempotente ancienne peut être rejouée exactement.

Les seuls types d’action exposés sont `ROLL_CATEGORY`, `ROLL_CARD`, `REROLL_CARD`, `CHALLENGE_DRAFT`, `ROLL_DRAFT_DEFENSE`, `SEND`, `CHALLENGE`, `ROLL_DEFENSE`, `ACCEPT`, `NEW_ROUND`, `TOGGLE_TASK_CHECK`. Tout `actor`, `value`, `hand`, `at` ou jeton de lancer envoyé par le client est rejeté. L’identité vient de la session ; le hasard et les horodatages viennent du serveur.

## Quotas et concurrence

Chaque compte dispose d’un D6 puis D4 par plage de Paris : 6–12 h, 12–18 h, 18–6 h. La consommation est enregistrée atomiquement avec le D6 réussi. D4 et les deux D20 du tour restent disponibles ensuite ; ils ne consomment pas un autre ticket. Les changements d’heure d’été/hiver sont calculés par PostgreSQL dans `Europe/Paris`.

La relance `REROLL_CARD` est réservée à la personne qui tire, pendant `draft`, avant son D20 et une seule fois. Le serveur choisit uniformément parmi les trois autres indices du D4 ; il ne prend aucun résultat du client. `round.cardRerolled` persiste le choix et bloque ensuite le D20 initiateur, sans modifier celui du destinataire, le score ou le quota. Les anciens états et historiques reçoivent ce champ à `false` par normalisation et CAS, sans migration SQL.

`quota` contient `{remaining:0|1,window,label,nextAt}`. `window` désigne le début local de plage (`YYYY-MM-DDT06:00`, `T12:00` ou `T18:00`), `nextAt` une date UTC ISO.

Une seule manche de tirage reste active dans ce MVP. Les propositions peuvent attendre une réponse ; leurs six heures ne commencent qu’à la validation finale à deux. Plusieurs tâches validées peuvent rester dans la liste pendant un nouveau tour. Une réponse en attente peut donc empêcher le démarrage d’une autre manche ; les quotas ne créent pas des manches parallèles.

Chaque écriture utilise une révision attendue et un verrou de ligne. Le reçu `(room,actor,requestId)` est créé dans la même transaction que le nouvel état, le ticket éventuel et la notification. Une requête répétée ne relance pas les dés et n’ajoute pas de points ni de notification. Les reçus restent sept jours ; la séquence de manche et les contraintes de phase continuent à empêcher les anciennes actions après cette durée. Le score et l’historique de jeu ne sont pas concernés par ce nettoyage.

## Contrat de présentation

Les douze grades dépendent du seul total partagé `stats.totalCompleted` : paliers **5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45 et 50**. L’interface ne présente que le grade acquis le plus élevé ; aucun stockage ou RPC de grade supplémentaire n’est nécessaire. Le grade bleu ardoise reste distinct du panneau de score corail.

La charge du bouton atteint son maximum visuel après **1 200 ms** et produit de **deux à cinq tours**, pour une animation bornée entre **1 650 et 2 500 ms**. Le D6 initial est incliné pour montrer trois faces. Ces choix concernent uniquement le renderer : les requêtes de jeu restent `{type,roundId}` et le serveur conserve le hasard. Ni `power`, ni un résultat, ni une orientation ne sont acceptés comme données de tirage. La relance D4 conserve son coût métier : perte du D20 initiateur seulement, sans ticket ni point supplémentaire et avec conservation du D20 destinataire.

Les contrôles de contraste, d’attente réseau, de cibles et de défilement sont documentés dans l’[audit UI/DA](../dev/AUDIT_UI_DA.md). Les calculs statiques ne remplacent ni le rendu navigateur ni les essais sur téléphone.

## Confidentialité

Avant envoi, le destinataire reçoit une manche neutre et valide, sans catégorie, carte, main, PV ou historique privé. `seen` n’est jamais envoyé. Après envoi, seule la carte choisie est révélée : les autres identifiants de la main sont remplacés par des leurres déterministes pour préserver le schéma du moteur, sans divulguer les trois autres tirages. Les noms des deux comptes ne sont retournés qu’après authentification. Les notifications n’incluent ni titre de carte ni identifiant privé.

Les sessions sont stockées uniquement sous leur SHA-256 et expirent après 90 jours d’inactivité. Les limites de requêtes stockent des seaux HMAC, jamais les IP brutes. Les réponses d’erreur ne répercutent aucun message SQL, mot de passe ou contenu de carte.

## Vérifier

```sh
node demo-des/server/tests/backend-check.mjs
node demo-des/server/tests/push-check.mjs
```

Un contrôle PostgreSQL embarqué optionnel utilise `@electric-sql/pglite@0.5.14` et son vrai module pgcrypto, dans une base neuve en mémoire :

```sh
npm install --prefix /private/tmp/desir-sql-tools --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.14
DESIR_PGLITE_DIR=/private/tmp/desir-sql-tools/node_modules/@electric-sql/pglite node demo-des/server/tests/postgres-check.mjs
```

Cette révision totalise **790 vérifications backend**, **102 transport**, **234 UI** et **1 003 assertions de relance D4**. Les tests couvrent notamment les trois faces de remplacement possibles, les deux rôles, le quota déjà consommé, la migration des anciens états et le rejeu concurrent du même reçu.

Le contrôle PostgreSQL vérifie aussi les mots de passe bcrypt, l’accès du rôle serveur, les sessions et le refus des lectures anonymes, sans compte réel ni accès au projet hébergé.

Avec Deno 2.9.6 : vérifier `functions/desir-game/index.ts` avec le `deno.json` et le lockfile fournis ; exécuter les tests d’import, de livraison et d’échéancier Push. `tests/database-check.sql` s’exécute après application du schéma comme propriétaire : il vérifie plages et DST, consommation atomique, CAS, rejouage, notifications et permissions dans une transaction intégralement annulée.

Documentation consultée : [authentification Edge](https://supabase.com/docs/guides/functions/auth-headers), [configuration par fonction](https://supabase.com/docs/guides/functions/function-configuration), [droits et RLS](https://supabase.com/docs/guides/api/securing-your-api), [changelog](https://supabase.com/changelog). Aucun changement de configuration Supabase Auth globale n’est requis.
