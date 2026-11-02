from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent
source = root / 'xcode'
shutil.copyfile(source / 'OndeDemo' / 'Web' / 'index.html', root / 'index.html')
with zipfile.ZipFile(root / 'ONDE-Xcode.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob('*')):
        if path.is_file() and not any(part in {'xcuserdata', 'DerivedData', '.DS_Store', '.git'} for part in path.parts):
            archive.write(path, Path('ONDE-Xcode') / path.relative_to(source))
print('La page jouable et ONDE-Xcode.zip ont été mis à jour.')
