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

L’ouverture tactile suit la déchirure dans les deux sens : bande détachée, lueur cuivre, éclats et émergence du dos des cartes, avant la révélation. Un geste incomplet, vertical ou annulé n’ouvre rien ; l’ouverture est verrouillée pendant la requête. Le zoom au double-tap est neutralisé sans interdire le zoom d’accessibilité par pincement hors du paquet.

Tests sans toucher aux données réelles : `node tests/booster-gesture.test.mjs` et `node tests/booster-preview.mjs` (aperçu isolé sur le port 8768, appels réseau bloqués et stockage neutralisé). `?failure=once` simule une coupure pour vérifier la reprise. Aucune migration ni remise à zéro n’accompagne cette retouche d’interface.

### Gestes libres et gestion des cartes V7

La découpe du booster peut commencer de chaque côté du paquet, avec une marge verticale généreuse. Le déplacement dans le vide ne déclenche aucun tirage. Le corps du paquet reste orientable. Le bandeau doré garde son ancrage jusqu'au détachement.

Après ouverture, la fenêtre entière accepte de courts gestes dans quatre directions (18 px, ou 10 px avec un geste rapide). Gauche/haut avance ; droite/bas recule. Les trois cartes bouclent ; « Ranger » ou la croix ferme la découverte. La zone de geste reste montée pendant les transitions et conserve jusqu'à six gestes rapides en attente.

L'onglet **Actions** propose **Échanger / Donner / Détruire**. Ces actions existent aussi dans le détail d'un exemplaire disponible. Un don transmet la même carte à l'autre profil, avec la même échéance, et conserve les découvertes des deux joueurs. La destruction marque uniquement cet exemplaire `destroyed` : aucun enregistrement ni découverte n'est effacé. Les cartes engagées dans un échange, actives, utilisées ou expirées sont refusées côté serveur.

Pour détruire, trois gestes doivent traverser la carte. Les morceaux suivent les lignes réellement tracées et se détachent seulement après confirmation du serveur. Fermer avant le troisième geste annule sans appel de destruction ; une alternative « Détruire sans geste » demande confirmation. Les mouvements réduits sont respectés. Le journal `tcg_card_events`, inaccessible directement aux clients, conserve les dons et destructions.

La migration `20261025145505_card_gifts_and_preserved_destruction.sql` vérifie sous verrou que toutes les cartes, découvertes, boosters et échanges existants restent identiques. Les tests SQL de `supabase/tests/card_management.sql` utilisent des fixtures dans une transaction entièrement annulée.

Vérifications : `node tests/cards.test.mjs`, `node tests/booster-gesture.test.mjs`, `node tests/reveal-navigation.test.mjs`, `node tests/card-destruction.test.mjs`, `node tests/opening-sequence.test.mjs`. Prévisualisation isolée : `node tests/booster-preview.mjs` (aucun accès à Supabase ni au stockage réel).

### Expérience tactile V6

- Accueil adaptatif : paquet disponible en avant ; sinon cartes actives avant le petit compteur du prochain booster. Date seule, bandeau Halloween horizontal contrasté, pas de total de catalogue répété sur l’accueil.
- Collection verticale en trois colonnes sur téléphone et cinq sur grand écran. Filtres repliables, descriptions intégrales conservées dans le détail, compteurs lisibles sous les miniatures.
- Les exemplaires d’un même modèle et d’une même finition forment une pile visuelle `×N`. Aucun exemplaire n’est fusionné en base : le premier à expirer fournit l’action de la pile. Les finitions différentes restent séparées.
- Paquet peu épais en perspective : glisser sur son corps permet une inspection continue en rotation (axes X/Y/Z) ; glisser sur sa bande supérieure le déchire, dans les deux sens et en diagonale. Le geste d’inspection ne déclenche aucun tirage. L’animation de 760 ms démarre avec la requête, pas après elle ; si le réseau est plus lent, seuls les dos restent visibles jusqu’à confirmation du serveur. Pas de pré-tirage, ni d’appel réseau au simple survol/à la rotation.
- Swipes courts/véloces, retour à la carte précédente, animations d’activation et d’échange, étoile de première découverte, inclinaison et reflet au doigt sur l’accueil comme dans la collection.
- Échange visuel « Je donne / Je reçois », historique repliable, raison explicite d’une indisponibilité. Le choix reste un contrôle natif accessible.
- Symboles de finition `● / ◇ / ✦ / ✺`, expliqués dans le panneau ⓘ. Les reflets arc-en-ciel et les textes de challenges restent inchangés.
- Les synchronisations inchangées ne remontent pas les cartes et ne rejouent pas leur entrée. Le mouvement réduit est respecté ; le zoom par pincement reste possible hors du paquet.

Scénarios d’aperçu hors réseau : `?scene=rest` (piles et table), `?scene=trade` (échange), `?failure=once` (reprise d’ouverture). Les données de ces scénarios sont fictives, en mémoire et signalées par un bandeau. Aucun scénario n’est chargé par l’application publique.

`node tests/opening-sequence.test.mjs` vérifie aussi le démarrage immédiat de l’animation, l’absence de faces avant confirmation, l’ouverture unique, le recouvrement de la latence réseau et le retour à l’état visuel initial après une erreur.

### Cadeau de test du 24 octobre 2026

Un booster bonus a été offert à chaque profil, sans ouverture automatique et sans modifier le rendez-vous quotidien de 5 h (heure de Paris). Il expire normalement après 48 heures. Les cadeaux portent une clé de campagne unique par joueur et n’occupent aucune date de sortie quotidienne ; la campagne `ui-v6-test-2026-10-24` ne peut pas être attribuée deux fois au même profil.

Le script administratif `supabase/operations/grant_ui_v6_test_bonus.sql` est idempotent et vérifie, sous le verrou du jeu, que cartes, découvertes, échanges et anciens boosters restent inchangés. Il ne s’exécute jamais depuis le navigateur. L’ajout ne change ni les droits d’accès ni l’API des joueurs.

[Catalogue numéroté des 78 challenges et 2 utilitaires](docs/catalogue-cartes.md). Le compteur « Déjà vues » affiche les cartes distinctes découvertes sur le total du catalogue, éditions saisonnières comprises. Les inconnues restent masquées.

Le bandeau Halloween annonce la période du 29 octobre au 1er novembre 2026 inclus (heure de Paris). Pendant cette fenêtre uniquement, dix variantes saisonnières sont mélangées aux cartes de l’Édition 01. Le tirage de finition reste à 70/20/8/2 pour les challenges ; une Énergie reste garantie par booster. Les cartes Halloween gardent les finitions de leurs modèles : sept communes (dont deux Énergies), une full art, deux foils.

L’album « Déjà vues » contient 90 emplacements (80 + 10) et des filtres par édition et finition. Un emplacement inconnu ne contient ni titre, ni illustration, ni identifiant de carte. Les filtres de contenu n’affichent que les cartes découvertes.

Les nouveaux tirages expirent au bout de **7 jours**. Les cartes obtenues avant ce changement conservent leur échéance de 30 jours. Une activation dure toujours 24 heures et un booster non ouvert expire après 48 heures. Aucun inventaire n’est réinitialisé par la migration `20261024_halloween_and_seven_days.sql`.

Vérifications : `node tests/cards.test.mjs` ; `supabase/tests/halloween.sql` s’exécute dans une transaction annulée, avec le code AG fourni via `tcg.test_access_code` (jamais enregistré dans le dépôt).
