# Audit mobile — Dés·ir, 3 novembre 2026

## Correctif après retour sur iPhone installé — 3 novembre 2026

Le retour réel de l’utilisateur signale une bande noire sous le menu et des icônes trop petites. Les observations navigateur antérieures ne suffisaient pas à valider ces deux points sur appareil.

- Icônes mobiles de20à32px, libellés12px, boutons d’environ61px de haut. Les trois colonnes gardent une largeur égale. Le dé conserve ses dimensions.
- En mode installé, la hauteur de l’app utilise la hauteur CSS complète (`100vh`), au lieu d’être écrasée par une `visualViewport.height` pouvant exclure la zone de statut sur iOS. Le clavier conserve une adaptation spécifique quand un champ est actif et que la réduction dépasse150px. Le zoom ne déclenche pas ce changement.
- Le fond de `html`, `body`, de la navigation et les couleurs du manifeste sont identiques jusqu’au bord inférieur. La zone du geste système reste protégée ; aucun second panneau noir n’est ajouté.
- Ce diagnostic s’appuie sur la lecture du code et les signalements [WebKit254868](https://bugs.webkit.org/show_bug.cgi?id=254868) et [313800](https://bugs.webkit.org/show_bug.cgi?id=313800). Il ne prouve pas que le même défaut WebKit est présent sur cet appareil.
- Contrôle navigateur avec un viewport visuel simulé raccourci de62px : variable812px et hauteur réelle874px (17Pro), puis894px et956px (16ProMax) ; bas du menu aligné sur le bas du cadre. Trois icônes32×32px au repos. Régression clavier et affichage installé couverte par329contrôles UI.

**La disparition de la bande sur l’iPhone physique reste à confirmer après publication.** Le simulateur de dimensions ne remplace pas ce contrôle.

Cette passe répond aux deux défauts signalés : des écrans inutilement longs et un menu situé après le contenu, inaccessible sans descendre. Elle intègre la correction suivante de l’utilisateur : **le dé doit conserver sa présence ; les autres modules doivent prendre moins de place**.

## Constats et corrections

| Nature | Constat | Modification appliquée |
|---|---|---|
| Défaut de structure | `main` imposait 576 px minimum, auxquels s’ajoutaient en-tête, identités, marges et navigation. Le cadre grandissait avec la page. | Coquille mobile bornée au viewport, disposition verticale, `main` flexible avec `min-height:0`. Un seul défilement dans le contenu. |
| Défaut d’accès | Le menu se trouvait après tout le contenu. | Navigation dans une zone réservée hors de `main`, visible dès le premier écran de jeu après la connexion et pendant tout défilement. Aucune superposition avec les cartes. |
| Ajustement de hiérarchie demandé | Le premier essai raccourcissait la scène des dés et rendait l’objet principal trop petit. | Essai abandonné. D6 : scène de 272 à 320 px ; D4 et D20 : au moins 238 px, soit la hauteur initiale, puis 262/272 px dans les grands cadres installés testés. Renderer, proportions des objets et règles inchangés. |
| Ajustement esthétique | Titres d’ambiance, barre des identités et grille des catégories occupaient trop de hauteur par rapport au lancer. | Identités plus fines ; grand titre d’ambiance du D6 masqué visuellement tout en restant un H1 accessible ; date et catégorie conservées. Six catégories dans deux rangées de bandeaux informatifs, avec les six couleurs, les numéros et les libellés. |
| Défaut d’accès aux actions | Une statistique ou un titre long pouvait repousser la réponse sous l’écran. | Actions de carte ancrées dans la zone de contenu lorsque nécessaire. Proposer reste prioritaire et sur toute la largeur ; D20 et relance occupent la rangée suivante. Les boutons de lancer restent accessibles sur les vues courtes. Les textes et les sources ne sont pas tronqués. |
| Élément sans action | Le gros bouton désactivé « Tirage… » consommait de la place pendant le retirage. | Ligne d’état compacte : attente réseau puis « Le dé roule… ». Les quatre emplacements restent présents ; ancienne carte lisible et exclue, trois aperçus floutés sans titre secret. |
| Défaut de continuité | La page entière était utilisée pour certains retours en haut ; une mise à jour pouvait affecter une lecture en cours. | Les nouvelles vues reviennent en haut de `main`. Une actualisation de la même vue préserve sa position, la source ouverte et son focus. Nous et À faire ne changent pas de clé lorsque le tour évolue en arrière-plan. |
| Défaut de transition observé | L’animation de translation du bloc d’actions ancré pouvait le déplacer brièvement vers le menu. | Fondu seul sur les blocs ancrés ; déplacements organiques conservés sur les autres composants. |
| Adaptation du viewport | Le clavier et les barres de Safari changent l’espace réellement visible. | `viewport-fit=cover`, insets système, `100dvh` en repli et hauteur issue de `visualViewport` à zoom normal. Le zoom n’est pas recalculé comme une réduction de l’écran. Écouteurs suspendus/repris avec la page. |

## Système visuel et interactions

Palette minérale, corail désaturé, grade bleu ardoise, grain et matière rubber/suédine conservés. Le dé est le premier objet visuel de l’écran de lancer ; les catégories sont des repères secondaires. Le grand pourcentage reste dominant dans la carte. Aucune mécanique, carte, statistique, quota, probabilité ou donnée du couple n’a été modifié.

La réduction des hauteurs des identités et des catégories concerne des éléments informatifs. Les boutons de navigation gardent 48 px minimum en CSS, l’aide 44 px, les actions principales 48 px et les sources 44 px. Les champs restent à 16 px et les zones de saisie à 50 px. Le menu respecte la zone du geste d’accueil ; le paysage prend aussi en compte les marges latérales.

La modale verrouille le contenu défilant, puis restitue position et focus à la fermeture. Les attentes réseau restent explicites. Le maintien du bouton et le dé conservent leur animation ; l’aléatoire reste indépendant de la puissance visuelle. La préférence de réduction des animations reste prise en charge.

## Vérification effective

Les essais navigateur utilisent les sources reconstruites, des états fictifs valides et des cadres de dimensions **mesurées dans le document**. Le service réel n’est jamais appelé par ces pages. Les zones sûres sont simulées dans ces seuls aperçus ; la production lit les insets fournis par le téléphone.

| Cadre CSS vérifié | Cas | Scène D6 | Scène D4 / D20 | Résultat |
|---|---:|---:|---:|---|
| 402 × 874, installé, insets haut/bas simulés 59/34 px | 49 | 306 px | 262 px | Menu visible ; D6 et D4 sans défilement. |
| 440 × 956, installé, insets haut/bas simulés 59/34 px | 49 | 320 px | 272 px | Même résultat. |
| 402 × 700, Safari à hauteur réduite | 49 | 272 px | 238 px | Menu et actions de jeu accessibles ; D6 et D4 sans défilement. |
| 440 × 780, Safari à hauteur réduite | 49 | 273 px | 238 px | Même résultat. |
| 874 × 402 et 956 × 440, paysage avec insets latéraux simulés | 14 | ≥ 272 px | ≥ 238 px | Navigation et actions accessibles ; défilement du contenu conservé. |
| 402 × 380, connexion à hauteur de clavier | 1 | — | — | Champs et connexion accessibles. |

**211 observations état/format**, couvrant introduction, connexion et erreurs, quotas, deux mondes, cartes cachées, six catégories, titres et statistiques longs, D20 des deux joueurs, invitations, confirmations, tâches, fins de tour, score/grade et réglages de notification. Aucun débordement horizontal, défilement de la page ou texte accidentellement tronqué dans les éléments mesurés. Le H1 visuellement masqué du D6 est intentionnel et exclu du contrôle de troncature.

Contrôles interactifs complémentaires :

- source dépliée et défilement dans `main` sans déplacement du menu ;
- changement d’onglet et retour en haut ;
- ouverture/fermeture de l’aide avec restitution de la position ;
- retirage avec grand D4 et ancienne carte au quatrième emplacement : les quatre tuiles restent visibles à 402 × 700, titre maximal de 66 caractères lisible, trois aperçus floutés ;
- reprise des modales, conservation du focus/des sources et adaptation de hauteur couverts aussi par les tests UI.

**269 contrôles UI automatisés réussis**, ainsi que la reconstruction du livrable et les autres suites du projet. Le code serveur et l’archive Xcode restent inchangés. Les captures et mesures de cette passe sont conservées hors des sources publiques dans `ui-mobile-2026-11-03`, voisin du dépôt.

## Limites

Il s’agit de vérifications réelles dans un navigateur avec formats simulés, pas d’essais sur les deux téléphones physiques. La livraison de notifications iOS, le clavier système et VoiceOver sur appareil, les variations exactes des insets et les performances GPU doivent encore être contrôlés sur matériel. Les longues sources et les listes de tâches restent défilantes par nécessité ; la navigation et les actions restent disponibles.

Les cadres retenus correspondent aux deux modèles ciblés. Fiches matérielles de référence : [iPhone 17 Pro — Apple](https://support.apple.com/en-au/125090), [iPhone 16 Pro Max — Apple](https://support.apple.com/en-us/121032). Ces fiches ne remplacent pas la mesure du viewport effectif dans Safari.
