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


def highlight_rough(body):
    spitting = re.search(r'<div class="rough-extra"><div>.*?</div><p>.*?</p></div>', body, re.S)
    insults = re.search(r'<div><span>Insultes</span>(<b>.*?</b>)</div>', body, re.S)
    if not spitting or not insults:
        raise SystemExit('Missing the highlighted rough-play statistics.')
    body = body.replace(spitting[0], '', 1).replace(insults[0], '', 1)
    featured = spitting[0].replace(
        'Rapports déclarés consentis; accord sur le geste non isolé.',
        'Accord mesuré à l’échelle du rapport.'
    ).replace('≈ 1/4 des répondants · déjà pratiqué<br>', 'Déjà pratiqué. ')
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
        'destinations': ('Enquête et préférences', 'Où va le sperme ?'),
        'rough': ('Expériences déclarées', 'Roleplay et jeux rudes.'),
        'women': ('Fantasmes déclarés', 'Et du côté des femmes ?'),
    }
    cards = {}
    for classes, body in re.findall(r'<section class="block ([^"]+)">(.*?)</section>', reference, re.S):
        keys = classes.split()
        key = 'benchmarks' if 'benchmarks' in keys else keys[0]
        if key not in titles:
            continue
        if key in cards:
            raise SystemExit(f'Duplicate libido card: {key}.')
        body, count = re.subn(r'<p class="section-no">[^<]+</p>', '', body, count=1)
        if count != 1:
            raise SystemExit(f'Missing libido card heading: {key}.')
        if key == 'places':
            rows = list(re.finditer(
                r'<div class="place-row"><span>([^<]+)</span>.*?<i style="--width:(\d+)%"></i>.*?</b></div>',
                body, re.S,
            ))
            nature_labels = {'Campagne', 'Bois', 'Mer'}
            nature_rows = [row for row in rows if row[1] in nature_labels]
            if len(nature_rows) != len(nature_labels) or {row[1] for row in nature_rows} != nature_labels:
                raise SystemExit('Missing or duplicated nature rows in the places chart.')
            average = round(sum(int(row[2]) for row in nature_rows) / len(nature_rows))
            ranked_rows = [(int(row[2]), row[0]) for row in rows if row[1] not in nature_labels]
            ranked_rows.append((average, (
                '<div class="place-row"><span>Dans la nature'
                '<small class="place-average">Moyenne de 3 lieux</small></span>'
                '<div class="place-track" aria-hidden="true">'
                f'<i style="--width:{average}%"></i></div>'
                '<b><span aria-hidden="true">≈</span>'
                f'<span class="count-value" data-count="{average}" aria-hidden="true">{average}</span>'
                f'<span class="sr-only">Environ {average}</span><small>%</small></b></div>'
            )))
            ranked_rows.sort(key=lambda row: row[0], reverse=True)
            body = body[:rows[0].start()] + ''.join(markup for _, markup in ranked_rows) + body[rows[-1].end():]

            def place_band(match):
                value = int(match[2])
                band = 'high' if value >= 65 else 'mid' if value >= 50 else 'low' if value >= 25 else 'rare'
                return f'<div class="place-row" data-frequency="{band}">{match[1]}'

            body = re.sub(r'<div class="place-row">(.*?style="--width:(\d+)%")', place_band, body, flags=re.S)
            body = body.replace('<div><span>Lieux de culte / religieux</span>',
                                '<div class="place-fantasy-featured"><span>Lieux de culte / religieux</span>')
            body = body.replace('Couples cohabitants · France 2025 · expériences vécues', 'Expériences de couples cohabitants en France')
            body = re.sub(r'<div class="place-extras">.*?(?=<div class="place-fantasies">)', '', body, flags=re.S)
            body = re.sub(r'<div><span>(?:Cinéma|Travail)</span><b>.*?</b></div>', '', body, flags=re.S)
            body = body.replace('<small>Rapport France 2025</small>', '')
        if key == 'rough':
            body = highlight_rough(body)
            body = body.replace('<p class="base">Repère international · enquête universitaire · 2021</p>', '')
            body = re.sub(r'<p class="rough-group-label">.*?</p>', '', body, flags=re.S)
            body = re.sub(r'<small>≈ [^<]+</small>', '', body)
            body = body.replace('des <b>étudiants ayant un partenaire</b> interrogés déclarent des jeux rudes avec lui.',
                                'des étudiants interrogés ayant un partenaire déclarent des jeux rudes.')
        if key == 'benchmarks':
            shares = re.findall(r'data-count="([0-9]+)"', body)
            if len(shares) != 3:
                raise SystemExit('Expected two couple benchmarks and one anal benchmark.')
            weekly, frequent, anal = shares
            body = f"""
<table class="oa-rhythm-table" aria-label="Fréquences par semaine">
  <thead><tr><th scope="col">Par semaine</th><th scope="col" class="oa-rhythm-reference"><small>Repères nationaux</small> <strong>Hebdomadaires</strong></th><th scope="col" data-rhythm-personal hidden>Notre rythme</th></tr></thead>
  <tbody>
    <tr><th scope="row">Avec pénétration</th><td><div class="oa-rhythm-benchmarks"><span><b><i>≥</i>1</b><small>{weekly} %</small></span><span><b><i>≥</i>3</b><small>{frequent} %</small></span></div></td><td class="oa-rhythm-value" data-rhythm-rate="withPenetration" data-rhythm-personal hidden></td></tr>
    <tr><th scope="row">Sans pénétration</th><td><div class="oa-rhythm-benchmarks"><span><b><i>≈</i>3</b><small>indicatif</small></span></div></td><td class="oa-rhythm-value" data-rhythm-rate="withoutPenetration" data-rhythm-personal hidden></td></tr>
    <tr><th scope="row">Pénétration anale</th><td><div class="oa-rhythm-benchmarks"><span><b><i>≥</i>1</b><small>{anal} % · 18–24 ans</small></span></div></td><td class="oa-rhythm-value" data-rhythm-rate="anal" data-rhythm-personal hidden></td></tr>
  </tbody>
</table>
<div class="oa-rhythm-period" data-rhythm-personal hidden><span>Notre total <b data-rhythm-rate="total"></b> / sem.</span><span data-rhythm-dates></span></div>
<details class="oa-rhythm-editor" data-rhythm-editor hidden>
  <summary>Ajouter un rapport</summary>
  <div class="oa-rhythm-choices">
    <button type="button" data-rhythm-add="penetration">Avec pénétration (hors anal)</button>
    <button type="button" data-rhythm-add="no_penetration">Sans pénétration</button>
    <button type="button" data-rhythm-add="anal">Anal</button>
  </div>
  <p data-rhythm-status role="status"></p>
</details>
"""
        if key == 'women':
            body = body.split('<div class="women-porn">', 1)[0]
            body = body.replace('<p class="women-kicker">Fantasmes déclarés</p>', '')
            match = re.search(r'<div class="women-fantasies">(.*?)</div><p class="women-source">.*?</p>', body, re.S)
            if match is None:
                raise SystemExit('Missing fantasy ranking.')
            rows = [
                row for row in re.findall(r'<div class="women-fantasy-row">.*?</b></div>', match[1], re.S)
                if '<span>Être attachée</span>' not in row and '<span>Dominer</span>' not in row
            ]
            if not rows:
                raise SystemExit('Empty fantasy ranking.')
            rows.sort(key=lambda row: float(re.search(r'data-count="([0-9.]+)"', row)[1]), reverse=True)
            body = body[:match.start(1)] + ''.join(rows) + '</div>' + body[match.end():]
            question = 'Cap d’en choisir un qui nous tente tous les deux ?'
            body += (
                f'<p class="women-invitation"><span class="oa-sr">{question}</span>'
                f'<span class="women-invitation-ink" aria-hidden="true"><span>{question}</span><span></span></span></p>'
            )
        if key == 'destinations':
            split = re.search(r'<div class="setting-labels">.*?</div>', body, re.S)
            proportions = re.findall(r'data-count="(\d+)"', split[0]) if split else []
            if len(proportions) != 2 or sum(map(int, proportions)) != 100:
                raise SystemExit('The personal setting split must add up to 100%.')
            inside, outside = proportions
            body = body.replace('<div class="setting-bars"', f'<div class="setting-bars" style="--inside:{inside}fr;--outside:{outside}fr"', 1)
            body = body.replace('Expériences déclarées · France 2021<br><strong>Sélection hors vagin et tissus</strong>',
                                'France · vie entière · choix multiples (hors vagin et tissus).')
            body = body.replace('Maison / intérieur</span>', 'À la maison</span>').replace('Dehors / ville / plage</span>', 'Hors de chez soi</span>')
            body = re.sub(r'<p>≈ [^<]+ des participantes</p>', '', body)
            body = re.sub(r'<div class="dest-choice">.*?</div>', '', body, flags=re.S)
            body = body.replace('Mon cadre idéal, préférence personnelle : maison ou intérieur', 'Préférence personnelle : à la maison')
            body = body.replace('; dehors, ville ou plage', '; hors de chez soi')
            body = body.replace('<div class="dest-cell"><h3>Dans la bouche</h3>',
                                '<div class="dest-cell dest-featured"><h3>Dans la bouche</h3>')
        body = re.sub(r'<p class="(?:context-note|dest-ideal-caption|rough-fraction|rough-enjoyment|rough-unmeasured|anal-foot)">.*?</p>',
                      '', body, flags=re.S)
        body = re.sub(r'\s*<a\b[^>]*href="#source-\d+"[^>]*>[^<]*</a>', '', body)
        body = body.replace('class="sr-only"', 'class="oa-sr"').replace('data-count=', 'data-info-count=')
        cards[key] = body
    if cards.keys() != titles.keys():
        raise SystemExit('Missing libido cards in p/index.html.')

    def reading_section(key, content, *, nested=False):
        if key == 'benchmarks':
            return f'<section class="oa-info-card oa-libido benchmarks" id="oa-libido-card-benchmarks" aria-label="Fréquences hebdomadaires">{content}</section>'
        label, title = titles[key]
        css_class = 'oa-libido-subsection' if nested else f'oa-info-card oa-libido {key}'
        heading = 'h3' if nested else 'h2'
        return (
            f'<section class="{css_class}" id="oa-libido-card-{key}" '
            f'aria-labelledby="oa-libido-title-{key}">'
            f'<p class="oa-info-kicker">{label}</p><{heading} id="oa-libido-title-{key}">{title}</{heading}>'
            f'{content}</section>'
        )

    cards['women'] += reading_section('rough', cards.pop('rough'), nested=True)
    return '\n'.join(f'<template id="oa-libido-{key}">{reading_section(key, body)}</template>'
                     for key, body in cards.items()) + '\n'


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
html += libido_modules()
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
