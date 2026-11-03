"""Exercise the actual builder in a disposable tree, never the published files."""
import json
import copy
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

DEV = Path(__file__).resolve().parents[1]
CONFIG = {'endpoint': 'https://example.supabase.co/functions/v1/desir-game',
          'publishableKey': 'sb_publishable_testPublic'}


class BuildFixture(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='desir-build-')
        self.demo = Path(self.scratch.name) / 'demo-des'
        self.dev = self.demo / 'dev'
        self.dev.mkdir(parents=True)
        shutil.copyfile(DEV / 'build.py', self.dev / 'build.py')
        for directory in ['src', 'data']:
            shutil.copytree(DEV / directory, self.dev / directory)
        for filename in ['manifest.webmanifest', 'sw.js']:
            shutil.copyfile(DEV.parent / filename, self.demo / filename)
        shutil.copytree(DEV.parent / 'icons', self.demo / 'icons')
        (self.demo / 'server/functions/desir-game').mkdir(parents=True)
        self.archive = self.demo / 'ONDE-Xcode.zip'
        self.native_html = self.demo / 'xcode/OndeDemo/Web/index.html'
        self.native_html.parent.mkdir(parents=True)
        self.archive.write_bytes(b'archived-build-7-zip')
        self.native_html.write_text('archived-build-7-html')
        self.release = self.demo / 'index.html'
        self.release.write_text('existing-release')
        self.configure()

    def tearDown(self):
        self.scratch.cleanup()

    def configure(self, config=CONFIG):
        (self.demo / 'config.js').write_text('window.DesirConfig = Object.freeze(' + json.dumps(config) + ');\n')

    def build(self, *flags, ok=True):
        result = subprocess.run([sys.executable, str(self.dev / 'build.py'), *flags], capture_output=True, text=True)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def assert_archive_preserved(self):
        self.assertEqual(self.archive.read_bytes(), b'archived-build-7-zip')
        self.assertEqual(self.native_html.read_text(), 'archived-build-7-html')


class WebBuild(BuildFixture):
    def test_default_is_local_and_preserves_published_web(self):
        (self.demo / 'config.js').unlink()
        self.build()
        html = (self.dev / 'dist/index.html').read_text()
        self.assertNotIn('window.DesirConfig=', html)
        self.assertIn('scope.OndeRemote=api', html)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assert_archive_preserved()
        self.assertEqual((self.dev / 'src/onde-app-core.js').read_bytes(),
                         (self.demo / 'server/functions/desir-game/core.js').read_bytes())

    def test_connected_preview_has_inline_config_and_self_contained_pwa(self):
        self.build('--connected')
        html = (self.dev / 'dist/index.html').read_text()
        self.assertIn(CONFIG['endpoint'], html)
        self.assertIn('window.DesirConfig=Object.freeze(', html)
        self.assertNotIn('src="./config.js"', html)
        self.assertLess(html.index('window.DesirConfig='), html.index('scope.OndeRemote=api'))
        self.assertLess(html.index('scope.OndeRemote=api'), html.index('const remote=window.OndeRemote'))
        self.assertIn('rel="manifest" href="./manifest.webmanifest"', html)
        self.assertIn('apple-mobile-web-app-capable', html)
        self.assertIn('rel="apple-touch-icon"', html)
        for path in ['sw.js', 'manifest.webmanifest', 'icons/desir-180.png', 'icons/desir-192.png', 'icons/desir-512.png']:
            self.assertEqual((self.dev / 'dist' / path).read_bytes(), (self.demo / path).read_bytes())
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assert_archive_preserved()

    def test_release_is_connected_and_never_rebuilds_xcode(self):
        self.build('--release')
        html = self.release.read_text()
        self.assertEqual(html, (self.dev / 'dist/index.html').read_text())
        self.assertIn(CONFIG['endpoint'], html)
        self.assert_archive_preserved()

    def test_missing_or_invalid_config_fails_before_any_release_write(self):
        (self.demo / 'config.js').unlink()
        result = self.build('--release', ok=False)
        self.assertIn('no demo fallback', result.stderr)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assertFalse((self.dev / 'dist').exists())
        for config in [dict(CONFIG, publishableKey='sb_secret_notPublic'),
                       dict(CONFIG, endpoint='http://example.com/unsafe'),
                       dict(CONFIG, password='must-not-be-public')]:
            self.configure(config)
            self.build('--release', ok=False)
            self.assertEqual(self.release.read_text(), 'existing-release')
            self.assertFalse((self.dev / 'dist').exists())
        self.assert_archive_preserved()


class CuratedEvidenceBuild(BuildFixture):
    def curated_evidence(self):
        """One researched card, other cards explicitly withheld, never fake fillers."""
        current = json.loads((self.dev / 'data/card-evidence.json').read_text())
        ids = [row['cardId'] for row in current['activeEvidence'] + current.get('unavailableEvidence', [])]
        variants = [dict(metric=f'{value} %', sourceValue=value, headline='Une mesure vérifiée',
                         detail=f'Observation distincte {index}.', scope='Adultes ; contexte de contrôle.',
                         limitations='Donnée de test.', year=2026, sourceTitle='Étude de contrôle',
                         url='https://example.test/study', statKey=f'result-{index}',
                         angle=['pratique', 'appreciation', 'envie'][index], confidence='moyenne')
                    for index, value in enumerate([24, 51, 78])]
        return dict(version='test-curation', purpose='Contrôle de curation stricte',
                    activeEvidence=[dict(cardId=ids[0], **variants[0], variants=variants)],
                    unavailableEvidence=[dict(cardId=card_id, status='INTROUVABLE',
                                              reason='Aucun résultat directement vérifié dans les sources consultées.',
                                              consultedSources=[dict(title='Étude consultée', url='https://example.test/consulted')])
                                         for card_id in ids[1:]])

    def write_evidence(self, evidence):
        (self.dev / 'data/card-evidence.json').write_text(json.dumps(evidence, ensure_ascii=False))

    def test_curated_build_preserves_variants_and_documented_absences(self):
        evidence = self.curated_evidence()
        self.write_evidence(evidence)
        self.build('--release')
        html = self.release.read_text()
        embedded = html.split('<script>window.OndeEvidenceData=', 1)[1].split(';</script>', 1)[0]
        self.assertEqual(json.loads(embedded), evidence)
        self.assertEqual(json.loads((self.demo / 'card-evidence.json').read_text()), evidence)
        review = json.loads((self.demo / 'statistiques.json').read_text())
        self.assertEqual(len(review), 88)
        researched = next(row for row in review if row['cardId'] == evidence['activeEvidence'][0]['cardId'])
        self.assertEqual(researched['statut'], 'OK')
        self.assertEqual([item['statKey'] for item in researched['variantes']],
                         [item['statKey'] for item in evidence['activeEvidence'][0]['variants']])
        self.assertTrue(all(row['statut'] == 'INTROUVABLE' and not row['variantes']
                            for row in review if row is not researched))
        self.assert_archive_preserved()

    def test_invalid_curation_never_writes_a_release(self):
        valid = self.curated_evidence()
        cases = {}
        missing = copy.deepcopy(valid)
        missing['unavailableEvidence'].pop()
        cases['missing-card'] = missing
        overlap = copy.deepcopy(valid)
        overlap['unavailableEvidence'][0]['cardId'] = overlap['activeEvidence'][0]['cardId']
        cases['overlap'] = overlap
        undocumented = copy.deepcopy(valid)
        undocumented['unavailableEvidence'][0]['consultedSources'] = []
        cases['undocumented-absence'] = undocumented
        invented_absence = copy.deepcopy(valid)
        invented_absence['unavailableEvidence'][0]['metric'] = '99 %'
        cases['statistic-on-unavailable-card'] = invented_absence
        missing_variants = copy.deepcopy(valid)
        del missing_variants['activeEvidence'][0]['variants']
        cases['missing-variants'] = missing_variants
        partial_schema = copy.deepcopy(valid)
        del partial_schema['unavailableEvidence']
        cases['partial-curated-schema'] = partial_schema
        flattened = copy.deepcopy(partial_schema)
        del flattened['activeEvidence'][0]['variants']
        cases['curated-metadata-cannot-fall-back-to-legacy'] = flattened
        wrong_primary = copy.deepcopy(valid)
        wrong_primary['activeEvidence'][0]['metric'] = '25 %'
        cases['stale-primary'] = wrong_primary
        for label, evidence in cases.items():
            with self.subTest(label=label):
                self.write_evidence(evidence)
                self.build('--release', ok=False)
                self.assertEqual(self.release.read_text(), 'existing-release')
                self.assertFalse((self.dev / 'dist').exists())
        self.assert_archive_preserved()

    def test_every_variant_is_checked_and_source_duplicates_cannot_hide_in_alternatives(self):
        valid = self.curated_evidence()
        cases = []
        for field, value in [('metric', 'r = 0,35'), ('metric', '≈ 51 %'),
                             ('metric', '51 % contre 20 %'), ('sourceValue', float('nan')),
                             ('sourceValue', 50), ('year', True), ('url', 'http://example.test/study'),
                             ('angle', ''), ('angle', 'pratique'), ('angle', 'sujet voisin'),
                             ('confidence', ''), ('detail', '')]:
            evidence = copy.deepcopy(valid)
            evidence['activeEvidence'][0]['variants'][1][field] = value
            cases.append((f'invalid-alternative-{field}-{value}', evidence))
        for value in [-1, 101]:
            evidence = copy.deepcopy(valid)
            evidence['activeEvidence'][0]['variants'][1].update(metric=f'{value} %', sourceValue=value)
            cases.append((f'invalid-proportion-{value}', evidence))
        for count in [0, 4]:
            evidence = copy.deepcopy(valid)
            variants = evidence['activeEvidence'][0]['variants']
            evidence['activeEvidence'][0]['variants'] = [] if count == 0 else variants + [dict(variants[-1])]
            cases.append((f'variant-count-{count}', evidence))
        # A different headline/key does not make the same study percentage a new result.
        duplicate = copy.deepcopy(valid)
        duplicate['activeEvidence'][0]['variants'][1].update(metric='−24 %', sourceValue=-24,
                                                            url='https://EXAMPLE.test:443/study/#another-table')
        cases.append(('same-source-signed-percentage', duplicate))
        tracking = copy.deepcopy(valid)
        tracking['activeEvidence'][0]['variants'][1].update(metric='24 %', sourceValue=24,
                                                          url='https://example.test/study?utm_source=elsewhere#other')
        cases.append(('same-source-tracking-url', tracking))
        for field in ['statKey', 'detail']:
            duplicate = copy.deepcopy(valid)
            original = duplicate['activeEvidence'][0]['variants'][0][field]
            duplicate['activeEvidence'][0]['variants'][2][field] = '  ' + original.upper() + '  '
            cases.append((f'normalized-{field}-duplicate', duplicate))
        for label, evidence in cases:
            with self.subTest(label=label):
                self.write_evidence(evidence)
                self.build('--release', ok=False)
                self.assertEqual(self.release.read_text(), 'existing-release')
                self.assertFalse((self.dev / 'dist').exists())

    def test_source_identity_preserves_query_dois_and_checks_other_cards(self):
        evidence = self.curated_evidence()
        primary = evidence['activeEvidence'][0]
        # Two different PLOS papers may legitimately publish the same percentage.
        primary['variants'][0]['url'] = 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0000001'
        primary.update(primary['variants'][0])
        primary['variants'][1].update(metric='24 %', sourceValue=24,
                                      url='https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0000002')
        self.write_evidence(evidence)
        self.build()
        # Move an alternative to another card: the duplicate guard must remain global.
        duplicate = copy.deepcopy(evidence)
        record = duplicate['unavailableEvidence'].pop()
        other = dict(duplicate['activeEvidence'][0]['variants'][0])
        other.update(statKey='different-key', detail='Une autre formulation du même chiffre.',
                     url='https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0000001#table2')
        duplicate['activeEvidence'].append(dict(cardId=record['cardId'], **other, variants=[other]))
        self.write_evidence(duplicate)
        self.build('--release', ok=False)
        self.assertEqual(self.release.read_text(), 'existing-release')


if __name__ == '__main__':
    unittest.main(verbosity=1)
