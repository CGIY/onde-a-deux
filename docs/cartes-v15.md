# Cartes v15 — Scènes saisonnières et anniversaire

Le bandeau garde ses trois faces et sa hauteur de 46 px. Le bouton pause est retiré.
Le passage automatique reste suspendu au survol, au focus et hors écran ; le réglage
système de réduction des mouvements conserve une navigation manuelle sans animation.

Halloween garde ses chauves-souris. L’anniversaire affiche quatre silhouettes de
mammouths de tailles différentes, en marche au bas du bandeau (pattes et léger
balancement indépendants). Noël affiche douze flocons et un petit traîneau avec
le Père Noël et trois rennes en arrière-plan. Les scènes reprennent la transparence,
la profondeur et les silhouettes monochromes du bandeau Halloween. Elles sont
inertes, masquées aux lecteurs d’écran, arrêtées sur les faces inactives et hors écran.

## Anniversaire de Mamamouth : 8 novembre 2026, heure de Paris

- AG uniquement : un booster offert, disponible à minuit, avec son propre délai de
  48 heures, récupérable jusqu’au 10 novembre à minuit même en cas d’absence.
- Aucune modification du prochain booster quotidien à 5 h.
- Le 8 novembre de 00:00 inclus à 24:00 exclu : probabilités des finitions rares ×2
  sur les tirages concernés de Mamamouth. Commune 39 %, full art 40 %, foil 16 %,
  full art + foil 4 %, légendaire 1 %. Énergie garantie, Joker et catégories inchangés.
- Le bonus dépend du moment d’ouverture, y compris pour les boosters déjà disponibles.
  Le cadeau ouvert le 9 novembre conserve les probabilités normales.
- CL garde ses probabilités et distributions habituelles.
- Pas de nouvelle carte pour cet événement ; Noël reste une annonce.

Le bandeau annonce « AG · +1 booster · chances ×2 ». Le booster offert porte la
mention anniversaire lorsqu’il devient disponible. Aucun cadeau n’est créé avant
la date prévue et aucune sauvegarde, découverte, carte ou événement existant n’est
réinitialisé. Le cadeau a une clé unique pour empêcher un double versement.

Migration 20261026163251. Tests SQL avant/après dans des transactions annulées :
frontières de calendrier à Paris, distinction AG/CL, distribution exacte des cinq
finitions, exception du booster de test sans légendaire, unicité et durée du cadeau.
Tests du carrousel, des scènes décoratives, de l’absence du bouton pause et des
contraintes de mouvement réduit. Vérification de lisibilité à 320 et 390 pixels.
La texture crème renforcée de v14 est conservée.
