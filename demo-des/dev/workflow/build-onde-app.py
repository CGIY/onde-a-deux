from pathlib import Path

root = Path(__file__).resolve().parent
ui = (root / 'onde-app-ui.html').read_text()
parts = [ui]
for filename in ['onde-app-core.js', 'onde-app-dice.js', 'onde-app-evidence.js', 'onde-app-ui.js']:
    parts.extend(['<script>\n', (root / filename).read_text(), '\n</script>\n'])
fragment = ''.join(parts)
(root / 'onde-app-interactive.html').write_text(fragment)
document = '\n'.join([
    '<!doctype html>',
    '<html lang="fr">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#181d1c">',
    '<meta name="color-scheme" content="dark">',
    '<title>ONDE — Le hasard, à deux</title>',
    '<meta name="description" content="Prototype interactif privé : D6 catégorie, D4 carte et défi D20. Deux profils simulés, sans connexion à un serveur.">',
    '<style>html{background:#101613;color-scheme:dark}body{margin:0;padding:16px 0 24px;min-width:300px;background:radial-gradient(ellipse at 50% 30%,#283027 0,#141b17 65%);min-height:100vh}.cursor-interaction{cursor:pointer}@media(max-width:480px){body{padding:0;background:#181d1c}#onde-app-v1{padding:0}#onde-app-v1 .oa-shell{border-radius:0;border-left:0;border-right:0;max-width:none;box-shadow:none}}</style>',
    '</head><body>',
    fragment,
    '</body></html>'
])
(root / 'onde-application.html').write_text(document)
(root / 'onde-app' / 'dist' / 'index.html').write_text(document)
(root / 'onde-app' / 'dist' / 'qa.html').write_text(document.replace('onde-couple-prototype-v1', 'onde-couple-prototype-qa'))
print(f'ONDE assembled: {len(document.encode())} bytes; no external runtime dependency.')
