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
from badges import badge_source, badge_bundle, write_badge_assets

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


def roleplay_content(core):
    """Require one fictional repère for every final result of the active catalogue."""
    try:
        match = re.search(r'\bconst newCards = (\[.*?\n  \]);', core, re.S)
        catalogue = json.loads(match.group(1)) if match else None
        roleplay = json.loads((root / 'data/card-roleplay.json').read_text())
    except (OSError, ValueError):
        raise SystemExit('Roleplay requires its complete local data and active catalogue.')
    if (not isinstance(catalogue, list) or not catalogue or
            any(not isinstance(card, dict) or not isinstance(card.get('id'), str) or
                not isinstance(card.get('variants'), list) or not card['variants']
                for card in catalogue) or
            len({card['id'] for card in catalogue}) != len(catalogue)):
        raise SystemExit('The active final-card catalogue could not be validated.')
    expected = {card['id'] + ':v' + str(index + 1)
                for card in catalogue for index in range(len(card['variants']))}
    if (not isinstance(roleplay, dict) or set(roleplay) != {'mode', 'universe', 'cards'} or
            roleplay['mode'] != 'roleplay' or roleplay['universe'] != 'Dés·ir' or
            not isinstance(roleplay['cards'], dict) or set(roleplay['cards']) != expected):
        raise SystemExit('Roleplay must identify its fictional universe and cover every final card exactly.')
    texts = set()
    for row in roleplay['cards'].values():
        if (not isinstance(row, dict) or set(row) != {'metric', 'text'} or
                not isinstance(row['metric'], str) or
                not re.fullmatch(r'\+?\d{1,3}(?:,\d{1,2})? %', row['metric']) or
                not 0 < float(row['metric'].replace('+', '').replace(' %', '').replace(',', '.')) <= 100 or
                not isinstance(row['text'], str) or not row['text'].strip() or len(row['text']) > 180 or
                re.search(r'https?://|www\.|sb_(?:secret|publishable)_|\bBearer\s+|\beyJ[\w-]+\.[\w-]+\.', row['text'])):
            raise SystemExit('Each final roleplay card requires a percentage and short text, without source or credentials.')
        normalized = row['text'].casefold().strip()
        if normalized in texts:
            raise SystemExit('Every final roleplay card requires its own unique text.')
        texts.add(normalized)
    return roleplay


def highlight_rough(body):
    spitting = re.search(r'<div class="rough-extra"><div>.*?</div><p>.*?</p></div>', body, re.S)
    insults = re.search(r'<div><span>Insultes</span>(<b>.*?</b>)</div>', body, re.S)
    if not spitting or not insults:
        raise SystemExit('Missing the highlighted rough-play statistics.')
    body = body.replace(spitting[0], '', 1).replace(insults[0], '', 1)
    featured = spitting[0].replace(
        'Rapports déclarés consentis; accord sur le geste non isolé.',
        'Accord mesuré à l’échelle du rapport.'
    ).replace('≈ 1/4 des répondants · déjà pratiqué', 'Déjà pratiqué')
    return (
        '<div class="rough-highlights">' + featured +
        '<div class="rough-insults"><div><span>Insultes</span>' + insults[1] +
        '</div><p>Expériences consenties</p></div></div>' + body
    )


def libido_modules():
    """Adapt the standalone carnet's data cards to the app."""
    reference = (demo.parent / 'p/index.html').read_text(encoding='utf-8')
    titles = {
        'places': ('Lieux et expériences', 'Au-delà de la chambre.'),
        'benchmarks': ('Fréquence déclarée', 'Les rythmes du couple.'),
        'oral-manual': ('Fréquence déclarée', 'Les pratiques hors pénétration.'),
        'destinations': ('Enquête et préférences', 'Où va le sperme ?'),
        'rough': ('Expériences déclarées', 'Roleplay et jeux rudes.'),
        'women': ('Fantasmes déclarés', 'Et du côté des femmes ?'),
        'personal': ('Préférences personnelles', 'Accents personnels.'),
    }
    cards = {}
    for classes, body in re.findall(r'<section class="block ([^"]+)">(.*?)</section>', reference, re.S):
        keys = classes.split()
        key = 'benchmarks' if 'benchmarks' in keys else keys[0]
        if key not in titles:
            continue
        if key in cards:
            raise SystemExit(f'Duplicate libido card: {key}.')
        label, title = titles[key]
        body, count = re.subn(r'<p class="section-no">[^<]+</p>', '', body, count=1)
        if count != 1:
            raise SystemExit(f'Missing libido card heading: {key}.')
        if key == 'personal':
            body = re.sub(r'<h2>[^<]+</h2>|<p class="personal-sub">[^<]+</p>|<div class="pref-track"[^>]*>.*?</div>', '', body)
        if key == 'places':
            def place_band(match):
                value = int(match[2])
                band = 'high' if value >= 65 else 'mid' if value >= 50 else 'low' if value >= 25 else 'rare'
                return f'<div class="place-row" data-frequency="{band}">{match[1]}'

            body = re.sub(r'<div class="place-row">(.*?style="--width:(\d+)%")', place_band, body, flags=re.S)
            body = body.replace('<div><span>Lieux de culte / religieux</span>',
                                '<div class="place-fantasy-featured"><span>Lieux de culte / religieux</span>')
            body = body.replace('Couples cohabitants · France 2025 · expériences vécues', 'Expériences de couples cohabitants en France')
            body = body.replace('Grande-Bretagne · YouGov 2018', 'Grande-Bretagne').replace('<small>Rapport France 2025</small>', '')
        if key == 'rough':
            body = highlight_rough(body)
            body = body.replace('<p class="base">Repère international · enquête universitaire · 2021</p>', '')
            body = body.replace('Autre enquête · expériences consenties', 'Autres expériences consenties')
            body = re.sub(r'<small>≈ [^<]+</small>', '', body)
        if key == 'benchmarks':
            body = body.replace('Sur les 7 jours étudiés · France · Ipsos 2015', 'Sur sept jours, en France')
            body = body.replace('<small>Repère international · sondage commercial</small>', '')
        if key == 'women':
            body = body.split('<div class="women-porn">', 1)[0]
            body = body.replace('<p class="women-kicker">Fantasmes déclarés</p>', '')
            body = body.replace('class="women-source">799 répondantes · Québec · 2014/2015', 'class="base">799 répondantes au Québec')
        if key == 'oral-manual':
            body = re.sub(r'<p class="activity-frequency">.*?</p>',
                          '<p class="activity-frequency">Au moins une des pratiques étudiées chaque semaine.</p>',
                          body, count=1)
            body = body.replace('Pratiques à deux · étude 2023', '431 hommes de 50 ans et plus, en Tchéquie')
        if key == 'destinations':
            split = re.search(r'<div class="setting-labels">.*?</div>', body, re.S)
            proportions = re.findall(r'data-count="(\d+)"', split[0]) if split else []
            if len(proportions) != 2 or sum(map(int, proportions)) != 100:
                raise SystemExit('The personal setting split must add up to 100%.')
            inside, outside = proportions
            body = body.replace('<div class="setting-bars"', f'<div class="setting-bars" style="--inside:{inside}fr;--outside:{outside}fr"', 1)
            body = body.replace('Expériences déclarées · France 2021', 'Expériences déclarées au cours de la vie, en France')
            body = body.replace('Sélection hors vagin et tissus</strong>', 'Sélection hors vagin et tissus</strong> · réponses multiples')
            body = re.sub(r'<div class="dest-choice">.*?</div>', '', body, flags=re.S)
            body = body.replace('Mon cadre idéal, préférence personnelle', 'Préférence personnelle de lieu')
        body = re.sub(r'<p class="(?:context-note|dest-ideal-caption|rough-fraction|rough-enjoyment|rough-unmeasured|anal-foot)">.*?</p>',
                      '', body, flags=re.S)
        body = re.sub(r'\s*<a\b[^>]*href="#source-\d+"[^>]*>[^<]*</a>', '', body)
        body = body.replace('class="sr-only"', 'class="oa-sr"').replace('data-count=', 'data-info-count=')
        cards[key] = (
            f'<section class="oa-info-card oa-libido {key}" id="oa-libido-card-{key}" '
            f'aria-labelledby="oa-libido-title-{key}">'
            f'<p class="oa-info-kicker">{label}</p><h2 id="oa-libido-title-{key}">{title}</h2>{body}</section>'
        )
    if cards.keys() != titles.keys():
        raise SystemExit('Missing libido cards in p/index.html.')

    return '\n'.join(f'<template id="oa-libido-{key}">{markup}</template>'
                     for key, markup in cards.items()) + '\n'


configuration = public_config() if connected else ''
notes = json.loads((root / 'data/card-notes.json').read_text())
core = (source / 'onde-app-core.js').read_text()
catalog = core.split('const catalogRows = [', 1)[1].split('];', 1)[0]
card_ids = set(re.findall(r"id:'([^']+)'", catalog))
if (not isinstance(notes, dict) or set(notes) != card_ids or
        any(not isinstance(value, str) or not value.strip() or len(value) > 180 or
            re.search(r'[%\d]|https?://', value) for value in notes.values()) or
        len({value.casefold().strip() for value in notes.values()}) != len(notes)):
    raise SystemExit('Each card requires its own short, non-numerical sentence.')
roleplay = roleplay_content(core)
html = (source / 'onde-app-ui.html').read_text()
html += libido_modules()
html += '\n<style>\n' + (source / 'onde-app-info.css').read_text() + '</style>\n'
html += '\n<script>window.DesirCardNotes=Object.freeze(' + json.dumps(notes, ensure_ascii=False).replace('<', '\\u003c') + ');</script>\n'
html += '\n<script>window.DesirRoleplay=Object.freeze(' + json.dumps(roleplay, ensure_ascii=False).replace('<', '\\u003c') + ');</script>\n'
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
for filename in ['onde-app-core.js', 'onde-app-dice.js', 'onde-app-remote.js', 'onde-badge-art.js', 'onde-app-ui.js']:
    html += '\n<script>\n' + (artwork if filename == 'onde-badge-art.js' else (source / filename).read_text()) + '\n</script>\n'
html = html.replace('onde-couple-prototype-v1', 'onde-public-demo-v010')
html = '''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#282725"><meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow"><meta name="onde-version" content="0.3.0">
<meta name="application-name" content="Dés·ir"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Dés·ir">
<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="./icons/desir-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="./icons/desir-192.png">
<title>Dés·ir — À deux</title>
<style>html{background:#101613;color-scheme:dark}body{margin:0;padding:16px 0 24px;min-width:300px;background:radial-gradient(ellipse at 50% 30%,#283027 0,#141b17 65%);min-height:100vh}.cursor-interaction{cursor:pointer}@media(max-width:480px){body{padding:0;background:#181d1c}#onde-app-v1{padding:0}#onde-app-v1 .oa-shell{border-radius:0;border-left:0;border-right:0;max-width:none;box-shadow:none}}</style>
</head><body>''' + html + '</body></html>\n'
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
