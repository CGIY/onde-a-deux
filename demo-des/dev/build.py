"""Build D6 à deux from its editable sources.

Default: isolated local demo preview. --connected: authenticated web preview.
--release: publishable authenticated web files; the archived Xcode build is kept.
"""
from pathlib import Path
import argparse
from base64 import b64encode
import shutil
import json
import re
from urllib.parse import urlparse
from badges import badge_source, badge_bundle, write_badge_assets

root = Path(__file__).resolve().parent
args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--release', action='store_true')
args.add_argument('--connected', action='store_true', help='Use the web connection in the local preview.')
options = args.parse_args()
connected = options.release or options.connected
source = root / 'src'
demo = root.parent
release_match = re.search(r"^const RELEASE_VERSION = '(\d+\.\d+\.\d+)';$", (demo / 'sw.js').read_text(), re.M)
if not release_match:
    raise SystemExit('Missing service worker release version.')
release_version = release_match[1]
edge_color = json.loads((demo / 'manifest.webmanifest').read_text())['background_color']


def public_config():
    """Read only the two public settings; refuse an incomplete connected build."""
    path = demo / 'config.js'
    if not path.is_file():
        raise SystemExit('Connected build requires demo-des/config.js; no demo fallback was generated.')
    match = re.fullmatch(r'\s*window\.DesirConfig\s*=\s*Object\.freeze\((\{.*\})\)\s*;?\s*', path.read_text(), re.S)
    try:
        config = json.loads(match.group(1)) if match else None
    except json.JSONDecodeError:
        config = None
    if not isinstance(config, dict) or set(config) != {'endpoint', 'publishableKey'}:
        raise SystemExit('config.js must contain only endpoint and publishableKey as JSON.')
    endpoint = urlparse(config['endpoint']) if isinstance(config['endpoint'], str) else None
    if not endpoint or endpoint.scheme != 'https' or not endpoint.hostname or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise SystemExit('Connected build requires a public HTTPS endpoint.')
    if not isinstance(config['publishableKey'], str) or not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]+', config['publishableKey']):
        raise SystemExit('Connected build requires a publishable API key, never a server key.')
    return 'window.DesirConfig=Object.freeze(' + json.dumps(config, ensure_ascii=False).replace('<', '\\u003c') + ');'


def info_questions():
    questions = json.loads((root / 'data/info-questions.json').read_text(encoding='utf-8'))
    categories = {'complicite', 'attention', 'projets', 'intimite'}
    if not isinstance(questions, dict) or questions.keys() != categories or any(
        not isinstance(items, list) or len(items) != 25 for items in questions.values()
    ):
        raise SystemExit('The Info deck requires 25 questions per theme.')
    flat = [question for items in questions.values() for question in items]
    if any(not isinstance(question, str) or len(question) > 160 or not question.endswith('?') for question in flat):
        raise SystemExit('Info prompts must be short questions.')
    if len({re.sub(r'\W+', '', question.casefold()) for question in flat}) != len(flat):
        raise SystemExit('Info questions must be unique.')
    return questions


configuration = public_config() if connected else ''
notes = json.loads((root / 'data/card-notes.json').read_text())
variant_glyphs = json.loads((root / 'data/variant-glyphs.json').read_text())
core = (source / 'onde-app-core.js').read_text()
catalog = core.split('const catalogRows = [', 1)[1].split('];', 1)[0]
card_ids = set(re.findall(r"id:'([^']+)'", catalog))
if (not isinstance(notes, dict) or set(notes) != card_ids or
        any(not isinstance(value, str) or not value.strip() or len(value) > 180 or
            re.search(r'[%\d]|https?://', value) for value in notes.values()) or
        len({value.casefold().strip() for value in notes.values()}) != len(notes)):
    raise SystemExit('Each card requires its own short, non-numerical sentence.')
html = (source / 'onde-app-ui.html').read_text()
# Personal portraits belong only to this checkout's isolated demo.
if not connected:
    profiles = [('a', 1, 'Clément'), ('b', 2, 'Agathe')]
    avatar_dir = root / 'local-avatars'
    if all((avatar_dir / f'{player}.jpg').is_file() for player, _, _ in profiles):
        for player, number, name in profiles:
            portrait = b64encode((avatar_dir / f'{player}.jpg').read_bytes()).decode('ascii')
            avatar = (f'<span class="oa-player-avatar"><img src="data:image/jpeg;base64,{portrait}" '
                      f'alt="{name}" width="80" height="80"></span>')
            html = html.replace(f'<!-- profile-{player} -->Joueur {number}', avatar, 1)
html += '\n<script>window.DesirInfoQuestions=' + json.dumps(info_questions(), ensure_ascii=False).replace('<', '\\u003c') + ';</script>\n'
html += '\n<style>\n' + (source / 'onde-app-info.css').read_text() + '</style>\n'
html += '\n<script>window.DesirCardNotes=Object.freeze(' + json.dumps(notes, ensure_ascii=False).replace('<', '\\u003c') + ');</script>\n'
html += '\n<script>window.DesirVariantGlyphs=Object.freeze(' + json.dumps(variant_glyphs).replace('<', '\\u003c') + ');</script>\n'
if connected:
    # Inline this public setting: a failed config request must never select local demo mode.
    html += '\n<script>' + configuration + '</script>\n'
hardcore = json.loads((root / 'data/hardcore-cards.json').read_text())
if (not isinstance(hardcore, dict) or set(hardcore) != {f'hardcore-{i:02d}' for i in range(1, 21)} or
        any(not isinstance(v, str) or not v.strip() or len(v) > 160 for v in hardcore.values())):
    raise SystemExit('Hardcore requires twenty short card titles.')
try:
    match = re.search(r'\bconst hardcoreCardTitles = (\{.*?\});', core, re.S)
    canonical_hardcore = json.loads(match.group(1)) if match else None
except ValueError:
    canonical_hardcore = None
if canonical_hardcore != hardcore:
    raise SystemExit('The unified Hardcore catalogue must exactly match its existing card data.')
artwork = badge_source(source)
badges = badge_bundle(source, artwork)
for filename in ['onde-app-core.js', 'onde-app-dice.js', 'onde-app-remote.js', 'onde-badge-art.js', 'onde-app-ui.js', 'onde-app-sky.js']:
    html += '\n<script>\n' + (artwork if filename == 'onde-badge-art.js' else (source / filename).read_text()) + '\n</script>\n'
html = html.replace('onde-couple-prototype-v1', 'onde-public-demo-v010')
html = '''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="__D6_EDGE_COLOR__"><meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow"><meta name="onde-version" content="__D6_RELEASE__">
<meta name="application-name" content="D6 à deux"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="D6 à deux">
<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="./icons/desir-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="./icons/desir-192.png">
<title>D6 à deux</title>
<style>html{--d6-edge-color:__D6_EDGE_COLOR__;background:#05060d;color-scheme:dark}body{margin:0;padding:16px 0 24px;min-width:300px;background:radial-gradient(ellipse at 50% 18%,#151d31,#05060d 74%);min-height:100vh}.cursor-interaction{cursor:pointer}</style>
</head><body>'''.replace('__D6_RELEASE__', release_version).replace('__D6_EDGE_COLOR__', edge_color) + html + '</body></html>\n'
(root / 'dist').mkdir(exist_ok=True)
(source / 'onde-badge-art.js').write_text(artwork)
# Retired outputs are removed on successful builds, including from an older preview.
retired_statistics = ['card-evidence.json', 'statistiques.json', 'statistiques.html']
for target in [root / 'dist'] + ([demo] if options.release else []):
    for filename in retired_statistics:
        (target / filename).unlink(missing_ok=True)
(root / 'dist/index.html').write_text(html)
write_badge_assets(root / 'dist', badges)
for filename in ['manifest.webmanifest', 'sw.js']:
    shutil.copyfile(demo / filename, root / 'dist' / filename)
shutil.copytree(demo / 'icons', root / 'dist/icons', dirs_exist_ok=True)
# Both deployments execute exactly the same game rules.
shutil.copyfile(source / 'onde-app-core.js', demo / 'server/functions/desir-game/core.js')
print('Built ' + ('connected' if connected else 'local demo') + ' preview:', root / 'dist/index.html')
if options.release:
    (demo / 'index.html').write_text(html)
    write_badge_assets(demo, badges)
    for filename in ['stck-adaptations.json']:
        shutil.copyfile(root / 'data' / filename, demo / filename)
    print('Updated connected web release; archived Xcode resources and ZIP are unchanged:', demo)
