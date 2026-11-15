"""Pre-labels seed-play passages with a model and adds them to the seed set in the annotation format.

  python testing/coref/seed_label.py --checkpoint <dir> [--export <dir>] <play.jsonl> [<play.jsonl> …]

Each new passage gets the model's clusters and "reviewed": false. Passages already in the seed file keep their
labels, so a later batch never overwrites a correction. With --export, the int8 graphs label (what the app runs).
"""
import argparse
import json
import os
import sys

import kit

SEED = os.path.join(kit.DATA, 'coref', 'seed', 'dev.jsonl')


def merge(existing, played, label, labeled_by):
    """The seed file's passages, then each played passage not in it yet, labeled. Returns (passages, added)."""
    have = {d['id'] for d in existing}
    added = []
    for p in played:
        if p['id'] in have or not p['text'].strip():
            continue
        have.add(p['id'])
        added.append({'id': p['id'], 'text': p['text'], 'clusters': label(p['text']),
                      'source': p.get('source', {}), 'reviewed': False, 'labeledBy': labeled_by})
    return existing + added, added


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--export', help='label with this export folder\'s int8 graphs instead of the PyTorch weights')
    p.add_argument('--out', default=SEED, help=f'the seed file (default {SEED})')
    p.add_argument('play', nargs='+', help='seed-play output files')
    a = p.parse_args()

    arch = kit.arch_of(a.checkpoint)
    wrapper = kit.load_wrapper(arch, a.checkpoint)
    model = {'checkpoint': os.path.basename(os.path.dirname(os.path.abspath(a.checkpoint)))}
    if a.export:
        with open(os.path.join(a.export, 'host-config.json'), encoding='utf8') as f:
            if json.load(f)['architecture'] != arch:
                sys.exit(f'{a.export} is not an export of a {arch} checkpoint.')
        kit.use_onnx(wrapper, arch, *kit.onnx_sessions(a.export))
        model['export'] = os.path.basename(os.path.abspath(a.export))

    def label(text):
        clusters = wrapper.predict(texts=[text])[0].get_clusters(as_strings=False)
        return [[list(s) for s in c] for c in clusters]

    existing = kit.read_jsonlines(a.out) if os.path.exists(a.out) else []
    played = [d for path in a.play for d in kit.read_jsonlines(path)]
    passages, added = merge(existing, played, label, model)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf8', newline='\n') as f:
        for d in passages:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(f'{a.out}: {len(added)} passages added, {len(passages)} in all, '
          f'{sum(1 for d in passages if d.get("reviewed") is False)} not reviewed')


if __name__ == '__main__':
    main()
