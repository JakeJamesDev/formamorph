"""Corpus conversion tests. Run with the kit's venv: python -m unittest testing/coref/test_corpus.py"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spacy  # noqa: E402

from corpus import read_annotations, to_tokens  # noqa: E402
from seed_label import merge  # noqa: E402

NLP = spacy.load('en_core_web_sm', exclude=['tagger', 'parser', 'lemmatizer', 'ner', 'textcat'])


class ToTokens(unittest.TestCase):
    def test_converts_character_spans_to_word_spans(self):
        doc, skipped = to_tokens({'id': 'p1', 'text': 'Mira nodded. She drew a brass key.', 'clusters': [[[0, 4], [13, 16]]]}, NLP)
        self.assertEqual(skipped, [])
        self.assertEqual(doc['clusters'], [[[0, 0], [3, 3]]])
        self.assertEqual(doc['tokens'][3], 'She')

    def test_skips_and_reports_a_span_off_word_boundaries_and_keeps_the_rest(self):
        text = 'Mira nodded. She drew a brass key. Then she left.'
        doc, skipped = to_tokens({'id': 'p2', 'text': text, 'clusters': [[[0, 4], [13, 15], [40, 43]], [[0, 2], [24, 29]]]}, NLP)
        self.assertEqual(skipped, ["p2: [13, 15) 'Sh'", "p2: [0, 2) 'Mi'"])
        # The first cluster keeps its two good mentions; the second drops to one mention and is not a cluster.
        self.assertEqual(doc['clusters'], [[[0, 0], [10, 10]]])


class ReadAnnotations(unittest.TestCase):
    def test_leaves_out_passages_not_yet_reviewed(self):
        lines = [{'id': 'a', 'text': 'x', 'clusters': [], 'reviewed': True},
                 {'id': 'b', 'text': 'x', 'clusters': [], 'reviewed': False},
                 {'id': 'c', 'text': 'x', 'clusters': []}]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'seed.jsonl')
            with open(path, 'w', encoding='utf8') as f:
                f.write('\n'.join(json.dumps(x) for x in lines))
            docs, unreviewed = read_annotations(path)
        self.assertEqual([x['id'] for x in docs], ['a', 'c'])
        self.assertEqual(unreviewed, 1)


class SeedMerge(unittest.TestCase):
    def test_adds_new_passages_unreviewed_and_keeps_existing_labels(self):
        existing = [{'id': 'seed-1', 'text': 'Mira left.', 'clusters': [[[0, 4], [5, 9]]], 'reviewed': True}]
        played = [{'id': 'seed-1', 'text': 'Mira left.', 'source': {}},
                  {'id': 'seed-2', 'text': 'Ola sat. She ate.', 'source': {'world': 'slime', 'turn': 2}},
                  {'id': 'seed-3', 'text': '  ', 'source': {}}]
        passages, added = merge(existing, played, lambda text: [[[0, 3], [9, 12]]], {'checkpoint': 'e120'})
        self.assertEqual(passages[0], existing[0])
        self.assertEqual([d['id'] for d in added], ['seed-2'])
        self.assertEqual(added[0], {'id': 'seed-2', 'text': 'Ola sat. She ate.', 'clusters': [[[0, 3], [9, 12]]],
                                    'source': {'world': 'slime', 'turn': 2}, 'reviewed': False,
                                    'labeledBy': {'checkpoint': 'e120'}})


if __name__ == '__main__':
    unittest.main()
