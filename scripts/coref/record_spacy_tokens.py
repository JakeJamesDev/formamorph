"""Records en_core_web_sm's tokens for synthetic edge cases into src/lib/coref/__fixtures__/spacyTokens.json,
for the word tokenizer's test. Run with the training kit's env: python scripts/coref/record_spacy_tokens.py"""
import json, os
import spacy

nlp = spacy.load('en_core_web_sm', exclude=['tagger', 'parser', 'lemmatizer', 'ner', 'textcat'])
CASES = [
    "I'm sure she didn't. We'll see, won't we? They're gone; it's over.",
    'The half-elf—tired—sighs… "Fine," he says.',
    '“Don’t,” she whispers. ‘Maybe’ isn’t an answer.',
    "frightened o' breakin' 'em?”",
    'Mr. Holloway paid $3.50 at 5 p.m. on the 3rd (or so).',
    'Two  spaces,\n\n\nthree newlines,\ttab, and a trailing space ',
    'She asked: "Why?"—then left. Visit https://example.com/path?x=1 or mail a@b.co.',
    "The wolves' den, the wolf's pup, rock'n'roll and ma'am.",
    'Ser Gideon\'s sword-arm; 10-12 men; 4x4; C$20; e.g. this, i.e. that.',
    ' Non-breaking space and café naïve \U0001F600 emoji.',
]


def u16(text):
    m, n = [], 0
    for ch in text:
        m.append(n); n += 2 if ord(ch) > 0xFFFF else 1
    m.append(n)
    return m


out = []
for text in CASES:
    m = u16(text)
    out.append({'text': text, 'tokens': [[m[t.idx], m[t.idx + len(t.text)]] for t in nlp(text)]})
path = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'lib', 'coref', '__fixtures__', 'spacyTokens.json')
with open(path, 'w', encoding='utf8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(len(out), 'cases')
