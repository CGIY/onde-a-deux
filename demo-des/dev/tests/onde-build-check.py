"""Exercise the actual builder in a disposable tree, never the published files."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

DEV = Path(__file__).resolve().parents[1]
CONFIG = {'endpoint': 'https://example.supabase.co/functions/v1/desir-game',
          'publishableKey': 'sb_publishable_testPublic'}


class BuildFixture(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='desir-build-')
        self.demo = Path(self.scratch.name) / 'demo-des'
        self.dev = self.demo / 'dev'
        self.dev.mkdir(parents=True)
        for filename in ['build.py', 'badges.py']:
            shutil.copyfile(DEV / filename, self.dev / filename)
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


class BadgeArtworkBuild(BuildFixture):
    def test_every_badge_has_a_standalone_asset_and_identical_archive_entry(self):
        self.build('--release')
        folder = self.demo / 'badges'
        manifest = json.loads((folder / 'manifest.json').read_text())
        self.assertEqual(manifest['count'], 90)
        rows = manifest['assets']
        self.assertEqual(len(rows), 90)
        self.assertEqual(len({row['id'] for row in rows}), 90)
        self.assertEqual(sum(row['scope'] == 'individual' for row in rows), 30)
        self.assertEqual(sum(row['scope'] == 'shared' for row in rows), 60)
        with zipfile.ZipFile(folder / 'desir-badges.zip') as archive:
            self.assertEqual(set(archive.namelist()), {row['file'] for row in rows} | {'manifest.json'})
            for row in rows:
                data = (folder / row['file']).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), row['sha256'])
                self.assertEqual(archive.read(row['file']), data)
                self.assertEqual((self.dev / 'dist/badges' / row['file']).read_bytes(), data)
                self.assertEqual(ET.fromstring(data).get('viewBox'), '0 0 160 176')
            self.assertEqual(archive.read('manifest.json'), (folder / 'manifest.json').read_bytes())
        html = self.release.read_text()
        self.assertLess(html.index('scope.OndeBadgeArt='), html.index('const remote=window.OndeRemote'))
        gallery = (folder / 'index.html').read_text()
        for row in rows:
            self.assertIn('./' + row['file'], gallery)

    def test_rebuilding_keeps_asset_and_archive_bytes_identical(self):
        self.build('--release')
        folder = self.demo / 'badges'
        first = {path.name: path.read_bytes() for path in folder.iterdir()}
        self.build('--release')
        self.assertEqual(first, {path.name: path.read_bytes() for path in folder.iterdir()})

    def test_missing_artwork_cannot_publish_a_partial_release(self):
        path = self.dev / 'src/onde-badge-art.js'
        path.unlink()
        result = self.build('--release', ok=False)
        self.assertIn('Badge artwork could not be built', result.stderr)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assertFalse((self.dev / 'dist').exists())
        self.assertFalse((self.demo / 'badges').exists())


class MergedIntimacyBuild(BuildFixture):
    def test_release_includes_existing_cards_without_the_retired_combat(self):
        self.build('--release')
        html = self.release.read_text()
        titles = json.loads((self.dev / 'data/hardcore-cards.json').read_text())
        match = re.search(r'\bconst hardcoreCardTitles = (\{.*?\});', html, re.S)
        self.assertIsNotNone(match)
        self.assertEqual(json.loads(match.group(1)), titles)
        self.assertEqual(len(titles), 20)
        for retired in ['scope.OndeHardcore', 'window.DesirHardcoreCards',
                        'oa-hc-panel', 'Maintenez ensemble', 'Attaquer · D20']:
            self.assertNotIn(retired, html)
        self.assert_archive_preserved()

    def test_divergent_card_data_cannot_publish(self):
        path = self.dev / 'data/hardcore-cards.json'
        titles = json.loads(path.read_text())
        first = next(iter(titles))
        titles[first] += ' changed'
        path.write_text(json.dumps(titles))
        result = self.build('--release', ok=False)
        self.assertIn('exactly match', result.stderr)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assertFalse((self.dev / 'dist').exists())


class RoleplayBuild(BuildFixture):
    def setUp(self):
        super().setUp()
        self.roleplay_path = self.dev / 'data/card-roleplay.json'
        self.roleplay = json.loads(self.roleplay_path.read_text())

    def write_roleplay(self, model):
        self.roleplay_path.write_text(json.dumps(model, ensure_ascii=False))

    def assert_no_release_write(self):
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assertFalse((self.dev / 'dist').exists())
        self.assert_archive_preserved()

    def test_all_final_roleplay_cards_are_inlined_before_the_ui(self):
        self.build('--release')
        html = self.release.read_text()
        inline = re.search(r'<script>window\.DesirRoleplay=Object\.freeze\((.*?)\);</script>', html, re.S)
        self.assertIsNotNone(inline)
        model = json.loads(inline.group(1))
        self.assertEqual(model, self.roleplay)
        self.assertEqual(model['mode'], 'roleplay')
        self.assertEqual(model['universe'], 'Dés·ir')
        self.assertEqual(len(model['cards']), 144)
        self.assertEqual(len({key.rsplit(':v', 1)[0] for key in model['cards']}), 24)
        self.assertIn('six-intimite-fellation:v1', model['cards'])
        self.assertIn('six-intimite-fellation:v4', model['cards'])
        self.assertNotEqual(model['cards']['six-intimite-fellation:v1'],
                            model['cards']['six-intimite-fellation:v4'])
        self.assertLess(html.index('window.DesirRoleplay='), html.index('const remote=window.OndeRemote'))
        self.assertNotIn('src="./card-roleplay.json"', html)
        self.assert_archive_preserved()

    def test_missing_roleplay_data_cannot_publish_a_partial_release(self):
        self.roleplay_path.unlink()
        result = self.build('--release', ok=False)
        self.assertIn('complete local data', result.stderr)
        self.assert_no_release_write()

    def test_missing_unknown_or_duplicate_final_texts_fail_before_writes(self):
        first, second = list(self.roleplay['cards'])[:2]
        cases = []
        missing = json.loads(json.dumps(self.roleplay))
        del missing['cards'][first]
        cases.append(missing)
        unknown = json.loads(json.dumps(self.roleplay))
        unknown['cards']['six-unknown:v7'] = unknown['cards'].pop(first)
        cases.append(unknown)
        duplicated = json.loads(json.dumps(self.roleplay))
        duplicated['cards'][first]['text'] = '  ' + duplicated['cards'][second]['text'].upper() + '  '
        cases.append(duplicated)
        for broken in cases:
            with self.subTest(keys=list(broken['cards'])[:2]):
                self.write_roleplay(broken)
                self.build('--release', ok=False)
                self.assert_no_release_write()

    def test_invalid_percentages_prose_or_sources_fail_before_writes(self):
        first = next(iter(self.roleplay['cards']))
        cases = [dict(self.roleplay['cards'][first], metric='80 percent'),
                 dict(self.roleplay['cards'][first], metric='-20 %'),
                 dict(self.roleplay['cards'][first], metric='101 %'),
                 dict(self.roleplay['cards'][first], text=''),
                 dict(self.roleplay['cards'][first], text='x' * 181),
                 dict(self.roleplay['cards'][first], sourceUrl='https://example.com/study'),
                 dict(self.roleplay['cards'][first], password='must-not-be-public'),
                 dict(self.roleplay['cards'][first], text='Voir https://example.com/study.'),
                 dict(self.roleplay['cards'][first], text='Jeton sb_secret_mustNotBePublic')]
        for row in cases:
            with self.subTest(row=row):
                model = json.loads(json.dumps(self.roleplay))
                model['cards'][first] = row
                self.write_roleplay(model)
                self.build('--release', ok=False)
                self.assert_no_release_write()

    def test_roleplay_cannot_lose_its_fictional_context(self):
        for patch in [{'mode': 'survey'}, {'universe': ''}, {'source': 'Not a game'}]:
            with self.subTest(patch=patch):
                self.write_roleplay({**self.roleplay, **patch})
                self.build('--release', ok=False)
                self.assert_no_release_write()

    def test_inline_roleplay_text_cannot_close_its_script(self):
        first = next(iter(self.roleplay['cards']))
        text = 'Une fiction qui contient </script><script>window.unwanted=true</script> reste du texte.'
        self.roleplay['cards'][first]['text'] = text
        self.write_roleplay(self.roleplay)
        self.build()
        html = (self.dev / 'dist/index.html').read_text()
        self.assertNotIn('</script><script>window.unwanted=true', html)
        inline = re.search(r'<script>window\.DesirRoleplay=Object\.freeze\((.*?)\);</script>', html, re.S)
        self.assertEqual(json.loads(inline.group(1))['cards'][first]['text'], text)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assert_archive_preserved()


class RetiredStatisticsBuild(BuildFixture):
    def test_release_removes_old_statistics_without_touching_game_or_archive(self):
        retired = ['card-evidence.json', 'statistiques.json', 'statistiques.html']
        preview = self.dev / 'dist'
        preview.mkdir()
        for folder in [self.demo, preview]:
            for filename in retired:
                (folder / filename).write_text('old-card-statistics')
        self.build('--release')
        for folder in [self.demo, preview]:
            for filename in retired:
                self.assertFalse((folder / filename).exists(), str(folder / filename))
        html = self.release.read_text()
        for marker in ['OndeEvidence', 'oa-card-fact', 'Source & contexte', 'statKey']:
            self.assertNotIn(marker, html)
        self.assertIn('VOTRE SCORE À DEUX', html)
        self.assertIn('gradeLevels', html)
        self.assertIn('window.DesirCardNotes=Object.freeze(', html)
        self.assertIn('oa-card-note', html)
        self.assertIn('Relancer la carte', html)
        self.assert_archive_preserved()

    def test_invalid_card_sentences_do_not_write_a_release(self):
        path = self.dev / 'data/card-notes.json'
        valid = json.loads(path.read_text())
        first, second = list(valid)[:2]
        for broken in [dict(list(valid.items())[1:]), {**valid, first: ''},
                       {**valid, first: valid[second]}, {**valid, first: 'Une étude annonce 80 %.'}]:
            path.write_text(json.dumps(broken))
            self.build('--release', ok=False)
            self.assertEqual(self.release.read_text(), 'existing-release')
            self.assertFalse((self.dev / 'dist').exists())

    def test_local_cleanup_leaves_the_published_release_untouched(self):
        for filename in ['card-evidence.json', 'statistiques.json', 'statistiques.html']:
            (self.demo / filename).write_text('existing-public-artifact')
        self.build()
        for filename in ['card-evidence.json', 'statistiques.json', 'statistiques.html']:
            self.assertEqual((self.demo / filename).read_text(), 'existing-public-artifact')
        self.assertEqual(self.release.read_text(), 'existing-release')


if __name__ == '__main__':
    unittest.main(verbosity=1)
