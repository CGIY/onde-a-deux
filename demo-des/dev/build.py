"""Build the editable ONDE sources. Default: local WIP preview only.
Run with --release only after UI verification to replace demo + Xcode bundle.
"""
from pathlib import Path
import argparse
import shutil
import zipfile
import json
import re

root = Path(__file__).resolve().parent
args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--release', action='store_true')
release = args.parse_args().release
source = root / 'src'
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
for filename in ['onde-app-core.js', 'onde-app-dice.js', 'onde-app-evidence.js', 'onde-app-ui.js']:
    html += '\n<script>\n' + (source / filename).read_text() + '\n</script>\n'
html = html.replace('onde-couple-prototype-v1', 'onde-public-demo-v010')
html = '''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#181d1c"><meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow"><meta name="onde-version" content="0.3.0">
<title>ONDE — Le hasard, à deux</title>
<style>html{background:#101613;color-scheme:dark}body{margin:0;padding:16px 0 24px;min-width:300px;background:radial-gradient(ellipse at 50% 30%,#283027 0,#141b17 65%);min-height:100vh}.cursor-interaction{cursor:pointer}@media(max-width:480px){body{padding:0;background:#181d1c}#onde-app-v1{padding:0}#onde-app-v1 .oa-shell{border-radius:0;border-left:0;border-right:0;max-width:none;box-shadow:none}}</style>
</head><body>''' + html + '</body></html>\n'
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/index.html').write_text(html)
print('Built local WIP preview:', root / 'dist/index.html')
if release:
    demo = root.parent
    xcode = demo / 'xcode'
    if not (xcode / 'OndeDemo.xcodeproj').is_dir():
        raise SystemExit('Run from the repository folder demo-des/dev; Xcode project not found.')
    (demo / 'index.html').write_text(html)
    (xcode / 'OndeDemo/Web/index.html').write_text(html)
    shutil.copyfile(root / 'future-release/project.pbxproj', xcode / 'OndeDemo.xcodeproj/project.pbxproj')
    shutil.copyfile(root / 'future-release/xcode-README.md', xcode / 'README.md')
    shutil.copyfile(root / 'future-release/demo-README.md', demo / 'README.md')
    for filename in ['card-evidence.json', 'stck-adaptations.json']:
        shutil.copyfile(root / 'data' / filename, demo / filename)
    with zipfile.ZipFile(demo / 'ONDE-Xcode.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(xcode.rglob('*')):
            if path.is_file() and not any(p in {'.git', 'xcuserdata', 'DerivedData', '.DS_Store'} for p in path.parts):
                archive.write(path, Path('ONDE-Xcode') / path.relative_to(xcode))
    print('Updated demo, Xcode resources and ZIP in:', demo)
