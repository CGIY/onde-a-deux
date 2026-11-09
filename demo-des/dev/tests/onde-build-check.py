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
        (self.demo.parent / 'p').mkdir()
        shutil.copyfile(DEV.parent.parent / 'p/index.html', self.demo.parent / 'p/index.html')
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

    def test_personal_avatars_only_appear_in_local_demo(self):
        portraits = self.dev / 'local-avatars'
        portraits.mkdir()
        (portraits / 'a.jpg').write_bytes(b'avatar-a')
        (portraits / 'b.jpg').write_bytes(b'avatar-b')
        preview = self.dev / 'dist/index.html'
        self.build()
        self.assertRegex(preview.read_text(), r'data-player="a"[^>]*><span class="oa-player-avatar">[^>]+alt="Clément"')
        self.assertRegex(preview.read_text(), r'data-player="b"[^>]*><span class="oa-player-avatar">[^>]+alt="Agathe"')

        self.build('--release')
        for output in [self.release, preview]:
            self.assertNotIn('class="oa-player-avatar"', output.read_text())

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
        self.assertIn('height:var(--oa-viewport-height,100dvh);max-height:100dvh;', html)
        self.assertNotIn('#onde-app-v1.oa-installed{height:', html)
        self.assertIn('rel="apple-touch-icon"', html)
        self.assertIn('<title>D6 à deux</title>', html)
        self.assertNotIn('window.DesirRoleplay', html)
        self.assertNotIn('class="oa-roleplay', html)
        self.assertIn('name="apple-mobile-web-app-title" content="D6 à deux"', html)
        self.assertNotIn(' cartes par main', html)
        manifest = json.loads((self.dev / 'dist/manifest.webmanifest').read_text())
        self.assertEqual(manifest['background_color'], manifest['theme_color'])
        self.assertIn(f'name="theme-color" content="{manifest["theme_color"]}"', html)
        self.assertIn(f'--d6-edge-color:{manifest["background_color"]}', html)
        self.assertEqual((manifest['name'], manifest['short_name']), ('D6 à deux', 'D6 à deux'))
        self.assertEqual((manifest['id'], manifest['start_url'], manifest['scope']), ('./', './', './'))
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

    def test_info_questions_are_embedded_and_duplicates_stop_the_build(self):
        self.build('--connected')
        html = (self.dev / 'dist/index.html').read_text()
        deck = json.loads(re.search(r'window.DesirInfoQuestions=(.*?);</script>', html)[1])
        self.assertEqual({theme: len(items) for theme, items in deck.items()},
                         {'complicite': 25, 'attention': 25, 'projets': 25, 'intimite': 25})
        deck['attention'][0] = deck['complicite'][0].upper()
        (self.dev / 'data/info-questions.json').write_text(json.dumps(deck))
        result = self.build('--release', ok=False)
        self.assertIn('Info questions must be unique', result.stderr)
        self.assertEqual(self.release.read_text(), 'existing-release')

    def test_libido_cards_are_assembled_without_source_mentions(self):
        self.build('--release')
        html = self.release.read_text()
        modules = re.findall(r'<template id="oa-libido-([^"]+)">', html)
        self.assertCountEqual(modules, ['places', 'benchmarks', 'destinations', 'women'])
        self.assertNotIn('href="#source-', html)
        self.assertNotIn('Sources & périmètres', html)
        self.assertNotIn('www.ipsos.com', html)
        self.assertNotRegex(html, r'Source \[\d+\]|>\[\d+\]</a>')
        self.assertNotIn('class="dest-choice"', html)
        self.assertNotIn('class="women-porn"', html)
        self.assertIn('class="place-row" data-frequency="high"', html)
        self.assertIn('class="place-fantasy-featured"', html)
        self.assertIn('class="rough-highlights"', html)
        self.assertIn('class="rough-insults"', html)
        self.assertIn('class="dest-cell dest-featured"', html)
        self.assertEqual(html.count('class="frequency-label"'), 2)
        self.assertNotIn('class="place-extras"', html)
        women = re.search(r'<template id="oa-libido-women">(.*?)</template>', html, re.S)[1]
        fantasies, experiences = women.split('<section class="oa-libido-subsection" id="oa-libido-card-rough"')
        self.assertEqual(re.findall(r'data-info-count="([^"]+)"', fantasies),
                         ['64.6', '57.3', '56.5', '36.3', '32.5'])
        self.assertNotIn('799 répondantes', fantasies)
        self.assertNotIn('Être attachée', fantasies)
        self.assertNotIn('>Dominer<', fantasies)
        self.assertIn('<h3 id="oa-libido-title-rough">Roleplay et jeux rudes.</h3>', experiences)
        self.assertTrue(experiences.endswith('</section></section>'))
        places = re.search(r'<template id="oa-libido-places">(.*?)</template>', html, re.S)[1]
        self.assertNotIn('>Cinéma<', places)
        self.assertNotIn('>Travail<', places)
        destinations = re.search(r'<template id="oa-libido-destinations">(.*?)</template>', html, re.S)[1]
        self.assertIn('À la maison', destinations)
        self.assertIn('Hors de chez soi', destinations)
        self.assertIn('data-info-count="72"', html)

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
        self.assertEqual(manifest['version'], 2)
        self.assertEqual(manifest['count'], 120)
        rows = manifest['assets']
        self.assertEqual(len(rows), 120)
        self.assertEqual(len({row['id'] for row in rows}), 120)
        self.assertEqual(sum(row['scope'] == 'individual' for row in rows), 30)
        self.assertEqual(sum(row['scope'] == 'shared' for row in rows), 90)
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
        path = self.dev / 'src/onde-badge-frame.js'
        path.unlink()
        result = self.build('--release', ok=False)
        self.assertIn('Badge artwork requires its constellation renderer', result.stderr)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assertFalse((self.dev / 'dist').exists())
        self.assertFalse((self.demo / 'badges').exists())

    def test_incomplete_constellation_catalogue_cannot_publish(self):
        path = self.dev / 'src/onde-badge-frame.js'
        path.write_text(path.read_text().replace('game.badgeCatalog.map', 'game.badgeCatalog.slice(1).map', 1))
        generated = (self.dev / 'src/onde-badge-art.js').read_bytes()
        result = self.build('--release', ok=False)
        self.assertIn('Badge artwork coverage or catalogue order mismatch', result.stderr)
        self.assertEqual(self.release.read_text(), 'existing-release')
        self.assertEqual((self.dev / 'src/onde-badge-art.js').read_bytes(), generated)
        self.assertFalse((self.dev / 'dist').exists())

    def test_generated_module_can_be_rebuilt_from_its_renderer(self):
        path = self.dev / 'src/onde-badge-art.js'
        path.unlink()
        self.build('--release')
        self.assertIn('Generated by dev/build.py', path.read_text())
        self.assertIn(path.read_text(), self.release.read_text())


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
