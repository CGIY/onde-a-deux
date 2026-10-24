# ONDE, Le Donjon et Les Cartes

[Ouvrir l’accueil commun](https://cgiy.github.io/onde-a-deux/) : choisir ONDE, [Le Donjon](https://cgiy.github.io/mes_apps/) ou [Les Cartes](https://cgiy.github.io/onde-a-deux/cartes/).

- **ONDE** aide le duo à choisir ses envies, séparément puis ensemble.
- **Le Donjon** transforme la soirée en aventure partagée.
- **Les Cartes** propose un booster quotidien de trois cartes, une collection privée de challenges à activer ou échanger, des cartes Énergie pour offrir un bisou et des Jokers capables d’annuler un challenge actif. Le catalogue compte 80 cartes : 43 communes, 12 full art, 16 foils et 9 full art + foil. Les cartes « Mise à nue » ont un poids de tirage réduit de 20 % à finition égale.

Les applications sont conçues d’abord pour le téléphone et hébergées sur GitHub Pages. La synchronisation passe par Supabase avec un code privé et un jeton propre à chaque appareil. Le même code AG ou CL peut appairer plusieurs appareils, indépendamment du réseau ou du VPN. Les Cartes conserve les collections, boosters, activations et échanges d’AG et CL.

Les schémas de tables figurent dans `supabase/`. Une personne qui possède le code d’un espace peut tenter de le rejoindre : ne partagez pas ce code publiquement.

## Les Cartes — édition illustrée

Mamamouth correspond au profil AG et Papapouf au profil CL. Les identifiants internes restent stables afin de conserver l’accès multi-appareils.

Le rituel propose un booster quotidien de trois cartes ; l’ouverture se fait par glissement du haut du paquet ou avec un bouton. Les cartes se révèlent par swipe, puis se feuillettent dans la collection. Les finitions brillantes réagissent au doigt, les full art utilisent une composition pleine carte, et les mouvements réduits du système sont respectés.

[Catalogue numéroté des 78 challenges et 2 utilitaires](docs/catalogue-cartes.md). Le compteur « Déjà vues » affiche les cartes distinctes découvertes sur le total du catalogue, éditions saisonnières comprises. Les inconnues restent masquées.

Le bandeau Halloween annonce la période du 29 octobre au 1er novembre 2026 inclus (heure de Paris). Pendant cette fenêtre uniquement, dix variantes saisonnières sont mélangées aux cartes de l’Édition 01. Le tirage de finition reste à 70/20/8/2 pour les challenges ; une Énergie reste garantie par booster. Les cartes Halloween gardent les finitions de leurs modèles : sept communes (dont deux Énergies), une full art, deux foils.

L’album « Déjà vues » contient 90 emplacements (80 + 10) et des filtres par édition et finition. Un emplacement inconnu ne contient ni titre, ni illustration, ni identifiant de carte. Les filtres de contenu n’affichent que les cartes découvertes.

Les nouveaux tirages expirent au bout de **7 jours**. Les cartes obtenues avant ce changement conservent leur échéance de 30 jours. Une activation dure toujours 24 heures et un booster non ouvert expire après 48 heures. Aucun inventaire n’est réinitialisé par la migration `20261024_halloween_and_seven_days.sql`.

Vérifications : `node tests/cards.test.mjs` ; `supabase/tests/halloween.sql` s’exécute dans une transaction annulée, avec le code AG fourni via `tcg.test_access_code` (jamais enregistré dans le dépôt).
