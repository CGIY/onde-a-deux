# Révision des repères — 3 novembre 2026

## Résultat de la curation

Le prompt fourni remplace la logique de proximité thématique des anciens repères : le résultat doit porter sur l’activité elle-même, avec un pourcentage réel, sa base, sa source et ses limites. Une corrélation, un effet standardisé ou une variation de signal physiologique ne devient pas un pourcentage de personnes.

- 88 cartes examinées : **48 cartes documentées, 67 variantes retenues ; 40 absences documentées**.
- Deux cartes ont trois angles distincts : musée/visite et série. Quinze ont deux variantes ; trente et une en ont une. Les autres restent sans repère chiffré dans l’app.
- Le statut `PARTIEL` reconnaît la présence d’une ou deux variantes. `INTROUVABLE` signifie qu’aucun candidat n’a été retenu dans les sources consultées, pas qu’aucune donnée n’existe dans le monde.
- Aucun remplissage par un sujet voisin, aucune troisième variante inventée, aucun message d’absence ajouté sur les cartes de jeu.

Les données actives sont dans `data/card-evidence.json`. `data/card-evidence-audit.json` conserve les exclusions. Le générateur produit [le relevé JSON](../statistiques.json) et [la page de contrôle](../statistiques.html), séparée de la navigation du jeu pour éviter les spoilers. Les coches de cette page sont locales à l’appareil ; l’export transmet les choix sous forme d’un fichier, sans modifier la partie.

## Choix et limites éditoriales

L’activité centrale doit être identique. L’achat d’un roman n’est pas remplacé par la lecture ; l’achat d’ingrédients n’est pas remplacé par le goût pour une cuisine ; des messages privés ne remplacent pas une publication sur Reddit ; le massage général ne remplace pas une zone précise.

Les contraintes non isolées par une enquête — marque commerciale, durée, budget, extérieur, canapé, ampleur des travaux — restent nommées dans les limites. Aucun effet propre à ces contraintes n’est affirmé. Les résultats de massages professionnels chez des patients sont présentés comme tels et ne sont pas des promesses de détente après un massage domestique. Les enquêtes commerciales, anciennes, volontaires ou de petits effectifs restent contextualisées ; aucun résultat de confiance basse n’est activé.

Les recouvrements impossibles à éviter sont explicités : les deux durées sans téléphone utilisent deux questions différentes de la même enquête ; dos et massage complet utilisent deux interventions distinctes d’un même essai. Chaque carte garde un résultat différent. Dans une carte, les variantes ont des angles différents parmi pratique, appréciation, bénéfice et envie.

## Corrections significatives

- Les chiffres de cunnilingus, fellation et pénétration anale de CSF 2023 sont restreints aux femmes de 18–69 ans ayant déjà eu un partenaire sexuel. L’enquête distingue pratique réalisée ou reçue. Le chiffre ne mesure pas le plaisir.
- IFOP 2021 : les taux retenus pour les trois pratiques orales/faciales sont ceux de l’ensemble des cinq pays européens, pas les colonnes françaises. L’effectif total n’est pas présenté comme celui de chaque sous-question.
- IFOP 2023 : reproduction d’une scène ou position, sans prétendre mesurer la fidélité 1:1. Les contradictions internes de date et de borne d’âge sont signalées.
- Les fantasmes Joyal ne sont pas des intentions d’essayer : les deux candidats ont été retirés après vérification indépendante.
- La fessée retient la catégorie publiée « très attirante » seule ; les catégories de réponse ne sont pas additionnées. La base exacte de l’item est de 1 957 personnes.
- La comparaison cortisol forêt/ville et le signal physiologique du soin du visage sont exclus : ce ne sont pas des proportions de personnes rapportant un bénéfice.
- Le masque après laser/microneedling et le choix de couleur du vernis ne servent pas de substituts au masque de routine et à la pose de vernis.
- Les ventes de mangas ou de jeux en nombre d’ouvrages/unités ne deviennent pas des pourcentages d’acheteurs. Un « plus de 50 % » n’est pas transformé en « 50 % ».

## Construction et présentation

Une seule statistique apparaît sur la carte, avec une phrase et une source dépliable. Le sous-titre redondant a été retiré. Les variantes tournent selon l’identifiant partagé de la manche : une nouvelle ouverture ou un rafraîchissement ne tire pas une nouvelle statistique ; les deux personnes voient la même variante. Le document de curation est une liste autorisée : les anciens repères hors de cette liste ne peuvent pas revenir depuis une sauvegarde.

Avant toute écriture de livrable, le générateur contrôle l’union des 88 cartes, les absences documentées, les pourcentages bornés à 0–100, l’égalité entre valeur et affichage, les angles distincts et l’unicité globale de la mesure. Une même source et un même chiffre ne peuvent pas être réutilisés, même avec une autre formulation, une ancre ou un paramètre de suivi. Les paramètres identifiant un article restent conservés.

## Vérification

- Lecture des sources primaires et des tableaux/méthodes disponibles sous forme de texte indexé. Les PDF dont le téléchargement direct a échoué n’ont pas été présentés comme vérifiés visuellement.
- Contre-vérification indépendante des bases CSF, IFOP et de la fessée ; des valeurs musée, aquarelle, poterie et bucket list. Les corrections de base et les exclusions ont été appliquées.
- 8 tests de construction, contrôle des 48 cartes sourcées / 40 absentes, variantes immuables et identiques entre joueurs, 329 contrôles UI.
- Page de contrôle : 28 contrôles fonctionnels, puis vérification dans le navigateur des filtres, sources et choix conservés.
- Contrôle mobile de la carte avec source et d’une carte sans repère, des textes longs et de la navigation. Ces observations de navigateur ne constituent pas un essai sur iPhone physique.

## Révélation D4 associée

Après le résultat confirmé et la fin de l’animation du dé, seule la carte choisie se défloute dans la grille en 380 ms. Une pause de lecture de 1 100 ms précède la fiche d’invitation. La relance garde l’ancienne carte lisible et exclue. Les autres cartes ne contiennent pas leur titre caché dans le DOM. Les statistiques n’apparaissent qu’après la transition.

La carte choisie est amenée dans la zone visible de `main`, y compris aux emplacements 3 et 4. La navigation, la perte de session ou la mise en arrière-plan annulent proprement la présentation ; le résultat confirmé reste conservé. La réduction du mouvement garde la pause, avec une révélation sans animation.

Vérification chronométrée en navigateur : révélation sans panneau statistique, fin du défloutage, puis fiche après environ 1,1 seconde, pour le tirage et la relance. Aucun tirage réel, quota, compte ou score n’a été modifié. Xcode et ZIP restent à l’identique.
