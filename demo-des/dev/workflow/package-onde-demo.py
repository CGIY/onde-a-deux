from pathlib import Path
import base64
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'onde-github-publish'
DEMO = PUBLIC / 'demo-des'
XCODE = DEMO / 'xcode'
DEMO.mkdir(parents=True, exist_ok=True)
shutil.copytree(ROOT / 'onde-xcode-staging', XCODE, dirs_exist_ok=True)

html = (ROOT / 'onde-application.html').read_text()
for old, new in {
    'Joueur 1': 'Joueur 1', 'Joueur 2': 'Joueur 2',
    'VOTRE DUO': 'VOTRE DUO',
    'Prototype interactif privé': 'Démo interactive ONDE 0.3.0',
    'onde-couple-prototype-v1': 'onde-public-demo-v010',
}.items():
    html = html.replace(old, new)
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">\n<meta name="onde-version" content="0.3.0">')
for private_word in []:
    assert private_word not in html, private_word
(DEMO / 'index.html').write_text(html)
(XCODE / 'OndeDemo' / 'Web').mkdir(exist_ok=True)
(XCODE / 'OndeDemo' / 'Web' / 'index.html').write_text(html)

(DEMO / 'README.md').write_text('''# ONDE — démo jouable 0.3.0

[Jouer dans le navigateur](https://cgiy.github.io/onde-a-deux/demo-des/) · [Télécharger le projet Xcode](https://cgiy.github.io/onde-a-deux/demo-des/ONDE-Xcode.zip)

## Essayer

Lancer le **D6** pour choisir une catégorie, puis le **D4** pour tirer une carte. La personne qui tire peut proposer la carte directement ou tenter de l’écarter avec le **D20** : elle dispose de deux jets au maximum pour atteindre les PV de la carte avec leur total.

Si ce total reste inférieur aux PV après le second jet, la carte est **automatiquement proposée à l’autre profil**. Changer de profil en haut de l’écran pour accepter, adapter, proposer un autre moment ou tenter à son tour un défi avec deux nouveaux jets de D20. Si l’autre accepte une carte proposée automatiquement, la personne qui l’a tirée doit encore **confirmer son accord** avant que la carte soit acceptée à deux. Une proposition envoyée volontairement suit le parcours d’accord habituel.

Il reste possible d’arrêter ou de passer la carte à tout moment, sans point perdu. Le dé décide de l’issue du défi ; un lancer manqué ne donne jamais automatiquement l’accord d’une personne.

Les 57 cartes de démonstration, les favoris, les variantes et le score commun sont utilisables localement. Les dés ont une animation WebGL et un rendu de secours lorsque WebGL est indisponible.

## Couleurs, mouvement et repères sourcés

Les catégories ont des couleurs minérales plus présentes. Les changements d’étape, les cartes et les dés sont animés ; les trois dés portent des chiffres. Les cartes dépliées peuvent défiler pour lire la consigne, la variante et les informations associées. Les animations suivent automatiquement la préférence d’accessibilité du système.

Les repères chiffrés des cartes indiquent leur source et le contexte de l’étude : population, mesure et limites utiles. Ils apportent un éclairage sur le sujet, sans promettre qu’un défi produira le même résultat pour votre duo. Le dossier de recherche est fourni dans `card-evidence.json` lorsqu’il est inclus dans cette version.

Les deux profils sont **simulés sur un seul appareil**. Les notifications sont des aperçus. Cette démo n’a ni synchronisation entre téléphones ni service distant de collecte. Les données de test restent dans le stockage local de la page ou de l’app.

## Score commun et catalogue STCK

Dans **Nous**, une carte marquée **partagée** ajoute **1 point au duo**, avec une répartition par catégorie. Accepter, passer ou écarter une carte au D20 n’ajoute aucun point. Le total cumulé reste conservé indépendamment de la limite technique de l’ancien historique. Les anciens tours partagés encore disponibles sont repris lors de la mise à jour ; les tours déjà évincés ne peuvent pas être reconstitués.

La section chronologique « Les derniers moments » et le réglage manuel « Mouvements réduits » ont été retirés. Les animations respectent automatiquement la préférence d’accessibilité du système.

Le catalogue reprend **21 nouvelles cartes** des collections Amour, Massage, Soin, Fast Food, Pâtissier et Canapé de [STCK](https://github.com/CGIY/stck/blob/98119ed48b8af6e868582eeeed0912214e007e9c/src/catalog.json). Trois propositions déjà présentes (massage de la tête, câlin et petit mot caché) sont reliées à leur équivalent sans créer de doublon. Les titres proviennent de STCK ; les consignes, variantes, durées estimées et PV provisoires sont adaptés pour ONDE. La traçabilité complète est dans `stck-adaptations.json`.

## Faire un retour

Ouvrir **Avis** dans l’en-tête ou **Nous → Donner mon avis**. Écrire une observation puis copier le rapport et le coller dans la conversation. Le rapport indique la version et l’état utile du jeu ; il n’est jamais envoyé automatiquement.

## Dans Xcode

Décompresser `ONDE-Xcode.zip`, ouvrir `OndeDemo.xcodeproj`, choisir le schéma **OndeDemo**, un simulateur iPhone avec iOS 17 ou plus, puis **⌘R**. Le [guide du projet](xcode/README.md) explique aussi le lancement sur iPhone physique.

Le fichier à modifier pour tester rapidement est **`xcode/OndeDemo/Web/index.html`**. Il contient tout le jeu ; une relance de l’app recopie la ressource. Le wrapper SwiftUI utilise WKWebView et les zones de sécurité natives. Les liens de sources s’ouvrent dans le navigateur système.

Les sources iOS ne nécessitent ni générateur de projet ni installation de paquets. La compilation et la signature d’un appareil physique demandent Xcode sur macOS. Le workflow GitHub `ONDE demo — Xcode` vérifie la compilation pour simulateur ; voir son résultat pour le commit concerné.

## Mettre à jour les deux versions

Après une modification dans `xcode/OndeDemo/Web/index.html`, lancer `python3 sync-demo.py` depuis ce dossier pour recopier le jeu vers `index.html` et reconstruire le ZIP. Aucune commande n’est nécessaire pour exécuter le projet dans Xcode.

La version et le rapport de retour portent le numéro **0.3.0**, et le projet iOS utilise le **build 3**. Les profils sont génériques ; cette page et son code sont publics. La mise à jour conserve la même clé de stockage local pour reprendre la partie et le score existants.
''')

shutil.copyfile(ROOT / 'onde-stck-adaptations.json', DEMO / 'stck-adaptations.json')
evidence = ROOT / 'onde-evidence-research.json'
if evidence.is_file():
    shutil.copyfile(evidence, DEMO / 'card-evidence.json')

(DEMO / 'sync-demo.py').write_text('''from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent
source = root / 'xcode'
shutil.copyfile(source / 'OndeDemo' / 'Web' / 'index.html', root / 'index.html')
with zipfile.ZipFile(root / 'ONDE-Xcode.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob('*')):
        if path.is_file() and not any(part in {'xcuserdata', 'DerivedData', '.DS_Store', '.git'} for part in path.parts):
            archive.write(path, Path('ONDE-Xcode') / path.relative_to(source))
print('La page jouable et ONDE-Xcode.zip ont été mis à jour.')
''')

workflow = PUBLIC / '.github' / 'workflows' / 'onde-demo-xcode.yml'
workflow.parent.mkdir(parents=True, exist_ok=True)
workflow.write_text('''name: ONDE demo — Xcode

on:
  push:
    paths:
      - 'demo-des/xcode/**'
      - '.github/workflows/onde-demo-xcode.yml'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  simulator-build:
    runs-on: macos-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - name: Show Xcode version
        run: xcodebuild -version
      - name: Build iOS simulator app
        run: >-
          xcodebuild
          -project demo-des/xcode/OndeDemo.xcodeproj
          -scheme OndeDemo
          -configuration Debug
          -sdk iphonesimulator
          -destination 'generic/platform=iOS Simulator'
          -derivedDataPath "$RUNNER_TEMP/onde-demo-build"
          CODE_SIGNING_ALLOWED=NO
          build
''')

with zipfile.ZipFile(DEMO / 'ONDE-Xcode.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(XCODE.rglob('*')):
        if path.is_file() and not any(part in {'xcuserdata', 'DerivedData', '.DS_Store', '.git'} for part in path.parts):
            archive.write(path, Path('ONDE-Xcode') / path.relative_to(XCODE))

manifest = []
for path in sorted(PUBLIC.rglob('*')):
    if not path.is_file():
        continue
    data = path.read_bytes()
    try:
        content, encoding = data.decode('utf-8'), 'utf-8'
    except UnicodeDecodeError:
        content, encoding = base64.b64encode(data).decode('ascii'), 'base64'
    manifest.append({'path': path.relative_to(PUBLIC).as_posix(), 'content': content, 'encoding': encoding, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(ROOT / 'onde-publish-manifest.json').write_text(json.dumps(manifest))
print(json.dumps({'files': len(manifest), 'html_bytes': len(html.encode()), 'zip_bytes': (DEMO / 'ONDE-Xcode.zip').stat().st_size, 'paths': [item['path'] for item in manifest]}, indent=2))
