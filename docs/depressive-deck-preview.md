# The depressive Deck — phase de test locale

Ouvrir `http://127.0.0.1:8768/cartes/?scene=deck` après le lancement de
`node tests/booster-preview.mjs`. La pop-up s’ouvre automatiquement. Une entrée
reste disponible sur l’accueil des autres scènes de démonstration.

Le Memory présente 20 tuiles mélangées, soit 10 paires de motifs. Une tentative
est consommée au deuxième retournement ; un raté retourne les deux tuiles.
Une paire retrouvée révèle sa récompense et la conserve. Au bout de 20 tentatives,
chaque paire non retrouvée devient une seule carte Énergie Bisous. Une paire gagnée
ne peut pas être perdue et un clic supplémentaire pendant la résolution est ignoré.
Une paire trouvée lors de la vingtième tentative est bien gagnée.

Les récompenses utilisent les taux ordinaires par tirage : commune 69,5 %, full art
20 %, foil 8 %, full art + foil 2 %, légendaire 0,5 %. La pondération Mise à nue ×0,8
est conservée dans les pools de démonstration. Les motifs ne dépendent ni du défi
ni de la rareté. Les récompenses non retrouvées ne sont jamais ajoutées aux cartes
vues. Plusieurs Énergies sont des exemplaires distincts d’un même modèle, donc une
seule découverte et une pile dans la collection. Des doublons de défis restent possibles.

La couverture prune, la boîte animée et les révélations reprennent le style des
cartes de l’application. La grille s’adapte à la hauteur, avec un accès au clavier,
une annonce des motifs retournés et une version sans transitions selon le réglage
système de réduction des mouvements. Fermer puis rouvrir conserve la partie dans
l’onglet ; fermer pendant une résolution ne rembourse pas une tentative. Recharger
la page remet la démonstration à zéro et crée un nouveau tirage.

## Isolation

Les fichiers du prototype et son illustration sont sous `tests/` (ce document sous `docs/`).
Aucun fichier de l’application publiée, catalogue SQL, service worker, API ou donnée
réelle n’est modifié. Le serveur de prévisualisation remplace le transport par des
fixtures en mémoire et interdit les connexions via `connect-src 'none'`. Aucun jeton
réel ni stockage persistant n’est utilisé. Le catalogue de test reprend seulement
quelques titres d’exemple avec un texte explicitement fictif.

## Vérification

- Tests du modèle complet : victoire, défaite, cas 7 défis + 3 Énergies, dernière
  tentative, verrou des clics, absence de découverte prématurée, reprise après
  échec de la callback et attribution unique.
- Distribution exhaustive sur 100 000 valeurs de tirage et pondération de catégorie.
- Partie native jouée à partir des seuls motifs observés : 10 paires en 16 tentatives,
  10 exemplaires attribués ; les doublons expliquent un total inférieur de découvertes.
- Défaite native à la vingtième tentative : 10 Énergies, une seule carte découverte,
  aucune récompense cachée révélée et aucune erreur de console.
- Vérification du format mobile et du récapitulatif vers la collection de test.

## Motifs illustrés

Les dix pictogrammes ont été remplacés par des illustrations légères à l’aquarelle :
soleil, lune, clé, rose, fougère, tasse, lettre scellée, couronne, papillon et ancre.
Les fonds ivoire et les couleurs sourdes donnent davantage d’espace aux motifs.
La boîte assortie est crème avec une tranche prune et un petit croissant de lune.
Une planche commune 5 × 2 est préchargée et découpée uniquement par le fond CSS ;
les noms accessibles restent distincts. Les règles et tirages restent identiques.

Asset : `tests/assets/depressive-memory-atlas.jpg` (1774 × 887).
Création avec l’outil intégré ImageGen, sans CLI, puis conversion JPEG locale.
Prompt : `tests/assets/depressive-memory-atlas.prompt.txt`.

## Volume du coffret

Le coffret utilise six plans 3D avec une profondeur commune : les arêtes du dessus,
des côtés, du fond et de la façade partagent le même repère. Le rabat pivote autour
de l’arête arrière supérieure ; les cartes montent depuis l’intérieur après son
ouverture. Une oscillation lente anime l’ensemble et la grille arrive par une courte
distribution progressive. La réduction des mouvements désactive ces animations.
