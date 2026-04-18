import zipfile, os, json

base = r'C:\Users\AI\Documents\WorkBuddy\DuckAI-Export'
version = '1.1.0'

zips = [
    'DuckAI-Export-Firefox-' + version + '.zip',
    'DuckAI-Export-Edge-Chrome-' + version + '.zip',
]

print('=== manifest.json 检查 ===')
for zipname in zips:
    path = os.path.join(base, zipname)
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        manifest_path = [n for n in names if 'manifest.json' in n][0]
        manifest = json.loads(z.read(manifest_path))
        print(f'[{zipname}]')
        print(f'  version: {manifest["version"]}')
        print(f'  desc: {manifest["description"]}')
        bad = [n for n in names if chr(92) in n]
        print(f'  files: {len(names)}  backslash errors: {len(bad)}')
        if bad:
            for b in bad:
                print(f'    BACKSLASH: {b}')
        print()

print('=== Firefox ZIP 文件列表 ===')
with zipfile.ZipFile(os.path.join(base, zips[0])) as z:
    for n in z.namelist():
        print(' ', n)

print()
print('=== Edge/Chrome ZIP 文件列表 ===')
with zipfile.ZipFile(os.path.join(base, zips[1])) as z:
    for n in z.namelist():
        print(' ', n)
