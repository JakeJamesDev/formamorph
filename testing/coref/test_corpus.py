"""Corpus conversion tests. Run with the kit's venv: python -m unittest testing/coref/test_corpus.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spacy  # noqa: E402

from corpus import to_tokens  # noqa: E402

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


if __name__ == '__main__':
    unittest.main()
