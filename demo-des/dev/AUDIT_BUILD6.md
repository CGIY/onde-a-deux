# Dés·ir 0.3.0 — build 6

Suite du diagnostic build 5 : nom visible Dés·ir, texture renforcée, typographie plus fine, palette minérale assourdie, profils symétriques pleine largeur et icônes SVG sur la même grille. Ombre WebGL et secours 2D du dé réduits ; halos CSS supprimés.

## Parcours et cadence

Le D6 choisit une des six catégories à chances égales. Le D4 révèle une des quatre cartes cachées. Le tireur propose directement ou tente ses deux D20 ; après échec, la proposition est envoyée au destinataire. Le destinataire accepte ou tente son propre D20. Un échec ne déclenche aucune acceptation automatique.

Pas de quota quotidien ; une seule manche de tirage en cours. Après validation à deux, l’action est ajoutée à À faire et un nouveau tour est possible. Le rôle de tireur alterne, indépendamment du profil qui coche les tâches précédentes.

## À faire et score

Une tâche conserve le titre de carte, la proposition éventuelle, les deux profils, la date de validation et une échéance exacte six heures plus tard. Chaque profil modifie uniquement sa propre case. Le remplissage par vague est bref, sans boucle ; la réduction du mouvement est respectée.

Deux coches retirent la tâche et ajoutent exactement un point commun. À six heures, la tâche est retirée sans point. Les demandes de coche hors délai, doubles clics et appels d’un ancien bouton de complétion ne contournent pas ces règles. Les échéances sont contrôlées dans le moteur à chaque coche, dans un minuteur dédié et au retour à l’écran. Les anciennes tâches ne modifient pas une autre manche en cours.

## Vérifications

567 assertions moteur : 374 parcours D20, 43 score cumulé, 61 règles/migrations, 89 tâches (deux profils, échéance, doublons, ancien historique, nouvelle manche, restauration). Contrôle des 88 sources et résultats distincts, QA de 30 poses et 15 raccords du dé, JavaScript, parité du HTML et ZIP. Compilation simulateur Xcode.

Observation navigateur : liste de deux tâches à six heures et cinq heures quarante-cinq, première coche conservée, bascule du profil sans quitter la liste, retrait après seconde coche et score commun de un point. Contrôle de l’alignement, du grain et de la navigation au format téléphone.

Les 88 repères contiennent 72 métriques en pourcentage. Les enquêtes d’opinion et de préférence sont identifiées comme telles, avec leur organisme et leur population ; elles ne sont pas présentées comme des effets expérimentaux. Les preuves scientifiques utilisent de vrais pourcentages lorsqu’ils sont pertinents. Les coefficients non convertibles et les scores ne sont jamais transformés artificiellement en probabilités ou en bénéfices. Les études connexes sont identifiées dans leur contexte dépliable.

## Limites

La démo conserve les deux profils localement sur cet appareil. Le délai dépend de son horloge. Ni synchronisation distante, ni notification système, ni performance GPU sur iPhone physique ne sont validées.
