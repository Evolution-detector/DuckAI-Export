import zipfile, os, shutil, json

base = r'C:\Users\AI\Documents\WorkBuddy\DuckAI-Export'
version = '1.1.1'

def make_zip_flat(folder, output_zip):
    """打包扩展用：manifest.json 直接在 ZIP 根目录，无前缀目录。"""
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(folder):
            for file in files:
                full = os.path.join(root, file)
                arc = full[len(folder)+1:]          # 去掉 folder 前缀
                z.write(full, arc.replace(os.sep, '/'))

# 1. Firefox（manifest.json 在 ZIP 根目录）
make_zip_flat(
    os.path.join(base, 'dist', 'firefox-mv3'),
    os.path.join(base, 'DuckAI-Export-Firefox-' + version + '.zip'),
)

# 2. Edge/Chrome - copy chrome-mv3 to EdgeVersion first
edge_dir = os.path.join(base, 'EdgeVersion')
shutil.rmtree(edge_dir, ignore_errors=True)
shutil.copytree(os.path.join(base, 'dist', 'chrome-mv3'), edge_dir)
make_zip_flat(
    edge_dir,
    os.path.join(base, 'DuckAI-Export-Edge-Chrome-' + version + '.zip'),
)

# 3. Source（扁平化，只打包源码文件，README.md 保持原样不修改）
EXCLUDE_DIRS = {'dist', 'EdgeVersion', 'node_modules', '.git', 
                'V1.0源码', 'V1.1 源码', '源码',   # ← 历史备份目录
                'dev', 'generated-images', '.workbuddy', '.wxt', 'docs'}
EXCLUDE_BASENAMES = {'build_log.txt', 'build_result.txt'}  # 构建日志，不进源码包
EXCLUDE_EXTENSIONS = {'.zip', '.log'}  # 不打包 zip 文件（避免自我嵌套）和日志文件（构建产物）
def make_zip_source(folder, output_zip):
    """打包源码用：manifest.json 直接在 ZIP 根目录，只包含源码文件。"""
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(folder):
            # 剪枝：跳过不需要的目录（原地修改 dirs）
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if file in EXCLUDE_BASENAMES:
                    continue
                if any(file.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
                    continue
                full = os.path.join(root, file)
                arc = full[len(folder)+1:]
                z.write(full, arc.replace(os.sep, '/'))

make_zip_source(
    base,
    os.path.join(base, 'DuckAI-Export-' + version + '-Source.zip'),
)

# Verify manifests
print('=== manifest.json 验证 ===')
for name, subdir in [('Firefox', 'firefox-mv3'), ('Edge/Chrome', 'chrome-mv3')]:
    with open(os.path.join(base, 'dist', subdir, 'manifest.json'), encoding='utf-8') as f:
        m = json.load(f)
    print(f'{name}: version={m["version"]}  default_locale={m.get("default_locale", "(not set)")}')
    print(f'  name={m["name"]}')
    print(f'  description={m["description"]}')

print()
print('=== 最终交付物 ===')
for name in [
    'DuckAI-Export-Firefox-' + version + '.zip',
    'DuckAI-Export-Edge-Chrome-' + version + '.zip',
    'DuckAI-Export-' + version + '-Source.zip',
]:
    size = os.path.getsize(os.path.join(base, name))
    print(f'  {name}: {size:,} bytes')

print()
print('=== ZIP 根目录结构验证（前10项）===')
for label, zipname in [
    ('Firefox',    'DuckAI-Export-Firefox-' + version + '.zip'),
    ('Edge/Chrome','DuckAI-Export-Edge-Chrome-' + version + '.zip'),
]:
    zippath = os.path.join(base, zipname)
    with zipfile.ZipFile(zippath) as z:
        names = sorted(z.namelist())
    has_manifest = 'manifest.json' in names
    print(f'  [{label}] manifest.json at root: {"OK YES" if has_manifest else "!! NO - structure error!"}')
    print(f'  top10: {names[:10]}')

# 源码 ZIP 验证
src_zip = os.path.join(base, 'DuckAI-Export-' + version + '-Source.zip')
with zipfile.ZipFile(src_zip) as z:
    src_names = sorted(z.namelist())
has_readme = 'README.md' in src_names
has_wxt    = 'wxt.config.ts' in src_names
has_manifest = 'manifest.json' in src_names
print(f'  [Source] README.md at root: {"OK YES" if has_readme else "!! NO"}')
print(f'  [Source] wxt.config.ts at root: {"OK YES" if has_wxt else "!! NO"}')
print(f'  [Source] manifest.json at root: {"OK YES" if has_manifest else "OK (no manifest - source package)"}')
print(f'  [Source] top10: {src_names[:10]}')
