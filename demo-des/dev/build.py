"""Build Dés·ir from its editable sources.

Default: isolated local demo preview. --connected: authenticated web preview.
--release: publishable authenticated web files; the archived Xcode build is kept.
"""
from pathlib import Path
import argparse
import shutil
import json
import re
from urllib.parse import urlparse

root = Path(__file__).resolve().parent
args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--release', action='store_true')
args.add_argument('--connected', action='store_true', help='Use the web connection in the local preview.')
options = args.parse_args()
connected = options.release or options.connected
source = root / 'src'
demo = root.parent


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


configuration = public_config() if connected else ''
evidence = json.loads((root / 'data/card-evidence.json').read_text())['activeEvidence']
rows_source = (source / 'onde-app-core.js').read_text().split('const catalogRows = [', 1)[1].split('];', 1)[0]
card_ids = set(re.findall(r"id:'([^']+)'", rows_source))
if set(fact['cardId'] for fact in evidence) != card_ids or len(evidence) != len(card_ids):
    raise SystemExit('Evidence must cover every active card exactly once.')
for field in ['statKey', 'detail']:
    if len({fact[field] for fact in evidence}) != len(evidence):
        raise SystemExit('Duplicate evidence result: ' + field)
for fact in evidence:
    if any(not fact.get(field) for field in ['metric', 'headline', 'detail', 'scope', 'limitations', 'year', 'sourceTitle', 'url']):
        raise SystemExit('Incomplete evidence: ' + fact['cardId'])
    if not fact['url'].startswith('https://'):
        raise SystemExit('Invalid source URL: ' + fact['cardId'])
html = (source / 'onde-app-ui.html').read_text()
html += '\n<script>window.OndeEvidenceData=' + json.dumps(evidence, ensure_ascii=False).replace('<', '\\u003c') + ';</script>\n'
if connected:
    # Inline this public setting: a failed config request must never select local demo mode.
    html += '\n<script>' + configuration + '</script>\n'
for filename in ['onde-app-core.js', 'onde-app-dice.js', 'onde-app-evidence.js', 'onde-app-remote.js', 'onde-app-ui.js']:
    html += '\n<script>\n' + (source / filename).read_text() + '\n</script>\n'
html = html.replace('onde-couple-prototype-v1', 'onde-public-demo-v010')
html = '''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#181d1c"><meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow"><meta name="onde-version" content="0.3.0">
<meta name="application-name" content="Dés·ir"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Dés·ir">
<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="./icons/desir-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="./icons/desir-192.png">
<title>Dés·ir — À deux</title>
<style>html{background:#101613;color-scheme:dark}body{margin:0;padding:16px 0 24px;min-width:300px;background:radial-gradient(ellipse at 50% 30%,#283027 0,#141b17 65%);min-height:100vh}.cursor-interaction{cursor:pointer}@media(max-width:480px){body{padding:0;background:#181d1c}#onde-app-v1{padding:0}#onde-app-v1 .oa-shell{border-radius:0;border-left:0;border-right:0;max-width:none;box-shadow:none}}</style>
</head><body>''' + html + '</body></html>\n'
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/index.html').write_text(html)
for filename in ['manifest.webmanifest', 'sw.js']:
    shutil.copyfile(demo / filename, root / 'dist' / filename)
shutil.copytree(demo / 'icons', root / 'dist/icons', dirs_exist_ok=True)
# Both deployments execute exactly the same game rules.
shutil.copyfile(source / 'onde-app-core.js', demo / 'server/functions/desir-game/core.js')
print('Built ' + ('connected' if connected else 'local demo') + ' preview:', root / 'dist/index.html')
if options.release:
    (demo / 'index.html').write_text(html)
    for filename in ['card-evidence.json', 'stck-adaptations.json']:
        shutil.copyfile(root / 'data' / filename, demo / filename)
    print('Updated connected web release; archived Xcode resources and ZIP are unchanged:', demo)
