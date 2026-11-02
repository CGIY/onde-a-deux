"""Exercise the actual builder in a disposable tree, never the published files."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

DEV = Path(__file__).resolve().parents[1]
CONFIG = {'endpoint': 'https://example.supabase.co/functions/v1/desir-game',
          'publishableKey': 'sb_publishable_testPublic'}


class WebBuild(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main(verbosity=1)
