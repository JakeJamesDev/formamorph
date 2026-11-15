"""Writes src/lib/coref/spacyEnTokenizer.json: the en_core_web_sm tokenizer's affix patterns and special cases,
which the coref host's word tokenizer replays. Run with the training kit's Python env:
  python scripts/coref/dump_spacy_tokenizer.py
"""
import json, os
import spacy
from spacy.symbols import ORTH
from spacy.tokenizer import Tokenizer

nlp = spacy.load('en_core_web_sm', exclude=['tagger', 'parser', 'lemmatizer', 'ner', 'textcat'])
t = nlp.tokenizer
pattern = lambda f: f.__self__.pattern if f is not None else None
bare = Tokenizer(nlp.vocab, rules={}, prefix_search=t.prefix_search, suffix_search=t.suffix_search,
                 infix_finditer=t.infix_finditer, token_match=t.token_match, url_match=t.url_match)
rules = {k: [s[ORTH] for s in v] for k, v in sorted(t.rules.items())}
# Special cases the tokenizer also matches across tokens, keyed to their affix-only tokenization.
matcher = {k: [tok.text for tok in bare(k)] for k in rules
           if t.find_prefix(k) or t.find_infix(k) or t.find_suffix(k) or ' ' in k}
out = {
    'source': f"spaCy {spacy.__version__}, {nlp.meta['name']} {nlp.meta['version']} (MIT License, Explosion AI)",
    'prefix': pattern(t.prefix_search), 'suffix': pattern(t.suffix_search), 'infix': pattern(t.infix_finditer),
    'urlMatch': pattern(t.url_match), 'rules': rules, 'matcher': matcher,
}
assert t.token_match is None and t.faster_heuristics
path = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'lib', 'coref', 'spacyEnTokenizer.json')
with open(path, 'w', encoding='utf8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=0)
print(path, len(rules), 'rules', len(matcher), 'matcher')
