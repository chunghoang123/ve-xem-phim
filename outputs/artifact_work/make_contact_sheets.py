import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw


source = Path(sys.argv[1])
prefix = sys.argv[2]
files = sorted(source.glob("page-*.png"))
out_dir = source / "contact"
out_dir.mkdir(exist_ok=True)

per_sheet = 20
thumb_w = 320
gutter = 28
cols = 4
for batch_index in range(math.ceil(len(files) / per_sheet)):
    batch = files[batch_index * per_sheet : (batch_index + 1) * per_sheet]
    thumbs = []
    for file in batch:
        with Image.open(file) as img:
            ratio = thumb_w / img.width
            thumb = img.convert("RGB").resize((thumb_w, round(img.height * ratio)))
            thumbs.append((file, thumb))
    thumb_h = max(img.height for _, img in thumbs)
    rows = math.ceil(len(thumbs) / cols)
    canvas = Image.new("RGB", (cols * (thumb_w + gutter) + gutter, rows * (thumb_h + gutter + 20) + gutter), "#d9dde3")
    draw = ImageDraw.Draw(canvas)
    for i, (file, thumb) in enumerate(thumbs):
        row, col = divmod(i, cols)
        x = gutter + col * (thumb_w + gutter)
        y = gutter + row * (thumb_h + gutter + 20)
        canvas.paste(thumb, (x, y))
        draw.text((x, y + thumb.height + 3), file.stem, fill="black")
    out = out_dir / f"{prefix}-{batch_index + 1:02d}.jpg"
    canvas.save(out, quality=88, optimize=True)
    print(out)
