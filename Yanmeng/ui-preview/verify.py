import glob
from PIL import Image
for f in glob.glob(r'D:\help\Yanmeng\ui-preview\*.png'):
    im = Image.open(f).convert('RGB')
    colors = im.getcolors(maxcolors=200000)
    n = len(colors) if colors else -1
    green = sum(c for c, (r, g, b) in colors if g > 150 and r < 90 and b < 110) if colors else 0
    white = sum(c for c, (r, g, b) in colors if r > 245 and g > 245 and b > 245) if colors else 0
    print(f.split('\\')[-1], 'size', im.size, 'colors', n, 'green_px', green, 'white_px', white)
