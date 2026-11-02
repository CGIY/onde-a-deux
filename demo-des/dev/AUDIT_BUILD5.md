# Audit ONDE 0.3.0 — build 5

Périmètre : sources de la démo `demo-des/dev`, rendu des dés, sauvegardes, règles, fiches et ressources Xcode. Le reste du dépôt est indépendant de cette démo.

## Défauts corrigés

- Jauge D20 absente de l’interface malgré les styles existants : rétablie pour les deux profils, avec résultats séparés, probabilité conditionnelle et animation des PV. Le résultat à zéro reste visible.
- Commandes de lancer affichées au mauvais profil : remplacées par le retour au profil attendu.
- Anciennes sauvegardes : les deux anciennes formes de score sont reconnues ; aucun compteur inconnu n’est éliminé silencieusement. Les PV d’une manche ne sont plus écrasés lors d’une mise à jour du catalogue.
- Sauvegarde illisible : copie locale de récupération avant remplacement. Si cette copie échoue, le stockage original n’est pas écrasé.
- Alternance dépendant de la personne qui clôturait le tour : le nouveau tireur est désormais l’autre personne, avec changement du profil actif.
- Répétitions : jusqu’aux huit derniers tirages de la catégorie sont évités, en gardant quatre cartes pour le D4.
- Spoil : retrait de l’onglet catalogue, des titres avant le D4 et des contrôles de favoris devenus sans écran. Les données historiques des favoris sont conservées.
- Statistiques identiques sur de nombreuses cartes : remplacement par 88 résultats distincts, identifiés par source et mesure. Contrôle automatique de couverture et d’unicité ; sources et limites accessibles sur chaque fiche.
- Focus perdu lors des rendus : restitution du contrôle pour un réglage et passage au titre pour une nouvelle étape.
- Célébration invisible : dimensions des particules rétablies.
- Animations qui bougeaient les surfaces de lecture en permanence : arrêt des boucles longues, retour tactile court, révélation liée à une nouvelle carte, jauge animée par transformation.
- Affichage `null min` sur le résultat : retiré, aucune durée n’étant imposée aux nouvelles cartes.
- Retrait des descriptions génériques, répétitions de consentement et tutoriels dans les écrans, conformément à la demande. Les opérations de jeu sont conservées.

## Règles retenues

88 cartes, six catégories dont Projets. D6 uniforme, main mélangée de quatre cartes cachées puis D4 uniforme. Une manche active, sans quota quotidien ; deux D20 par personne au maximum. Le seuil est l’instantané de la manche. Une carte partagée vaut un point commun.

Probabilités exactes de deux D20 : 10 PV 91 % ; 15 PV 77,25 % ; 20 PV 57,25 % ; 25 PV 34 % ; 30 PV 16,5 % ; 35 PV 5,25 %. Après un premier jet, la probabilité affichée est recalculée sur le seul jet restant.

## Vérifications

470 assertions du moteur : 366 du parcours D20, 43 du score, 61 des règles et migrations. QA du dé : 30 poses, 15 raccords de phases, annulation, réduction du mouvement, DPR 2 et secours numérique D6. Contrôle des 88 correspondances statistiques, des résultats distincts et de l’intégrité du retour de données. Syntaxe JavaScript, parité des HTML, intégrité du ZIP et compilation simulateur Xcode.

Observation dans le navigateur : six catégories, D4 face cachée, carte allégée et source dépliable, jauge des deux jets, séparation des profils, paramètres et navigation sans catalogue. Format téléphone contrôlé.

## Limites

Les résultats sont positifs mais certaines preuves sont connexes, observationnelles, limitées à un programme ou à une population particulière ; ces limites sont indiquées dans les fiches. Un résultat peut avoir le même nombre arrondi qu’un autre tout en portant sur une autre mesure. L’unicité concerne le résultat scientifique, pas l’écriture artificielle d’un nombre.

La démo reste locale, avec deux profils simulés. Ni performances GPU sur iPhone physique, ni synchronisation distante, ni notification système ne sont validées ici.
