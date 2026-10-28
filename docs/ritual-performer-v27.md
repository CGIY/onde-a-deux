# Défis adressés au partenaire

Le propriétaire de la carte est le poseur ; son partenaire est l’exécutant. L’exécutant demande la validation ou laisse passer le défi. Le poseur valide/refuse. Le solde modifié est celui de l’exécutant : +valeur après validation, −valeur après refus, abandon ou expiration sans demande. Les valeurs et le plancher −12 restent inchangés.

Une demande de validation a toujours 24 heures de réponse. L’absence de réponse du poseur ne pénalise pas l’exécutant (mouvement neutre, comme auparavant). Les cartes en attente restent visibles au-delà de leur compteur initial. Les demandes anciennes sont interprétées à partir du propriétaire de la carte, sans réécriture des historiques.

Le changement n’altère aucun solde, carte, découverte, reçu, échange ni événement lors de son application. Pas de recalcul rétroactif. Les notifications vont au poseur pour la validation et à l’exécutant pour le résultat.

Validation : scénarios SQL isolés par l’API pour AG et CL, autorisations inversées refusées, récompense/malus, expiration, plafond de dette, répétition interdite, demandes anciennes, visibilité après délai initial, destinataires Push et refus anon. Tests des contrôles UI pour les deux profils et suite JS complète.
