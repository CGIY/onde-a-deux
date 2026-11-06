# Notifications Dés·ir

L’application web se partage entre deux comptes. Les notifications sont facultatives et s’activent depuis un bouton, après connexion. Sur iPhone/iPad, installer le site sur l’écran d’accueil et ouvrir cette application installée ; Web Push demande iOS/iPadOS 16.4 ou ultérieur.

## Installation serveur

Appliquer dans cet ordre `schema.sql`, `push-schema.sql`, puis `push-scheduler.sql`. Les fonctions publiques et tables de jeu/notifications sont réservées au rôle serveur ; aucune clé privée ne doit entrer dans les fichiers GitHub Pages.

Le serveur génère sa paire VAPID lors de la première activation et la conserve dans `desir_push_config`, inaccessible aux clés publiques. Conserver cette table lors des déploiements : changer de clé invalide les abonnements existants.

Provisionner une fois `desir_configure_push_scheduler(p_endpoint_url, p_cron_token, p_publishable_key)` depuis l’accès serveur privé. Utiliser l’URL HTTPS de la fonction `desir-game`, un jeton cron indépendant de 32 octets aléatoires encodés en base64url (43 caractères), et la clé publiable du projet si la passerelle la demande. Le jeton cron ne doit être ni une clé Supabase secrète ni une clé `service_role`. Il demeure dans une table privée. Le job `desir-push-minute` appelle chaque minute une fonction SQL privée qui ajoute ce jeton dans `X-Desir-Cron` ; la commande visible du job ne contient aucun secret. Les files temporaires de `pg_net` ne sont pas lisibles par `anon`/`authenticated`.

La fonction Edge doit accepter `drain_push` avant l’authentification de session, uniquement après vérification constante du jeton dédié. Elle inscrit les échéances avec l’heure de la base, puis poursuit le drainage avec `EdgeRuntime.waitUntil`. La réponse rapide permet à `pg_net` de terminer sans attendre les services push.

## Envois

- `draw-available` : « Ton dé est prêt. », une fois par joueur et plage de Paris (6–12 h, 12–18 h, 18–6 h), seulement si son quota est libre et son tour autorise effectivement le D6. Un tour en attente de réponse bloque ce message. La prochaine plage ne se calcule jamais en ajoutant 24 heures, pour respecter les changements d’heure.
- `invitation` / `confirmation` : message générique au joueur attendu, après la transition persistée. Les identifiants de tour empêchent une ancienne invitation réessayée de rejoindre un nouveau tour.
- `task-reminder` : une fois par action et joueur, dès qu’il reste trois heures ou moins et que sa case est décochée. La notification affiche le temps restant à sa réception. Sa durée de vie expire avec l’action ; les rappels des actions cochées ou expirées sont supprimés avant envoi.

Aucun titre de carte, sujet intime, nom de joueur, identifiant de salle ou jeton de connexion n’entre dans la notification. Le contenu est chiffré AES128GCM, signé VAPID et envoyé seulement aux services push Apple, Mozilla, Google ou Windows explicitement autorisés. Les redirections sont refusées. Un clic ouvre uniquement cette application.

La file persistante utilise des baux et des tentatives espacées. Le registre par abonnement évite de renvoyer un événement aux appareils déjà servis ; le tag identique regroupe les rares répétitions possibles après une interruption entre l’envoi et son enregistrement. Les abonnements expirés (404/410) sont retirés. Le système d’exploitation et le réseau décident du moment exact de présentation : le minuteur serveur ne garantit pas une alerte à la seconde.

## Vérification

`tests/push-check.mjs` vérifie les limites de confiance, les messages et les destinations du service worker. Les tests Deno `push-import-check.ts` et `push-outbox-check.ts` exercent la vraie bibliothèque épinglée, le chiffrement, les reprises, l’authentification cron et les échéances sans contacter de téléphone. `tests/push-scheduler-check.sql` vérifie les plages Paris/DST, les tours bloqués, les quotas, les rappels et leurs dédoublonnages dans une transaction entièrement annulée. Une réception réelle sur chaque téléphone reste à vérifier après abonnement.

Références officielles : [WebKit, Web Push sur iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple, notifications web](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Supabase, fonctions planifiées](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase, pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
