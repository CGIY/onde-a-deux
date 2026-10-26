# Cartes v13 — Gestes tactiles et cohérence

## Correctif prioritaire

La perte de capture d’un enfant remonte jusqu’à la fenêtre. Sur écran tactile,
le transfert de capture implicite de l’illustration vers la fenêtre pouvait annuler
le glissement dès son premier mouvement. Les trois moteurs (ouverture, feuilletage,
découpe) ne traitent désormais que la perte de capture de leur propre surface.
La carte se déplace indépendamment de son animation d’apparition. La file de gestes
est limitée à une intention supplémentaire pour éviter de défiler longtemps après
le dernier mouvement du doigt. Les quatre directions et la boucle restent disponibles
sur la totalité de la fenêtre, hors fermeture et champs de saisie.

## Interface

- Album à deux colonnes sur téléphone, trois puis quatre sur grand écran.
- Tri par échéance, acquisition ou rareté ; effacement des filtres.
- Numéro d’emplacement découvert dans le pied de carte, sans révéler les inconnues.
- Badge des doublons translucide, dépliage des exemplaires animé.
- Progression par édition ; position de défilement retrouvée entre les vues.
- Description lisible sous la grande carte, sans répétition dans l’illustration.
- Cartes réservées signalées dans la collection.
- Propositions d’échange illustrées et galerie pour les cibles des sorts/Jokers
  et le choix des défis légendaires. PRESTO/ADAGIO montrent le temps avant/après.
- Bandeau : passage au glissement, trois repères, pause avec zone de 44 px,
  reprise possible quand le bouton garde le focus et début d’annonce configurable.
- Indication réseau discrète, erreurs plus précises, déconnexion de cet appareil.
- Navigation clavier des onglets et respect des listes/champs dans les fenêtres.
- Anciennes épingles retirées du rendu et des styles. Données historiques conservées.

## État et serveur

Les échéances retirent immédiatement les actions et exemplaires expirés de la vue
locale, sans effacer les découvertes ni écrire de transition de jeu côté navigateur.
Une fenêtre de détail ouverte suit l’état reçu. Les réponses réseau sont ordonnées :
un ancien sondage ne restaure jamais une main antérieure à une mutation.
Une réponse perdue est vérifiée par une synchronisation et un événement/état exact ;
aucune mutation n’est répétée automatiquement.

Le transport a son propre module testé en entier. Les compteurs ne réécrivent plus
un texte identique et le cycle des légendaires s’arrête hors écran. Les styles ont
été remis en forme et débarrassés des règles d’épingle. Une mise à jour du service
worker attend une sortie sûre des fenêtres d’ouverture/destruction.

Migration `20261026111242_daily_release_recovery_and_history` :
- récupération des seules distributions quotidiennes encore dans leurs 48 heures,
  à 5 h à Paris, y compris les journées de changement d’heure ;
- même unicité des distributions et indépendance des cadeaux ;
- historique extensible jusqu’à 500 entrées par source ;
- titre choisi conservé dans l’historique des légendaires ;
- calculateur de calendrier privé, sans droit d’exécution anonyme.

La migration change des fonctions. Elle ne remet à zéro et ne réécrit aucun tirage,
challenge, inventaire, événement ni découverte existant. Anniversaire et Noël restent
des annonces sans cartes ni récompenses supplémentaires.

## Validation

Dix suites Node : capture tactile transférée, quatre directions, interruption,
boucle, geste rapide, ouverture reprise, réponse perdue, état réseau ancien,
expiration, confidentialité des cibles, inventaire et choix légendaire.
Tests SQL avant puis après migration dans des transactions annulées : frontières
5 h/48 h, heure d’été/hiver, catalogue de 100 cartes, absence de tirage lors d’une
synchronisation et idempotence des distributions.

Vérifications natives de navigateur en format téléphone : glissements de 24 px
sur les cartes et dans les marges dans les quatre directions, boucle 3→1 et 1→3,
sélection des cibles et filtres. Cela ne remplace pas un essai sur deux iPhone réels.
L’audit des droits confirme le modèle existant : accès direct aux tables révoqué,
API avec validation du profil et du jeton. Aucun mécanisme de limitation des
connexions n’a été ajouté dans cette livraison.
