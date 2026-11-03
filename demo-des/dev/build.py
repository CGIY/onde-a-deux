"""Build Dés·ir from its editable sources.

Default: isolated local demo preview. --connected: authenticated web preview.
--release: publishable authenticated web files; the archived Xcode build is kept.
"""
from pathlib import Path
import argparse
import shutil
import json
import math
import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

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
evidence_document = json.loads((root / 'data/card-evidence.json').read_text())
evidence = evidence_document['activeEvidence']
rows_source = (source / 'onde-app-core.js').read_text().split('const catalogRows = [', 1)[1].split('];', 1)[0]
card_ids = set(re.findall(r"id:'([^']+)'", rows_source))


def canonical_source_url(value):
    """Keep identifying query parameters (notably PLOS DOI IDs), ignore fragments."""
    if not isinstance(value, str) or value != value.strip() or any(c.isspace() for c in value):
        raise ValueError('Invalid source URL')
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Invalid source URL')
    port = parsed.port
    host = parsed.hostname.lower()
    if ':' in host:
        host = '[' + host + ']'
    if port and port != 443:
        host += ':' + str(port)
    query = [(key, val) for key, val in parse_qsl(parsed.query, keep_blank_values=True)
             if not key.lower().startswith('utm_') and key.lower() not in {'fbclid', 'gclid'}]
    return urlunparse(('https', host, parsed.path.rstrip('/') or '/', parsed.params,
                       urlencode(sorted(query)), ''))


def normalized_text(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def validate_evidence(document):
    """The curated schema can withhold evidence; old flat data remains transitional."""
    rows = document.get('activeEvidence')
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError('activeEvidence must be an array of facts')
    strict = 'unavailableEvidence' in document or any(
        any(field in row for field in ['variants', 'sourceValue', 'angle', 'confidence']) for row in rows)
    unavailable_rows = document.get('unavailableEvidence', [])
    if strict and (not isinstance(unavailable_rows, list) or 'unavailableEvidence' not in document):
        raise ValueError('Curated evidence requires unavailableEvidence')
    if any(not isinstance(row, dict) for row in unavailable_rows):
        raise ValueError('unavailableEvidence must be an array of records')
    if strict and any(not isinstance(document.get(field), str) or not document[field].strip()
                      for field in ['version', 'purpose']):
        raise ValueError('Curated evidence requires version and purpose')
    active_ids = [row.get('cardId') for row in rows]
    absent_ids = [row.get('cardId') for row in unavailable_rows]
    ids = active_ids + absent_ids
    if any(not isinstance(card_id, str) for card_id in ids) or len(ids) != len(set(ids)) or set(ids) != card_ids:
        raise ValueError('Evidence and unavailable records must cover every active card exactly once, without overlap')
    seen = {'statKey': set(), 'detail': set(), 'sourceValue': set()}
    text_fields = ['metric', 'headline', 'detail', 'scope', 'limitations', 'sourceTitle', 'url', 'statKey']
    for row in rows:
        variants = row.get('variants') if strict else [row]
        angles = set()
        if not isinstance(variants, list) or not 1 <= len(variants) <= 3 or any(not isinstance(v, dict) for v in variants):
            raise ValueError('Each active card needs one to three variants: ' + row['cardId'])
        if strict and any(row.get(field) != value for field, value in variants[0].items()):
            raise ValueError('Primary evidence must equal the first variant: ' + row['cardId'])
        for variant in variants:
            if any(not isinstance(variant.get(field), str) or not variant[field].strip() for field in text_fields):
                raise ValueError('Incomplete evidence: ' + row['cardId'])
            if type(variant.get('year')) is not int or variant['year'] <= 0:
                raise ValueError('Invalid evidence year: ' + row['cardId'])
            source_url = canonical_source_url(variant['url'])
            for field in ['statKey', 'detail']:
                key = normalized_text(variant[field])
                if key in seen[field]:
                    raise ValueError('Duplicate evidence result: ' + field)
                seen[field].add(key)
            if strict:
                match = re.fullmatch(r'([+\-−]?\d+(?:[.,]\d+)?)\s*%', variant['metric'].strip())
                value = variant.get('sourceValue')
                if not match or type(value) not in (int, float) or not math.isfinite(value):
                    raise ValueError('Each variant requires one finite percentage and sourceValue: ' + row['cardId'])
                metric_value = float(match.group(1).replace('−', '-').replace(',', '.'))
                if not math.isfinite(metric_value) or metric_value != value:
                    raise ValueError('Percentage and sourceValue disagree: ' + row['cardId'])
                if not 0 <= value <= 100:
                    raise ValueError('A proportion of respondents must be between zero and one hundred: ' + row['cardId'])
                angle = variant.get('angle')
                if angle not in {'pratique', 'appreciation', 'benefice', 'envie'} or angle in angles:
                    raise ValueError('Each variant requires a different supported angle: ' + row['cardId'])
                angles.add(angle)
                confidence = variant.get('confidence')
                if not ((isinstance(confidence, str) and confidence.strip()) or
                        (type(confidence) in (int, float) and math.isfinite(confidence) and 0 <= confidence <= 1)):
                    raise ValueError('Missing or invalid evidence confidence: ' + row['cardId'])
                source_value = (source_url, abs(value))
                if source_value in seen['sourceValue']:
                    raise ValueError('Duplicate percentage from the same source: ' + row['cardId'])
                seen['sourceValue'].add(source_value)
    for row in unavailable_rows:
        if set(row) != {'cardId', 'status', 'reason', 'consultedSources'} or row['status'] != 'INTROUVABLE':
            raise ValueError('Unavailable evidence must contain only its status, reason and sources: ' + row['cardId'])
        if not isinstance(row['reason'], str) or not row['reason'].strip():
            raise ValueError('Unavailable evidence needs a reason: ' + row['cardId'])
        consulted = row['consultedSources']
        if not isinstance(consulted, list) or not consulted:
            raise ValueError('Unavailable evidence needs consulted sources: ' + row['cardId'])
        for item in consulted:
            if not isinstance(item, dict) or not isinstance(item.get('title'), str) or not item['title'].strip():
                raise ValueError('Incomplete consulted source: ' + row['cardId'])
            canonical_source_url(item.get('url'))
    return document if strict else rows


try:
    evidence_payload = validate_evidence(evidence_document)
except (ValueError, TypeError) as error:
    raise SystemExit(str(error))


def statistics_review():
    """Derive the review from the same facts as the app, without a second catalogue."""
    catalog = re.findall(r"\{id:'([^']+)',categoryId:'([^']+)',title:'((?:\\.|[^'])*)'", rows_source)
    if {item[0] for item in catalog} != card_ids:
        raise SystemExit('Review catalogue does not match the active game')
    audit_path = root / 'data/card-evidence-audit.json'
    audit = json.loads(audit_path.read_text()) if audit_path.exists() else {'review': []}
    notes = {row['cardId']: row for row in audit['review']}
    active = {row['cardId']: row for row in evidence}
    absent = {row['cardId']: row for row in evidence_document.get('unavailableEvidence', [])}
    review = []
    for card_id, category, title in catalog:
        fact = active.get(card_id)
        variants = fact.get('variants', [fact]) if fact else []
        review.append({
            'cardId': card_id, 'category': category, 'challenge': title.replace("\\'", "'"),
            'variantes': [{
                'texte': item['detail'], 'chiffre': item.get('sourceValue'), 'angle': item.get('angle'),
                'source': item['sourceTitle'], 'year': item['year'], 'population': item['scope'],
                'url': item['url'], 'confiance': item.get('confidence'),
                'note': item['limitations'], 'statKey': item['statKey']
            } for item in variants],
            'statut': 'OK' if len(variants) == 3 else 'PARTIEL' if variants else 'INTROUVABLE',
            'sources_consultees_si_introuvable': absent.get(card_id, {}).get('consultedSources', []),
            'reason': absent.get(card_id, {}).get('reason', ''),
            'exclusionReasons': notes.get(card_id, {}).get('exclusionReasons', [])
        })
    return json.dumps(review, ensure_ascii=False, indent=2) + '\n'


review_json = statistics_review()
html = (source / 'onde-app-ui.html').read_text()
html += '\n<script>window.OndeEvidenceData=' + json.dumps(evidence_payload, ensure_ascii=False).replace('<', '\\u003c') + ';</script>\n'
if connected:
    # Inline this public setting: a failed config request must never select local demo mode.
    html += '\n<script>' + configuration + '</script>\n'
for filename in ['onde-app-core.js', 'onde-app-dice.js', 'onde-app-evidence.js', 'onde-app-remote.js', 'onde-app-ui.js']:
    html += '\n<script>\n' + (source / filename).read_text() + '\n</script>\n'
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
(root / 'dist/index.html').write_text(html)
(root / 'dist/statistiques.json').write_text(review_json)
shutil.copyfile(source / 'onde-statistics-review.html', root / 'dist/statistiques.html')
shutil.copyfile(root / 'data/card-evidence.json', root / 'dist/card-evidence.json')
for filename in ['manifest.webmanifest', 'sw.js']:
    shutil.copyfile(demo / filename, root / 'dist' / filename)
shutil.copytree(demo / 'icons', root / 'dist/icons', dirs_exist_ok=True)
# Both deployments execute exactly the same game rules.
shutil.copyfile(source / 'onde-app-core.js', demo / 'server/functions/desir-game/core.js')
print('Built ' + ('connected' if connected else 'local demo') + ' preview:', root / 'dist/index.html')
if options.release:
    (demo / 'index.html').write_text(html)
    (demo / 'statistiques.json').write_text(review_json)
    shutil.copyfile(source / 'onde-statistics-review.html', demo / 'statistiques.html')
    for filename in ['card-evidence.json', 'stck-adaptations.json']:
        shutil.copyfile(root / 'data' / filename, demo / filename)
    print('Updated connected web release; archived Xcode resources and ZIP are unchanged:', demo)
