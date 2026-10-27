# Audit et reprise visuelle — 27 octobre 2026

Base examinée : `b374659`. L’audit porte sur le client, les règles SQL déployées, les Complices, les abonnements Push et les 100 entrées réelles du catalogue.

## Corrections réalisées

- **Voleur** : le serveur ne déduisait pas le prix de 8 Éclats. Le gain est désormais net du prix ; le montant transféré respecte le plancher adverse de −12. Une opération impossible ne débite rien.
- **Notifications internes** : `tcg_push_sent` avait ses protections RLS désactivées. Elles sont activées et les accès directs des clients retirés. Les fonctions d’envoi, de purge et de planification sont réservées au serveur ; les RPC authentifiées par le code d’appareil pour gérer son abonnement restent disponibles.
- **Complices après erreur réseau** : un simple retour de synchronisation pouvait annoncer une réussite. Il faut maintenant un nouvel événement du bon type pour confirmer l’opération.
- **Recyclage** : correction du callback mal nommé, du bouton de lot non relié et du bouton de détail encore relié à l’ancien nom. La découpe à trois gestes est restaurée pour une carte et pour un lot. Une seule transaction verse les Éclats après confirmation du serveur. Le bouton Détruire et son ancienne fenêtre sont supprimés.
- **Images vides** : prise en charge des objets identifiés par `id` ou `template_id`, vignettes réelles dans les listes et correction du serveur local qui bloquait les images dans un sous-dossier. Un fond de secours reste disponible.
- **Navigation Push** : un clic cible désormais un onglet de l’app Cartes et une adresse appartenant à son périmètre. Une adresse externe est écartée.
- **Client Push** : contrôle de compatibilité, retour d’erreur visible, délai réseau limité, suppression de l’attente indéfinie d’un service worker et liaison explicite de l’abonnement au profil choisi sur cet appareil.
- **Ergonomie** : portefeuille lisible avec son libellé Éclats ; boutons d’information et d’actualisation réduits visuellement, zones tactiles conservées ; Complices repliés ; solde répété dans la Boutique supprimé ; Actions limitées à Échanger et Donner.

Les modifications SQL correctives ont été appliquées avec un contrôle préalable de la définition du Complice. Elles ne réinitialisent ni cartes, ni découvertes, ni journaux, ni soldes. Les opérations de test utilisent une base locale isolée.

## Illustrations et rendu

100 générations individuelles avec l’outil ImageGen intégré, guidées par l’atlas initial : relief de cuivre, papier usé, couleurs de catégories et compositions spécifiques. Les images intimes utilisent des natures mortes et des allégories sans représentation explicite. Les textes de défis ne sont pas réécrits.

Les full art ont leur propre composition sur toute la surface. Le foil est une couche arc-en-ciel interactive distincte ; les textes restent au-dessus. La patine demandée ajoute un grain à 40 %, une saturation à 82 %, un contraste à 94 % et une légère chaleur, sur l’illustration seulement.

Les 100 WebP mesurent 800 × 1200 pixels et représentent environ 31,7 Mo au total. Ils sont chargés selon les vues et mis en cache à l’usage. Les PNG originaux et les prompts sont conservés localement dans `output/card-art-v3/` ; le manifeste relie chaque modèle à son fichier et à son empreinte.

## Vérification

- 14 tests JavaScript : gestes, recyclage, reçus d’ouverture, navigation, découverte, effets, reprise réseau, notifications et intégrité des 100 fichiers.
- Tests SQL isolés : trois achats à thème avec garantie et cinq récompenses, limite hebdomadaire commune, conservation des boosters quotidiens ; coût du Voleur, transfert plafonné, échec sans débit, Druide, Assassin et accès interne refusé.
- Contrôle visuel des quatre planches couvrant les 100 images, des communes et full art, du portefeuille, des listes et de la découpe dans l’essai local.
- Après correction serveur : RLS actif, lecture directe anonyme refusée, envoi/purge refusés aux clients authentifiés, envoi serveur conservé ; absence de l’erreur RLS initiale dans l’Advisor.

## Limites et points de maintenance

- La livraison Push entre deux iPhone physiques n’a pas été testée pendant cet audit. Les contrôles locaux ne remplacent pas ce test.
- La fonction serveur Push existante contient encore sa configuration privée dans son code serveur. La déplacer vers des secrets gérés est un prochain travail de maintenance ; aucune clé privée n’est ajoutée au dépôt par cette reprise.
- La purge automatique des abonnements expirés n’est pas implémentée dans la fonction d’envoi actuelle.
- L’Advisor conserve les avertissements des RPC à privilèges élevés du projet, contrôlées par le code d’appareil, ainsi que l’emplacement de `pg_net`. Les tables privées sans politique ouverte restent volontairement inaccessibles directement.
- Les règles déployées avaient évolué sans être toutes reprises dans les fichiers de test. `supabase/operations/current_tcg_rules.sql` en conserve une copie sans données de joueurs, utilisée par le nouvel essai isolé.
