# Depressive Deck — événement unique du 26 octobre 2026

Une seule partie par profil. Nouvelles parties du 26 octobre au 27 octobre à 05:00,
heure de Paris. Après cette limite, seules les parties déjà commencées peuvent
continuer. La date est absolue : aucun retour annuel ni nouvelle attribution.

## Jeu

- 20 tuiles mélangées, 10 paires, 20 tentatives.
- Le deuxième retournement consomme une tentative. Un raté retourne les tuiles.
- Une paire retrouvée conserve une carte. Les paires non retrouvées à la fin
  deviennent chacune une Énergie Bisous, pas une énergie par erreur.
- Une paire gagnée lors de la dernière tentative est conservée.
- Les récompenses sont tirées une seule fois, au démarrage, et restent privées.
  Elles ne sont ajoutées aux cartes et découvertes qu’au moment de leur obtention.
- Les gains peuvent être des défis, des sortilèges ou des Jokers. Aucun sort ni
  Joker n’est garanti. Les doublons sont possibles et s’empilent normalement.
- Les nouvelles cartes durent sept jours à partir de leur obtention.

Les finitions sont tirées à 69,5 % commune, 20 % full art, 8 % foil,
2 % full art + foil et 0,5 % légendaire. Parmi les tirages communs, 10 % peuvent
devenir un Joker ; sinon le pool est défi/sortilège. La pondération Mise à nue ×0,8
et les restrictions AG/CL sont reprises du sélecteur ordinaire.

## Persistance et accès

`public.tcg_deck_games` conserve la partie, les deux tuiles éventuellement exposées,
le tirage et les cartes déjà attribuées. Une clé unique événement/profil empêche
les nouveaux tirages. Chaque geste porte la révision observée et l’API existante
valide le jeton avant de prendre le verrou global. Un appel rejoué ou concurrent
ne peut pas attribuer un second gain. Le client ne décide ni des paires ni des gains.

La table est sous RLS et aucun accès direct n’est accordé aux rôles clients.
Tous les helpers sont privés ; seul le point d’entrée `tcg_exchange` existant
reste accessible. La réponse contient les motifs exposés/retrouvés, pas le reste
du plateau ni les récompenses cachées. Un rechargement reprend la même partie.

La migration additive appliquée est
`20261026180958_depressive_deck_one_shot.sql`. Les empreintes des cartes,
découvertes, boosters et historiques étaient identiques avant et après migration.
Aucune partie réelle n’a été consommée par les tests.

## Vérification locale

Les tests SQL sont exécutés dans PostgreSQL/WASM avec pgcrypto, sur le schéma
et le catalogue versionnés, sans connexion à Supabase. Le moteur temporaire
est PGlite 0.5.12. Aucun paquet n’est ajouté à l’application publiée.

```sh
npm install --prefix /tmp/onde-deck --no-audit --no-fund @electric-sql/pglite@0.5.12
node tests/depressive-deck-local.mjs /tmp/onde-deck/node_modules/@electric-sql/pglite
TCG_PGLITE_DIR=/tmp/onde-deck/node_modules/@electric-sql/pglite node tests/deck-live-preview.mjs
```

La prévisualisation complète est sur `http://127.0.0.1:8769/cartes/`.
Elle n’utilise que des identités de test, bloque les connexions hors origine locale
et garde toutes ses données en mémoire. Redémarrer ce serveur remet seulement
cette base locale à zéro.

Tests : authentification, non-divulgation, absence de découverte avant résolution,
tirage unique, révisions concurrentes, troisième clic bloqué, attribution unique,
défaite 10 Énergies, résultat 7 + 3, victoire au dernier tour, attribution de sorts
et Jokers, fermeture des nouvelles parties et reprise après la limite.

Partie native de contrôle : 10 paires en 15 tentatives, dix cartes dont un Joker
et REDUCTO ; neuf découvertes, dont un doublon empilé. Une première tuile a été
retrouvée identique après rechargement. Le second profil avait sa partie indépendante.

Le bandeau saisonnier passe de 46 à 59,8 px (+30 %) et son prisme conserve la
proportion correcte. Halloween garde son dégradé ; Mamamouth devient mauve.
