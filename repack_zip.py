import zipfile, os

src = r"C:\Users\AI\Documents\WorkBuddy\DuckAI-Export\dist\firefox-mv3"
dst = r"C:\Users\AI\Documents\WorkBuddy\DuckAI-Export\DuckAI-Export-V1.1.zip"

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        for file in files:
            full_path = os.path.join(root, file)
            arc_name = os.path.relpath(full_path, src).replace(os.sep, '/')
            zf.write(full_path, arc_name)

print("Done:", dst)
