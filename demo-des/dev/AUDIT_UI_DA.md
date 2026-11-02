# Audit UI et direction artistique — Dés·ir 0.3.0

État initial et contre-vérification des corrections : 2 novembre 2026. Audit des sources puis contre-vérification effective dans le navigateur, documentée en clôture. Les corrections UI et renderer sont présentes dans le livrable web. Aucun téléphone physique utilisé.

## Périmètre et méthode

Sources lues : `src/onde-app-ui.html`, `src/onde-app-ui.js`, `src/onde-app-dice.js`, `src/onde-app-remote.js`, `build.py`, `../sw.js`, `../manifest.webmanifest` et tests UI/transport existants. Le moteur métier et les données des cartes ne sont pas modifiés par cet audit.

Les constats ci-dessous séparent la preuve dans le code de ses conséquences à vérifier visuellement. Les calculs utilisent sRGB et la luminance relative WCAG : `(Lclair + 0,05) / (Lsombre + 0,05)`. Les mélanges `color-mix(in srgb, …)` et les transparences sont composés sur leurs fonds déclarés. Un contraste de couleurs nominal n’est pas une certification WCAG : grain, dégradés, positions exactes du texte, focus natif et rendu réel restent à mesurer.

Repères de lecture : 4,5:1 pour le texte courant ; 3:1 pour du grand texte et certains repères non textuels. Références W3C vérifiées : [contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) et [contraste non textuel](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). La cible de confort de 44 × 44 px demandée pour ce projet est distinguée du [minimum de WCAG 2.2 AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) : une cible de 40 px n’est pas automatiquement un échec AA.

## Défauts objectifs et corrections ciblées

| Priorité | Constat et preuve source | Effet / correction attendue | État |
|---|---|---|---|
| P1 | Haut des cartes éclairé par `color-mix(category 58%, #3a3932)` et un radial de pigment à 68 %, avec un tag de 10 px éclairci vers le blanc. Sur le seul endpoint linéaire, le tag ne donne que 2,75–3,26:1 ; dans l’enveloppe du point lumineux, 1,69–2,25:1. Le titre clair peut également tomber sous 3:1 dans cette enveloppe. Classes `.oa-playing-card`, `.oa-card-category`, `.oa-card-title`. | Le texte ne doit pas partager la zone la plus claire du pigment. Assombrir sa surface ou déplacer l’éclairage vers l’illustration, en conservant les six couleurs. Ne pas « corriger » en ajoutant une ombre floue à tout le texte. La position effective du minimum est à contrôler sur les six catégories. | Corrigé en sources : radial à 18 % / base à 30 %, tag clair. Calcul final ci-dessous ; QA visuelle à compléter. |
| P1 | `#onde-app-v1 canvas` reçoit `touch-action:none`. Le renderer initial capture le pointeur dès `pointerdown` et appelle `onRelease` sur le relâchement. Aucun seuil de déplacement vertical dans cette version. | Un départ de défilement dans les 238 px de scène peut être absorbé. La scène doit laisser défiler ; la charge du bouton doit s’annuler sur scroll, `pointercancel`, perte de capture, changement d’onglet ou perte de focus. Aucune annulation ne doit déclencher un lancer. | Corrigé en sources : pan-y, annulation après déplacement de 10 px, cancel/perte de capture/scroll/blur. QA tactile à compléter. |
| P1 | `dispatch()` pose seulement `operationBusy` et la classe `is-busy` pour SEND/ACCEPT/NEW. La règle CSS de busy cible seulement `data-action=roll`. Les boutons concernés restent dessinés comme disponibles, alors que le gestionnaire ignore leurs clics. Le transport a un délai de 20 s et jusqu’à deux tentatives. | Une attente réseau peut sembler être un clic sans effet. Ajouter un état d’attente visible, `aria-busy` et une désactivation ciblée pendant l’opération ; restaurer l’action après erreur sans fausse validation. | Corrigé en sources : boutons désactivés, texte d’attente et aria-busy. |
| P2 | `.oa-login .oa-field input` : bord `#79887366` sur champ `#162019b3`, lui-même sur la surface sombre. Composition indicative : fond `#1b231c`, bord `#414b3f`, 1,77:1 côté intérieur et 1,61:1 côté extérieur. | Le repère du champ se détache peu du fond. Renforcer le bord sans éclaircir tout le formulaire ; vérifier également le focus clavier et le focus avec clavier iOS. | Corrigé en sources : bord opaque #99a88e, fond #162019e6 ; calcul final ci-dessous. |
| P2 | `.oa-toast` est `position:absolute; bottom:92px` dans la coquille, dont la hauteur suit la liste de tâches. | Après une coche en haut d’une liste longue, succès et erreurs peuvent être annoncés tout en restant visuellement près du bas de la page, hors écran. Ancrer le message au viewport en le bornant à la largeur de l’app et à la zone sûre, ou le rendre près de l’action. | Corrigé en sources : position fixed, largeur bornée, bottom de 24 px + safe-area ; QA liste longue à compléter. |

Correction sémantique complémentaire : l’intitulé existant du score devient un H1 et le nom du grade un H2, avec les mêmes styles visuels. Le lecteur d’écran dispose ainsi d’une hiérarchie cohérente dans Nous sans réintroduire de grand titre décoratif.

Aucun de ces points ne demande de changer le nombre de cartes, les PV, les quotas, les points ou le fonctionnement du D20.

## Couleurs : mesures initiales utiles

Les valeurs suivantes sont calculées depuis la cascade CSS initiale, sans échantillonnage de capture. Les dégradés sont indiqués comme des bornes de couleurs, pas comme la position réelle du texte.

| Élément | Texte / fond déclaré ou composé | Rapport nominal |
|---|---|---:|
| Bouton principal, endpoint sombre | `#2b211b` / `#bd8d7d` | 5,44:1 |
| Bouton secondaire, endpoint sombre | `#142b2d` / `#809fa7` | 5,26:1 |
| Grand score corail, endpoint clair | `#faecdc` / `#6b4e47` | 6,45:1 |
| Texte courant secondaire | `#bdc0b7` / `#282923` | 7,95:1 |
| Statut du badge initial | `#b6aca6` / `#373535` | 5,48:1 |
| Statut badge acquis initial | `#e3c3b0` / `#614c47` | 4,82:1 |
| Progression textuelle du badge initial | `#c7b3a7` / `#373535` | 6,06:1 |
| Texte de navigation inactif | `#9eab97` / `#24211f` | 6,65:1 |
| Icône inactive, après opacité 0,62 | `#707769` / `#24211f` | 3,43:1 |
| Étiquette de catégorie dans la grille D6 | Selon les six pigments et leur endpoint à 34 % | 4,66–5,90:1 |

Cela ne justifie pas d’augmenter globalement la saturation, la taille ou la luminosité. Le besoin de contraste concerne surtout les surfaces derrière les textes et les repères de formulaire. Le changement du grade vers un bleu ardoise désaturé est une décision de distinction visuelle demandée par l’utilisateur, séparée de ces défauts de lisibilité. Le score reste corail.

### Contre-vérification des nouvelles couleurs

Même enveloppe théorique avant/après : endpoint supérieur du dégradé composé avec le maximum du radial. La nouvelle base utilise 30 % du pigment sur `#282928`, son radial 18 %, et le tag `#f8eedf`. Ces minima sont **sans contribution du grain** ; ce sont des vérifications des couleurs de base, pas des mesures de pixels finaux. Le titre, entre 25 et 28 px en graisse normale, relève du repère de grand texte à 3:1. Le tag de 10 px doit être contrôlé au repère de 4,5:1.

| Catégorie | Tag avant | Tag après | Titre avant | Titre après |
|---|---:|---:|---:|---:|
| Complicité | 1,83:1 | 5,10:1 | 2,05:1 | 4,88:1 |
| Détente | 1,77:1 | 4,92:1 | 1,94:1 | 4,70:1 |
| Projets | 2,25:1 | 6,28:1 | 2,90:1 | 6,01:1 |
| Attentions | 1,69:1 | 4,69:1 | 1,80:1 | 4,49:1 |
| Bouffe | 1,90:1 | 5,35:1 | 2,21:1 | 5,12:1 |
| Intimité | 1,98:1 | 5,57:1 | 2,36:1 | 5,32:1 |

| Élément corrigé | Couleurs finales / endpoint le plus clair | Rapport nominal |
|---|---|---:|
| Titre du grade bleu | `#e5eaec` / `#46535f` | 6,50:1 |
| Statut du grade bleu | `#c9d6df` / `#46535f` | 5,32:1 |
| Progression textuelle du grade bleu | `#c7d2d8` / `#46535f` | 5,12:1 |
| Icône du grade bleu | `#263642` / `#9aafbe` | 5,48:1 |
| Bord de champ, côté intérieur | `#99a88e` / fond composé≈`#18211a` | 6,57:1 |
| Bord de champ, côté extérieur | `#99a88e` / `#282923` | 5,83:1 |

Le score corail conserve ses 6,45:1 nominaux. La marge la plus faible des nouveaux tags est celle d’Attentions : 4,69:1 avant grain. Le grain soft-light peut modifier la luminance locale ; contrôler cette zone dans le rendu final sans annoncer une conformité globale sur la seule base du tableau.

La source et les profils de simulation passent à 44 px de hauteur minimale. La scène autorise maintenant `pan-y pinch-zoom` pour préserver le défilement vertical et le zoom par pincement ; le geste physique reste à contrôler sur téléphone. Les boutons de charge gardent `touch-action:manipulation`. La puissance est calculée localement sur 1 200 ms et transmise uniquement aux options du renderer ; les requêtes de jeu restent `{type,roundId}`. Le renderer borne sa durée entre 1 650 et 2 500 ms et limite la déformation à 18 %. Ces plafonds sont vérifiés dans le code, indépendamment d’une réponse réseau qui peut durer davantage.

### Reproduire les calculs

Pour chaque composante sRGB normalisée `c`, utiliser `c/12,92` si `c ≤ 0,04045`, sinon `((c+0,055)/1,055)^2,4`. Puis `L = 0,2126 R + 0,7152 G + 0,0722 B`. Une transparence ou un mélange sRGB de poids `a` donne `a × avant-plan + (1-a) × fond` avant conversion en luminance.

## Responsive, lecture et cibles

- À 320 px, la cascade finale initiale conserve 6 px de padding sur chaque côté du root, puis 1 px de bord sur chaque côté du shell et 16 px de marge intérieure du main, soit **274 px utiles**. La grille des six catégories conserve trois colonnes de 86 px. La navigation demande au minimum `3 × 76 + 2 × 8 = 244 px`, dans 264 px disponibles après ses marges : aucun débordement n’est imposé par ces seuls minima.
- À 390 px, la marge principale repasse à 22 px : **332 px utiles** avec la même cascade. À 768 px et sur desktop, le shell est limité à 452 px, soit 406 px utiles dans le main. Ce choix étroit conserve l’identité mobile ; il ne constitue pas un défaut de responsive.
- Cascade à trancher en QA : la media query mobile du head généré par `build.py` demande padding/radius/bords nuls ; la CSS UI injectée après elle rétablit le padding de 6 px et le cadre arrondi. Le rendu initial est donc encore encadré. C’est une incohérence de sources à expliciter, **pas** une raison de retirer automatiquement le cadre ou de changer une préférence visuelle.
- Les boutons principaux ont au moins 50 px de hauteur ; la navigation 52 px ; aide/fermeture 44 px. La case de tâche est visuellement de 36 px mais sa cible est le label de hauteur minimale 44 px : il ne faut pas confondre taille de l’icône et surface interactive.
- Le réglage sonore est lui aussi enveloppé dans un label avec texte et marge verticale. Son seul interrupteur de 41 × 25 px n’est pas sa cible complète.
- Écarts initiaux à l’objectif de confort de 44 px corrigés en sources : résumé « Source & contexte » de 40 à 44 px ; profils de simulation de 42 à 44 px. Les noms des joueurs de la version connectée sont des textes, pas des boutons à agrandir.
- Titres longs : les titres de cartes utilisent le retour à la ligne normal et `text-wrap:balance`. Les grands compteurs ont `overflow-wrap:anywhere` et `min-width:0`. Vérifier les plus longs intitulés réels et un score extrême sans en déduire un problème visuel absent.
- Noms longs dans les tâches : le label est compressible, mais le span de nom ne possède pas de règle explicite de retour pour un mot très long. À vérifier à 320 px ; les noms réels courts ne démontrent pas ce cas extrême.

## Matrice initiale de QA — périmètre prévu

Cette matrice conserve la liste initiale des contrôles ; les résultats effectivement réalisés, leurs largeurs et leurs limites figurent en clôture. « À vérifier » dans ce plan ne vaut pas validation, notamment pour les appareils physiques.

| Écran / état | Points précis | Statut visuel |
|---|---|---|
| Accueil initial | Icône, titre, bouton, focus d’entrée ; pas de navigation ou de noms derrière l’introduction. | À vérifier |
| Connexion | Reprise de session, formulaire vide, saisie/autofill, identifiants refusés, hors ligne, session révoquée ; saisie conservée pendant les mises à jour de fond, mot de passe absent du stockage. | À vérifier |
| D6 disponible | Trois faces lisibles au repos, charge 0/600/1200 ms, retour visible du bouton, relâchement court/long, scroll commencé sur la scène, cible tactile. | À vérifier |
| D6 indisponible | Prochaine plage affichée ; aucune fausse action active ; autres onglets et liste toujours accessibles. | À vérifier |
| Monde de l’autre joueur | État calme, invitation fermée puis ouverte ; aucun titre caché, effet de blur sans texte secret. | À vérifier |
| D4 avant révélation | Quatre dos distincts, numéros alignés, absence de titre caché dans le DOM ; lancer au clavier et au toucher. | À vérifier |
| Carte choisie | Six catégories, plus longs titres, grande métrique, contexte fermé/ouvert, source externe ; contraste réel au sommet de carte et dans les panneaux. | À vérifier |
| Retirage | Action disponible une fois ; D4 monté avant réponse ; carte suivante révélée après animation ; absence du D20 initiateur et conservation du D20 destinataire. | À vérifier |
| D20 initiateur | Jauge initiale, premier jet, dernier jet, succès, échec menant à l’invitation ; nombres et segments cohérents visuellement. | À vérifier |
| Invitation / réponse | Fermée/ouverte, envoi en attente, acceptation en attente, erreur, état déjà changé ailleurs ; aucune double action malgré le réseau lent. | À vérifier |
| D20 destinataire | Premier et second jet, succès et échec ; boutons restants compréhensibles sans texte de tutoriel ajouté. | À vérifier |
| Confirmation de l’initiateur | Le bon joueur peut confirmer ; l’autre voit l’attente ; charge ne devient pas un consentement ou un accord automatique. | À vérifier |
| À faire — vide | Hiérarchie, hauteur de vide, retour au jeu. | À vérifier |
| À faire — une tâche | Deux cases, une seule interactive par compte, coche/annulation, vague après acquittement seulement, échéance proche. | À vérifier |
| À faire — plusieurs tâches | Validation de la première et de la dernière, suppression après deux coches, message visible dans le viewport, scroll stable, annonce et focus utiles. | À vérifier |
| Expiration | Tâche juste avant/après 6 h ; case tardive rejetée ; pas de point fictif ; état vide accessible. | À vérifier |
| Tour terminé | Carte écartée / partagée / expirée ; résumé et action principale alignés ; accès au score sans élément superflu. | À vérifier |
| Nous — score et grade | 0, 4, 5, 8, 15, 30, 50 et score très grand ; seul grade courant, barre et texte lisibles, palette grade bleu distincte du score corail. | À vérifier |
| Nous — réglages | Son activé/désactivé au clavier ; notifications disponibles, accordées, refusées, navigateur incompatible et iOS non installé. | À vérifier |
| Règles — dialogue | Tab/Shift-Tab/Escape, bouton fermer, restitution du focus, fond inerte, hauteur réduite/paysage, défilement du dialogue. | À vérifier |
| PWA installée | Zone sûre, clavier affiché, ouverture depuis notification, reprise après fermeture, réseau absent, reprise sans écran privé périmé. | À vérifier sur appareil |

### Contrôles transversaux obligatoires

- Clavier : appui/relâchement Espace pour la charge, Entrée pour le clic natif immédiat, répétition automatique de la charge ignorée, Escape et perte de focus annulent la charge. Un bouton conserve sa sémantique native, le canvas a une alternative clavier.
- Toucher : pas de `preventDefault` général empêchant le défilement ; `pointercancel`/perte de capture ne lancent rien ; déplacement vertical pendant la charge annule sans consommer de tirage.
- Temps : charge plafonnée à 1 200 ms, animation du lancer plafonnée à 2 500 ms. La durée de réponse réseau est une attente distincte et doit être montrée comme telle. La puissance ne voyage jamais dans la requête métier et ne modifie ni face, ni PV, ni quota, ni point.
- Réduction des animations : préférence système avant chargement et changée en cours de charge/lancer ; pas de déformation ou de confettis imposés, résultat immédiatement compréhensible. Aucun framerate ou progrès de charge n’est annoncé en boucle aux lecteurs d’écran.
- Lecteur d’écran : titre du nouvel écran, résultat du dé, jauge numérique, case de chaque joueur et message d’erreur ; les mises à jour automatiques ne doivent pas reprendre le focus à une personne en train de lire.
- Source ouverte : une actualisation de fond ne devrait pas fermer le contexte ni déplacer le focus vers un autre contrôle. Le rendu initial remplace `main.innerHTML` ; la restauration du focus cible surtout `button,input` et les data-attributs, donc ce cas reste à vérifier.
- Scroll : distinguer une navigation déclenchée par la personne (nouvel écran) d’une actualisation de fond (position conservée). Vérifier notamment acceptation → À faire et une suppression de tâche en haut d’une liste.

## Points solides dans les sources

- Les identifiants et mots de passe utilisent les attributs d’autofill adaptés ; les champs sont de 16 px, ce qui évite de chercher une solution en désactivant le zoom.
- Les dialogues ont `role=dialog`, `aria-modal`, un titre associé, fermeture par Escape, boucle de Tab et fond `inert` ; il reste à vérifier le focus et le défilement réels.
- Les sources utilisent `details/summary` natifs et des liens explicites ; les cartes cachées ne contiennent pas leur titre réel.
- Les boutons de dés fournissent une alternative au canvas ; le résultat est annoncé, les jauges ont leurs valeurs ARIA, les cases restent natives.
- Les animations CSS possèdent une règle globale `prefers-reduced-motion`; les animations JS vérifient la préférence et le renderer peut terminer proprement son animation. Le grain est statique.
- Le transport rejette les projections d’un autre joueur, protège contre un état plus ancien, garde le même requestId lors d’une reprise et n’accepte pas de résultat ou de puissance fournis par l’interface.
- Le service worker ne met en cache que la coquille publique autorisée, ignore les requêtes privées/autorisées et les réponses `private/no-store`, et ne supprime que les caches de son propre chemin. Le manifest pointe vers cette application ; aucune permission de notification n’est demandée automatiquement.
- Le builder connecté incorpore uniquement l’endpoint et la clé publiable, refuse un paramétrage incomplet et conserve l’archive Xcode. Le vieux script sous `workflow/` n’est pas le builder de publication courant ; ne pas confondre ses textes historiques avec le rendu livré.

## Direction artistique : préférences à préserver, pas des défauts techniques

La matière suédine/rubber, le grain visible, les six pigments minéraux et le format étroit font partie de l’identité retenue. Les couleurs doivent rester sourdes, les contours et polices contenus, les mouvements organiques et utiles. Ne pas ajouter halos, décor autonome, nouvelles sections, badges multiples ou copie de tutoriel pour remplir les espaces.

Le grade bleu ardoise demandé sert à le distinguer du score corail. Il ne justifie pas une recoloration générale des actions ou des catégories. Les nombres essentiels, les actions disponibles et les réponses attendues doivent dominer ; les sources restent lisibles et repliables. L’audit ne demande aucun nouveau fonctionnement métier.

## Vérification effective avant publication

Le 2 novembre 2026, la version construite a été parcourue dans le navigateur intégré. Les scénarios de QA utilisent exclusivement des états fictifs validés par le moteur, isolés du serveur réel et marqués FICTIF. Aucun tirage, quota, point ou tâche du couple n’a été consommé pour l’audit.

| Largeur × hauteur | Couverture des états | Résultat |
|---|---|---|
| 390 × 844 | 49 états : accueil, connexion et erreurs, dés/quota, mondes privés, six catégories, relance, D20 des deux joueurs, invitations et confirmations, tâches, fins de tour, scores 0/15/50, cinq états de notification, règles, textes maximaux. | Pas de débordement horizontal ni texte tronqué dans les titres, paragraphes et contrôles mesurés. |
| 320 × 780 | 12 états critiques, dont titre de carte et statistique les plus longs, tâches multiples et dialogue. | Même contrôle sans débordement ; retour à la ligne conservé. |
| 768 × 1024 | 6 états : connexion, D6, carte au titre maximal, tâches multiples, Nous à 15 points, règles. | Cadre et densité cohérents ; grade unique. |
| 1280 × 900 | 6 états : accueil, D6, Attentions, statistique longue, Nous à 50 points, règles. | Format mobile centré conservé ; aucun étirement des composants. |

Soit **73 observations distinctes état/largeur**, avec captures et mesures DOM, puis revue visuelle de 47 captures en planches et contrôles complémentaires individuels. Aucun contrôle actif sous 24 px n’a été détecté par la sonde ; cela ne constitue pas une certification exhaustive des cibles tactiles. Les captures locales sont conservées hors des sources publiques dans le dossier `ui-da-audit` voisin du dépôt.

La revue visuelle confirme les six teintes distinctes, la lecture des cartes assombries, les proportions du cadre, la discrétion des icônes, le score corail et le grade bleu ardoise. Le titre maximal se répartit sur plusieurs lignes sans réduction forcée. La source longue s’ouvre et défile jusqu’au lien et aux actions. Le choix du cadre arrondi est conservé intentionnellement, malgré les anciennes règles du head qui évoquaient un mode plein écran.

### Interactions réellement essayées

- Appui de 1 400 ms sur Lancer : charge plafonnée à 1, un seul tirage, durée mesurée du renderer **2 508 ms** (cible de 2 500 ms, plus le pas d’animation). Les clés de la requête restent exclusivement `type` et `roundId`.
- Clic court : puissance 0,001 environ, un seul tirage, durée mesurée **1 668 ms** (cible 1 650 ms). La face reste fournie par la réponse du moteur.
- Glissement hors de la zone pendant l’appui : zéro tirage et zéro animation ; le clic suivant fonctionne immédiatement.
- Relance D4 depuis une carte : une autre carte apparaît après l’animation ; les boutons D20 et relance disparaissent, Proposer reste disponible.
- Validation de sa case lorsque l’autre est déjà cochée : tâche retirée, liste vide affichée, annonce et message **+1 point** visibles.
- Dialogue : focus initial sur Fermer ; Shift-Tab rejoint le dernier bouton ; Tab boucle ; Escape ferme et rend le focus au bouton d’aide.
- Source : ouverture native du contexte, paragraphes et lien lisibles après défilement. Réglage iOS non installé : explication d’ajout à l’écran d’accueil visible, sans demande automatique de permission.
- Rendu WebGL actif pour les dés des scénarios concernés ; D6 initial visuellement incliné, chiffre supérieur ivoire brillant sans halo supplémentaire.

### Contre-vérification automatisée

Les suites ciblées couvrent **234 contrôles UI, 102 transport, 790 backend et 1 003 relance**, en complément des suites D20, tâches, score, quotas, confidentialité, statistiques, notifications, renderer et build. Les essais du renderer couvrent les poses finales, les transitions, l’absence de saut pour un résultat répété, les annulations et la réduction des animations. Les grades aux différents seuils et l’absence de noms de grades futurs sont également couverts.

Le serveur Edge v3 a été déployé. Un appel hébergé à REROLL_CARD avec un identifiant de tour volontairement périmé renvoie le conflit attendu ; un résultat client forgé est rejeté. Aucun tour réel n’a été joué. Le contrôle ne modifie pas les mécanismes métier hors de la relance explicitement approuvée.

### Limites de validation

Les cinq défauts objectifs listés plus haut sont corrigés et contre-vérifiés par code, tests et/ou navigateur selon leur nature. Les annulations tactiles et la réduction des animations sont couvertes par tests ; **pas d’essai physique iPhone**, de mesure GPU sur appareil, de parcours VoiceOver réel ni de certification WCAG globale. L’installation PWA, la livraison réelle des notifications sur téléphone et le clavier iOS restent des essais sur appareil. Les contrastes du tableau sont nominaux avant grain, et non des relevés exhaustifs pixel par pixel. L’autofill, un nom constitué d’un mot exceptionnellement long et la conservation d’un contexte Source ouvert lors d’une mise à jour distante restent hors du parcours manuel réalisé.
