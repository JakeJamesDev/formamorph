# Cuts every leaf layer of the mascot's layered file into one canvas-sized WebP.
# GIMP 3.x python-fu; run it through scripts/cutMascotRig.mjs, which sets SRC and OUT.
import gi
gi.require_version('Gimp', '3.0')
from gi.repository import Gimp, Gio

# Layer path in the file -> asset name. Explicit, because ':O' and ':o' collide on a case-insensitive disk.
NAMES = {
    'Base': 'base',
    'Blush': 'blush',
    'Right Closed': 'right-closed',
    'Left Closed': 'left-closed',
    'Eyebrows/Raised': 'eyebrows-raised',
    'Eyebrows/Furrowed': 'eyebrows-furrowed',
    'Eyes/Heart': 'eyes-heart',
    'Eyes/Lidded': 'eyes-lidded',
    'Eyes/Crying': 'eyes-crying',
    'Eyes/Tiny': 'eyes-tiny',
    'Eyes/Wide': 'eyes-wide',
    'Eyes/Shocked': 'eyes-shocked',
    'Eyes/Closed': 'eyes-closed',
    'Eyes/Looking Up': 'eyes-looking-up',
    'Eyes/Dizzy': 'eyes-dizzy',
    'Eyes/Blank': 'eyes-blank',
    'Arms/Thinking': 'arms-thinking',
    'Arms/No Thinking': 'arms-no-thinking',
    'Arms/Wave': 'arms-wave',
    'Arms/No Wave': 'arms-no-wave',
    'Mouth/Wiggly': 'mouth-wiggly',
    'Mouth/o~o': 'mouth-cat',
    'Mouth/:D': 'mouth-grin',
    'Mouth/:O': 'mouth-open',
    'Mouth/:o': 'mouth-small-o',
    'Mouth/Frown': 'mouth-frown',
}


def leaves(items, prefix):
    for item in items:
        path = prefix + item.get_name()
        # The cut copies pixels alone, so a layer or group that blends any other way would not match the art.
        if item.get_opacity() != 100.0 or item.get_mode() != Gimp.LayerMode.NORMAL:
            raise RuntimeError(f'{path} is not at 100% opacity in Normal mode.')
        if item.is_group():
            yield from leaves(item.get_children(), path + '/')
        else:
            yield path, item


def export_webp(image, path):
    proc = Gimp.get_pdb().lookup_procedure('file-webp-export')
    config = proc.create_config()
    config.set_property('run-mode', Gimp.RunMode.NONINTERACTIVE)
    config.set_property('image', image)
    config.set_property('file', Gio.File.new_for_path(path))
    config.set_property('lossless', True)
    config.set_property('include-exif', False)
    config.set_property('include-iptc', False)
    config.set_property('include-xmp', False)
    config.set_property('include-color-profile', False)
    config.set_property('include-thumbnail', False)
    result = proc.run(config)
    if result.index(0) != Gimp.PDBStatusType.SUCCESS:
        raise RuntimeError(f'Export failed: {path}')


def cut(src, out):
    source = Gimp.file_load(Gimp.RunMode.NONINTERACTIVE, Gio.File.new_for_path(src))
    width, height = source.get_width(), source.get_height()
    found = dict(leaves(source.get_layers(), ''))
    unnamed = sorted(set(found) - set(NAMES))
    missing = sorted(set(NAMES) - set(found))
    if unnamed or missing:
        raise RuntimeError(f'Layer table out of date. Not in the table: {unnamed}. Not in the file: {missing}.')
    for path, layer in found.items():
        image = Gimp.Image.new(width, height, Gimp.ImageBaseType.RGB)
        copy = Gimp.Layer.new_from_drawable(layer, image)
        image.insert_layer(copy, None, 0)
        _, x, y = layer.get_offsets()
        copy.set_offsets(x, y)
        copy.set_visible(True)
        copy.set_opacity(100.0)
        if not copy.has_alpha():
            copy.add_alpha()
        copy.resize_to_image_size()
        export_webp(image, f'{out}/{NAMES[path]}.webp')
        image.delete()
    source.delete()


cut(SRC, OUT)  # noqa: F821  (set by the runner)
