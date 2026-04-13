from PIL import Image
import os

src = r'C:\Users\AI\Documents\WorkBuddy\DuckAI-Export\generated-images\A_minimalist_duck_icon_logo_fo_2026-04-09T08-08-40.png'
dst_dir = r'C:\Users\AI\Documents\WorkBuddy\DuckAI-Export\icons'

os.makedirs(dst_dir, exist_ok=True)

for size in [48, 96, 128]:
    img = Image.open(src)
    img = img.resize((size, size), Image.LANCZOS)
    out_path = os.path.join(dst_dir, f'icon-{size}.png')
    img.save(out_path, 'PNG')
    print(f'Saved: {out_path}')
