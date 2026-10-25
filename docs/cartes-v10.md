# Cartes v10

Édition 01 : 90 cartes (80 d’origine, cinq sortilèges et cinq légendaires).
Halloween : 10 variantes ; total de l’album : 100. Les définitions Foodies et To do
servent au choix des légendaires et ne constituent pas deux cartes supplémentaires.
Les textes des challenges existants sont conservés.

Les cinq sortilèges possèdent un visuel propre. REDUCTO/AUGMENTO modifient l’effet
avec un bandeau ; PRESTO/ADAGIO modifient le temps restant. Une seule modification
d’effet et une seule modification de durée par rituel. DESTRUCTO cible uniquement
un exemplaire disponible dans la main adverse déjà découvert par le lanceur.
La consommation est atomique, les découvertes et les exemplaires détruits restent
conservés, et l’historique distingue les sorts lancés et reçus.

Les légendaires apparaissent à 0,5 % par tirage de challenge : communes 69,5 %,
full art 20 %, foil 8 %, full art + foil 2 %. Une par catégorie ; le défi est choisi
parmi les effets full art + foil de cette catégorie lors de l’activation. Le titre
alterne visuellement avant le choix, puis reste fixe sur la table. Le catalogue
conserve l’identité de la légendaire. Aura, particules, reflets et inclinaison tactile ;
animations réduites si le réglage système le demande.

Trois cartes par booster : Énergie, challenge garanti, puis challenge/sortilège
ou Joker. Le cadeau unique `spells-legends-test-2026-10-25` garantit Énergie + challenge
+ sortilège, sans légendaire. Il expire sous 48 h et ne décale pas la sortie quotidienne.
L’opération admin est idempotente et compare toutes les sauvegardes avant/après.

Validation : sept suites Node, tests SQL des cinq sorts et des choix légendaires
avec annulation de toutes les données fictives, démo mobile isolée pour les actions
et le choix stable d’un effet. Aucun test de gameplay n’utilise les collections réelles.
La publication et l’attribution du cadeau font l’objet d’une vérification séparée.
