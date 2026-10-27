# Équilibrage v26

- Classique 20 Éclats ; thèmes 25 ; Assassin 25 ; Druide 18 ; Voleur 8.
- Chaque récompense Éclats vaut 1, fréquence inchangée (60 % sur les deux cases flexibles, hors garantie des boosters thématiques).
- Communes (finition standard, Énergies incluses) : groupes exacts de trois pour 1 Éclat. Les autres tarifs et leur décote restent identiques.
- Tout groupe incomplet est refusé sans consommer de carte. Lots mixtes autorisés, maximum 50 exemplaires par opération. Une tentative rejouée ne donne pas de second crédit.
- Bonus/malus des rituels : 1/2/3/6/10, plancher −12, trois achats par semaine. Aucune réécriture des soldes, cartes, découvertes, reçus, échanges ou événements.
- Accès direct aux lots depuis Boutique → Recycler, trois emplacements de prévisualisation. Les trois cartes visibles sont fragmentées ensemble après confirmation serveur ; les lots plus grands sont représentés par leurs trois premiers exemplaires.

Validation : 14 tests JS, PGlite (lots incomplets, groupes, mélange foil/communes, nouvelle tentative, prix, quota, aides et accès anon), trois gestes réellement effectués dans l’aperçu isolé : solde 60 → 61 pour trois Énergies.

# Vérification Push iPhone

Audit du 27 octobre 2026 : manifeste standalone, HTTPS public, service worker Push + notificationclick, permission demandée depuis un clic, inscription protégée par le jeton du profil, clé VAPID publique identique client/expéditeur. Edge Function push-send active v2, bibliothèque web-push 3.6.7, garde de dispatch présente. Triggers et tâches planifiées présents. La fonction quotidienne filtre l’heure de Paris à 5 h, évitant l’envoi du second créneau UTC.

Aucun abonnement enregistré au moment de l’audit : ni inscription iPhone ni livraison distante ne peuvent être considérées comme validées. Aucun envoi réel déclenché pendant les tests.

iOS 16.4 minimum : ajouter la version HTTPS à l’écran d’accueil, l’ouvrir depuis son icône, se connecter au bon profil, ouvrir les règles puis activer les notifications. Vérifier ensuite une réception réelle écran verrouillé et le retour dans l’app. Les réglages Notifications/Concentration d’iOS peuvent masquer l’alerte.

Sources : https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
