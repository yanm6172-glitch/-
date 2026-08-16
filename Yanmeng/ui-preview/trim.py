import glob, os
from PIL import Image

BG = (244, 247, 245)

for f in glob.glob(r'D:\help\Yanmeng\ui-preview\*.png'):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    px = im.load()
    bottom = h
    for y in range(h - 1, -1, -1):
        has = False
        for x in range(0, w, 4):
            if px[x, y] != BG:
                has = True
                break
        if has:
            bottom = y
            break
    crop_h = min(h, bottom + 30)
    im2 = im.crop((0, 0, w, crop_h))
    im2.save(f)
    print(os.path.basename(f), im2.size)
