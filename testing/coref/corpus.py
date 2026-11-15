"""Builds the training corpus: LitBank (80/10/10) plus any number of passage files in the annotation format.

  python testing/coref/corpus.py --litbank <litbank checkout> [--add train:<file>] [--add narration-dev:<file>]

Writes <corpus>/train.jsonlines, litbank.dev.jsonlines, litbank.test.jsonlines and, when any narration-dev file
is given, narration.dev.jsonlines. Every output line is token form: {doc_key, tokens, clusters} with clusters as
inclusive word-index spans. Singletons are dropped: inference never outputs them.
"""
import argparse
import glob
import json
import os
import random
import re
import sys

import kit

SPLIT_SEED = 13
TAG = re.compile(r'\((\d+)\)|\((\d+)|(\d+)\)')
TARGETS = ('train', 'narration-dev')


def read_litbank(path):
    tokens, open_spans, spans = [], {}, []
    for line in open(path, encoding='utf8'):
        if line.startswith('#') or not line.strip():
            continue
        cols = line.rstrip('\n').split('\t')
        i = len(tokens)
        tokens.append(cols[3])
        for whole, start, end in TAG.findall(cols[-1]):
            if whole:
                spans.append((int(whole), i, i))
            elif start:
                open_spans.setdefault(int(start), []).append(i)
            else:
                spans.append((int(end), open_spans[int(end)].pop(), i))
    assert not any(open_spans.values()), path
    clusters = {}
    for cid, s, e in spans:
        clusters.setdefault(cid, []).append([s, e])
    return {'doc_key': 'litbank/' + os.path.basename(path)[:-6], 'tokens': tokens,
            'clusters': [sorted(c) for c in clusters.values() if len(c) > 1]}


def litbank_splits(root):
    files = sorted(glob.glob(os.path.join(root, 'coref', 'conll', '*.conll')))
    if len(files) != 100:
        sys.exit(f'Expected the 100 LitBank coref documents under {root}/coref/conll, found {len(files)}.')
    random.Random(SPLIT_SEED).shuffle(files)
    return {'train': files[:80], 'dev': files[80:90], 'test': files[90:]}


def to_tokens(doc, nlp):
    """Annotation format (text + character spans) to token form, with spaCy words as fastcoref tokenizes them.
    Returns the document and the spans skipped for falling off word boundaries."""
    text, sdoc = doc['text'], nlp(doc['text'])
    clusters, skipped = [], []
    for c in doc['clusters']:
        spans = []
        for start, end in c:
            span = sdoc.char_span(start, end)
            if span is None:
                skipped.append(f"{doc['id']}: [{start}, {end}) {text[start:end]!r}")
                continue
            spans.append([span.start, span.end - 1])
        if len(spans) > 1:
            clusters.append(sorted(spans))
    return {'doc_key': doc['id'], 'tokens': [t.text for t in sdoc], 'clusters': clusters}, skipped


def read_annotations(path):
    """The file's passages, without those marked "reviewed": false (pre-labels not yet corrected), and how many were left out."""
    docs = kit.read_jsonlines(path)
    for d in docs:
        missing = {'id', 'text', 'clusters'} - set(d)
        if missing:
            sys.exit(f'{path}: a line lacks {sorted(missing)}.')
    kept = [d for d in docs if d.get('reviewed') is not False]
    return kept, len(docs) - len(kept)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--litbank', required=True, help='a checkout of github.com/dbamman/litbank')
    p.add_argument('--add', action='append', default=[], metavar='TARGET:FILE',
                   help=f'an annotation-format file; TARGET is one of {", ".join(TARGETS)}')
    a = p.parse_args()

    splits = litbank_splits(a.litbank)
    out = {f'litbank.{s}' if s != 'train' else 'train': [read_litbank(f) for f in fs] for s, fs in splits.items()}
    extra = []
    for item in a.add:
        target, _, path = item.partition(':')
        if target not in TARGETS or not path:
            sys.exit(f'--add takes TARGET:FILE with TARGET in {TARGETS}; got {item!r}.')
        extra.append((target, path))
    if extra:
        import spacy
        nlp = spacy.load('en_core_web_sm', exclude=['tagger', 'parser', 'lemmatizer', 'ner', 'textcat'])
        for target, path in extra:
            docs, skipped = [], []
            annotated, unreviewed = read_annotations(path)
            for d in annotated:
                doc, bad = to_tokens(d, nlp)
                docs.append(doc)
                skipped += bad
            out.setdefault('train' if target == 'train' else 'narration.dev', []).extend(docs)
            print(f'{path}: {len(docs)} passages -> {target}' + (f'; {unreviewed} not reviewed, left out' if unreviewed else '')
                  + (f'; skipped {len(skipped)} spans off word boundaries:' if skipped else ''))
            for s in skipped:
                print('  ' + s)
    if not out.get('narration.dev'):
        out.pop('narration.dev', None)  # an empty dev set would score as a set
    keys = [d['doc_key'] for docs in out.values() for d in docs]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        sys.exit(f'Duplicate passage ids across the corpus: {dupes[:5]}')
    for name, docs in out.items():
        kit.write_jsonlines(os.path.join(kit.CORPUS, f'{name}.jsonlines'), docs)
        print(f'{name}: {len(docs)} documents')
    stale = os.path.join(kit.CORPUS, 'narration.dev.jsonlines')
    if 'narration.dev' not in out and os.path.exists(stale):
        os.remove(stale)


if __name__ == '__main__':
    main()
