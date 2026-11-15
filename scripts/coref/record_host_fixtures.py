"""Records the Python reference run (fastcoref host code) over src/lib/coref/__fixtures__/passages.json, for the
coref host test: the graph outputs the host reads, the pruned spans, and the clusters. Run with the training kit's env:
  python scripts/coref/record_host_fixtures.py <e120 model dir> <big graph_a.onnx> <big graph_b.onnx>

Big: the LitBank e120 checkpoint through its two ONNX graphs on CPU, as the evaluation ran it.
Small: the FCoref host path (segments, pruning, clustering) over seeded random scores, with the model's weights wiped,
so the fixture holds no OntoNotes-trained numbers. Its clusters are noise; the test checks host parity, not quality.
"""
import json, os, sys
import numpy as np, torch, transformers
_orig = transformers.PreTrainedModel.from_pretrained.__func__
transformers.PreTrainedModel.from_pretrained = classmethod(lambda cls, *a, **k: _orig(cls, *a, **{'attn_implementation': 'eager', **k}))
from fastcoref import LingMessCoref, FCoref
from fastcoref.utilities.util import mask_tensor
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, '..', '..', 'src', 'lib', 'coref', '__fixtures__')
ckpt, graph_a, graph_b = sys.argv[1:4]
passages = json.load(open(os.path.join(FIX, 'passages.json'), encoding='utf8'))['passages']
texts = [p['text'] for p in passages]


def u16(text):
    m, n = [], 0
    for ch in text:
        m.append(n); n += 2 if ord(ch) > 0xFFFF else 1
    m.append(n)
    return m


def band(ml, span):
    """mention_logits [S, S] -> the entries a span can take (j - i < span), row-major."""
    S = ml.shape[0]
    return np.concatenate([ml[i, i:min(S, i + span)] for i in range(S)]).astype(np.float32)


def record(tag, wrapper, model, capture, ids):
    chosen = [p for p in passages if p['id'] in ids]
    preds = [wrapper.predict(texts=p['text']) for p in chosen]  # one passage per run, as the host runs
    out = []
    for p, pred, cap in zip(chosen, preds, capture):
        m = u16(p['text'])
        clusters = [[[m[s], m[e]] for s, e in c if s is not None] for c in pred.get_clusters(as_strings=False)]
        S = cap['mention_logits'].shape[-1]
        k = cap['starts'].shape[-1]
        # torch.topk leaves tie order unspecified, so a tie at the cut has no reference answer.
        ranked = np.sort(band(cap['mention_logits'][0], model.max_span_length))[::-1]
        assert ranked[k - 1] != ranked[k], f'{tag} {p["id"]}: mention scores tie at the top-k cut'
        blob = np.concatenate([band(cap['mention_logits'][0], model.max_span_length), cap['final_logits'][0].reshape(-1)])
        name = f'{tag}-{p["id"]}.bin'
        blob.astype('<f4').tofile(os.path.join(FIX, name))
        rec = {'id': p['id'], 'seqLength': S, 'k': k, 'logits': name, 'inputIds': cap['input_ids'],
               'starts': cap['starts'][0].tolist(), 'ends': cap['ends'][0].tolist(), 'clusters': clusters}
        # Category label per (mention, antecedent) pair, row-major, one char each: '0'-'5', '.' for no pair.
        if 'categories' in cap: rec['categories'] = ''.join('.' if v < 0 else str(v) for row in cap['categories'] for v in row)
        out.append(rec)
    return out


def tok_ids(batch):
    ids, mask = batch['input_ids'], batch['attention_mask']
    flat = ids.reshape(-1)[mask.reshape(-1) == 1]
    left = batch.get('leftovers', {}).get('input_ids', [])
    if len(left): flat = torch.cat([flat, left.reshape(-1)])
    return flat.tolist()


# Big: LingMess e120 through the ONNX graphs.
big = LingMessCoref(model_name_or_path=ckpt, device='cpu', enable_progress_bar=False)
bm = big.model.eval()
# Optimizations off: onnxruntime's CPU fusions rewrite the weight-only int8 MatMuls into a lossier path that
# onnxruntime-web never takes, so only the unoptimized graph matches what the browser computes.
plain = ort.SessionOptions()
plain.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
A = ort.InferenceSession(graph_a, sess_options=plain, providers=['CPUExecutionProvider'])
B = ort.InferenceSession(graph_b, sess_options=plain, providers=['CPUExecutionProvider'])
cap_big = []


def big_forward(batch, gold_clusters=None, return_all_outputs=False):
    ids, mask = batch['input_ids'], batch['attention_mask']
    assert ids.shape[0] == 1
    pos = torch.where(mask == 1, torch.cumsum(mask, dim=1) + 1, torch.ones_like(mask))
    seq, mlg = A.run(None, {'input_ids': ids.numpy().astype(np.int64), 'attention_mask': mask.numpy().astype(np.int64),
                            'position_ids': pos.numpy().astype(np.int64)})
    ml = torch.from_numpy(mlg)
    starts, ends, span_mask, topk, _ = bm._prune_topk_mentions(ml, mask)
    labels, cat = bm._get_categories_labels(batch['tokens'], batch['subtoken_map'], batch['new_token_map'], starts, ends)
    final, = B.run(None, {'sequence_output': seq, 'starts': starts.numpy().astype(np.int64), 'ends': ends.numpy().astype(np.int64),
                          'span_mask': span_mask.numpy().astype(np.int32), 'topk_mention_logits': topk.numpy(),
                          'categories_masks': cat.numpy().astype(np.int32)})
    cap_big.append({'input_ids': tok_ids(batch), 'mention_logits': mlg, 'starts': starts.numpy(), 'ends': ends.numpy(),
                    'final_logits': final, 'categories': labels[0].numpy().astype(int).tolist()})
    return starts, ends, ml, torch.from_numpy(final)


bm.forward = big_forward
big_rec = record('big', big, bm, cap_big, {'lantern-shop', 'two-sisters', 'odd-spacing'})

# Small: FCoref architecture, random weights, PyTorch forward.
small = FCoref(device='cpu', enable_progress_bar=False)
sm = small.model.eval()
torch.manual_seed(20261114)
with torch.no_grad():
    for p in sm.parameters(): p.normal_(0, 0.2)
cap_small = []


def small_forward(batch, gold_clusters=None, return_all_outputs=False):
    # Random weights score spans and antecedents nearly alike (ties at the top-k cut, one giant cluster), so
    # seeded scores stand in for both graphs' outputs and go through fastcoref's own pruning and clustering.
    _, mask = sm.forward_transformer(batch)
    S = mask.shape[1]
    g = torch.Generator().manual_seed(S)
    raw = torch.randn((1, S, S), generator=g) * 2
    ml = mask_tensor(raw, sm._get_mention_mask(raw))
    starts, ends, _, _ = sm._prune_topk_mentions(ml, mask, None)
    k = starts.shape[1]
    scores = torch.randn((1, k, k), generator=g) * 3 - 4
    scores = sm._mask_antecedent_logits(scores, torch.ones((1, k), dtype=torch.int32))
    final = torch.cat((scores, torch.zeros((1, k, 1))), dim=-1)
    cap_small.append({'input_ids': tok_ids(batch), 'mention_logits': ml.numpy(), 'starts': starts.numpy(), 'ends': ends.numpy(),
                      'final_logits': final.numpy()})
    return starts, ends, ml, final


sm.forward = small_forward
small_rec = record('small', small, sm, cap_small, {p['id'] for p in passages})


def head(m, arch):
    return {'architecture': arch, 'topLambda': m.top_lambda, 'maxSpanLength': m.max_span_length,
            'maxSegmentLen': m.config.coref_head['max_segment_len'], 'maxDocLen': m.config.coref_head.get('max_doc_len')}


json.dump({'big': {'config': head(bm, 'lingmess'), 'passages': big_rec},
           'small': {'config': head(sm, 'fcoref'), 'passages': small_rec}},
          open(os.path.join(FIX, 'reference.json'), 'w', encoding='utf8', newline='\n'))
for tag, rec in (('big', big_rec), ('small', small_rec)):
    for r in rec: print(tag, r['id'], 'S', r['seqLength'], 'k', r['k'], 'clusters', len(r['clusters']))
