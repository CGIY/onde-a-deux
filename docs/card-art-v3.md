# Cartes individuelles v3

Les 100 modèles du catalogue ont chacun une image propre dans `cartes/assets/cards-v3/`. Génération avec l’outil ImageGen intégré, une requête par image, avec l’atlas initial comme référence de style. Il ne s’agit pas de découpes d’un nouvel atlas partagé.

Le manifeste de production est `output/card-art-v3/manifest.json` : identifiant, titre, finition, prompt, fichier original, export WebP et SHA-256. Les PNG originaux sont conservés localement et exclus du dépôt pour éviter de charger l’application avec les fichiers de production.

L’atelier `cartes/preview/art-v3.html` permet de filtrer les 100 cartes par catégorie et finition, et de comparer leurs images seules. Il ne se connecte à aucune sauvegarde de jeu. Les quatre planches locales `output/card-art-v3/planche-01.png` à `planche-04.png` couvrent l’intégralité du catalogue.

La patine est appliquée dans `cartes/economy.css` : grain à 40 %, couleurs légèrement affadies et chaleur de papier. Elle est située sous les textes et sous les reflets foil. Les sources ne sont pas altérées par ce filtre.
