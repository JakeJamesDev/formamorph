"""Scores a model on the dev sets and the gold sets, and writes a scores file the manifest step reads.

  python testing/coref/score.py --checkpoint <dir> --out <scores.json>                 # PyTorch
  python testing/coref/score.py --checkpoint <dir> --export <dir> --out <scores.json>  # the shipped ONNX graphs

With --export, graphs A and B run on onnxruntime CPU through a replica of the browser host's steps; the
checkpoint supplies only the tokenizer and the pruning code. Dev sets: LitBank dev and, when the corpus has it,
narration dev (CoNLL F1). Gold sets: cluster-only scores; the Mention Reading score lives in the app's tests.
"""
import argparse
import json
import os
import re
import sys
import time

import kit

DEV_SETS = {'litbank-dev': 'litbank.dev.jsonlines', 'narration-dev': 'narration.dev.jsonlines'}
GOLD_SETS = ('real', 'hard', 'blind', 'quotes')
NEGATIVE = ('NONE', 'OTHER')
PRONOUN = re.compile(r'^(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves|it|its|itself)$', re.I)


def kind(text):
    if PRONOUN.match(text):
        return 'pronoun'
    return 'name' if text[0].isupper() and ' ' not in text else 'descriptor'


def find(clusters, g):
    """The predicted mention for a gold mention: the smallest one containing it, else the smallest overlapping one."""
    best = None
    for ci, c in enumerate(clusters):
        for s, f in c:
            if s <= g['start'] and g['end'] <= f:
                rank = (0, f - s)
            elif s < g['end'] and g['start'] < f:
                rank = (1, f - s)
            else:
                continue
            if best is None or rank < best[0]:
                best = (rank, ci)
    return None if best is None else best[1]


def gold_scores(passages, predicted):
    """Cluster-only scores against gold mentions, with no naming step (the README defines each score)."""
    r = {'links': {'tp': 0, 'fp': 0, 'fn': 0}, 'kinds': {}, 'negatives': {'ok': 0, 'n': 0}}
    for p in passages:
        clusters = predicted.get(p['id'], [])
        where = [(g, find(clusters, g)) for g in p['mentions']]
        chars = [(g, c) for g, c in where if g['entity'] not in NEGATIVE]
        for i, (g, c) in enumerate(chars):
            for h, d in chars[i + 1:]:
                same, linked = g['entity'] == h['entity'], c is not None and c == d
                key = 'tp' if same and linked else 'fn' if same else 'fp' if linked else None
                if key:
                    r['links'][key] += 1
            others = [h['entity'] for h, d in chars if h is not g and c is not None and d == c]
            k = r['kinds'].setdefault(kind(g['text']), {'ok': 0, 'wrong': 0, 'n': 0})
            k['n'] += 1
            k['ok'] += g['entity'] in others
            k['wrong'] += bool(others) and g['entity'] not in others
        for g, c in where:
            if g['entity'] in NEGATIVE:
                r['negatives']['n'] += 1
                r['negatives']['ok'] += c is None or not any(d == c for _, d in chars)
    t = r['links']
    prec = t['tp'] / (t['tp'] + t['fp']) if t['tp'] + t['fp'] else 0.0
    rec = t['tp'] / (t['tp'] + t['fn']) if t['tp'] + t['fn'] else 0.0
    t['f1'] = round(2 * prec * rec / (prec + rec), 4) if prec + rec else 0.0
    return r


def load_gold(name):
    path = os.path.join(kit.GOLD, f'{name}.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf8') as f:
        return json.load(f)['passages']


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--export', help='score this export folder\'s int8 graphs instead of the PyTorch weights')
    p.add_argument('--fp32', action='store_true', help='with --export: the fp32 reference graphs')
    p.add_argument('--out', required=True)
    p.add_argument('--device', default='cpu')
    p.add_argument('--preds', metavar='TAG', help='also write the gold-passage clusters to <data repo>/coref/gold/preds/TAG.json')
    a = p.parse_args()

    arch = kit.arch_of(a.checkpoint)
    wrapper = kit.load_wrapper(arch, a.checkpoint, 'cpu' if a.export else a.device)
    if a.export:
        with open(os.path.join(a.export, 'host-config.json'), encoding='utf8') as f:
            cfg = json.load(f)
        if cfg['architecture'] != arch:
            sys.exit(f"{a.export} holds a {cfg['architecture']} export; the checkpoint is {arch}.")
        kit.use_onnx(wrapper, arch, *kit.onnx_sessions(a.export, a.fp32))
    source = {'arch': arch, 'checkpoint': os.path.abspath(a.checkpoint)}
    if a.export:
        source['export'] = os.path.abspath(a.export) + ('/fp32' if a.fp32 else '')
    out = {'model': source, 'dev': {}, 'gold': {}}

    for name, file in DEV_SETS.items():
        path = os.path.join(kit.CORPUS, file)
        if not os.path.exists(path):
            if name == 'litbank-dev':
                sys.exit(f'{path} is missing. Build the corpus first: python testing/coref/corpus.py')
            continue
        t = time.perf_counter()
        f1 = kit.conll_f1(wrapper.model, wrapper.collator, kit.corpus_dataset(path, wrapper.tokenizer), arch)
        out['dev'][name] = {'f1': round(f1, 4), 'sha256': kit.sha256(path)}
        print(f'{name}: CoNLL F1 {f1:.4f} ({time.perf_counter() - t:.0f}s)', flush=True)

    for name in GOLD_SETS:
        passages = load_gold(name)
        if passages is None:
            print(f'gold {name}: missing from {kit.GOLD}, skipped')
            continue
        preds = [wrapper.predict(texts=[x['text']])[0] for x in passages]  # one at a time, as the host runs
        clusters = {x['id']: [[list(s) for s in c if s is not None] for c in pr.get_clusters(as_strings=False)]
                    for x, pr in zip(passages, preds)}
        if not any(x.get('mentions') for x in passages):  # the quote-speaker set: clusters only, scored by the app
            out['gold'][name] = {'clusters': clusters}
            print(f'gold {name}: clusters only')
            continue
        r = gold_scores(passages, clusters)
        r['clusters'] = clusters
        out['gold'][name] = r
        kinds = ', '.join(f"{k} {v['ok']}/{v['n']}" + (f" ({v['wrong']} wrong)" if v['wrong'] else '') for k, v in sorted(r['kinds'].items()))
        print(f"gold {name}: link F1 {r['links']['f1']:.4f}; {kinds}; negatives {r['negatives']['ok']}/{r['negatives']['n']}")

    if a.preds:
        path = os.path.join(kit.GOLD, 'preds', f'{a.preds}.json')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        flat = {f'{s}:{pid}': c for s, r in out['gold'].items() for pid, c in r['clusters'].items()}
        with open(path, 'w', encoding='utf8', newline='\n') as f:
            json.dump({'model': a.preds, 'clusters': flat}, f, ensure_ascii=False)
        print('wrote', path)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('wrote', a.out)


if __name__ == '__main__':
    main()
