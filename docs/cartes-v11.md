# Cartes v11 — Lisibilité et matière

Interface plus lisible : commandes à 14–16 px, informations secondaires à 12–13 px,
titres sérif conservés, contrastes renforcés et icônes SVG cohérentes sur une grille
24 × 24. Les boutons ronds ont une cible de 44 × 44, avec centrage mesuré sur mobile.

Les étoiles et losanges décoratifs ajoutés aux en-têtes des cartes, aux boosters,
aux séparateurs et aux badges ont été retirés. Les symboles de rareté sont conservés
avec leur légende. Les illustrations originales ne sont pas redessinées.

Fond crème fortement texturé, grain statique légèrement flouté placé derrière les
éléments et sur les panneaux de papier, transparences et angles plus doux. Le bandeau
Halloween occupe toute la largeur de l’écran. Le nombre de doublons est une pastille
très transparente dans un coin de la pile, avec une cible tactile plus large. Les
couches de la pile ne recouvrent plus les échéances. Les épingles ont été retirées
de l’interface et n’influencent plus le tri ; les données existantes sont conservées.

Les échanges, dons et destructions utilisent une galerie pour choisir l’exemplaire
exact. Recherche avec ou sans accents, carte sélectionnée visible, rareté et échéance.
Une sélection seule ne déclenche aucune action. Les cartes adverses inconnues,
indisponibles ou expirées sont exclues. Les API de jeu restent inchangées.

Les rituels indiquent « Se termine dans », les cartes en main « Expire dans » ; les
échéances atteintes affichent simplement « Expirée » ou « Terminé ». Le titre de la
table n’annonce plus une durée fixe de 24 h après PRESTO ou ADAGIO.

Optimisation : copies WebP des quatre planches, mêmes dimensions, originaux conservés.
Environ 70 % de poids total en moins pour ces quatre images. Les images rares et
saisonnières ne font plus partie du téléchargement initial. Mise en cache des images
à la demande ; pause des animations des cartes hors écran et en arrière-plan.

Validation : huit suites Node, dont une sur les galeries et les doublons exacts,
contrôle des assets locaux, vérification de l’API et des sources de base de données
inchangées. Vérifications visuelles à largeur 320 et 390, cibles et centrage des icônes,
proposition d’échange fictive, mode Donner et bandeau sans débordement.
Aucune migration ni action de jeu sur les collections réelles.
