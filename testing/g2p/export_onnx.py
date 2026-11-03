"""Export a trained model to half-precision ONNX, and compare ONNX with PyTorch over the frozen word sets.

Usage: python export_onnx.py <model dir> <onnx out dir> <predictions out dir>
The comparison also writes word-to-phoneme JSON that scoreCli.mjs reads with --predictions.
"""
import gzip, json, os, sys
import numpy as np, onnx, onnxruntime as ort, torch
from onnx import TensorProto, helper, numpy_helper
from strip_onnx import strip_model
from transformers import BartForConditionalGeneration

model_dir, onnx_dir, pred_dir = sys.argv[1:4]
here = os.path.dirname(os.path.abspath(__file__))
vocab = json.load(open(os.path.join(model_dir, 'vocab.json'), encoding='utf8'))
PAD, BOS, EOS, UNK = vocab['pad'], vocab['bos'], vocab['eos'], vocab['unk']
g2t = {c: i + 4 for i, c in enumerate(vocab['graphemes'])}
t2p = {i + 4: c for i, c in enumerate(vocab['phonemes'])}
MAX_LEN = 48

model = BartForConditionalGeneration.from_pretrained(model_dir, attn_implementation='eager').eval().cpu()

class Encoder(torch.nn.Module):
    def __init__(self, m):
        super().__init__(); self.m = m.get_encoder()
    def forward(self, input_ids, attention_mask):
        return self.m(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state

class Decoder(torch.nn.Module):
    def __init__(self, m):
        super().__init__(); self.d = m.get_decoder(); self.h = m.lm_head; self.b = m.final_logits_bias
    def forward(self, decoder_input_ids, encoder_hidden_states, encoder_attention_mask):
        out = self.d(input_ids=decoder_input_ids, encoder_hidden_states=encoder_hidden_states,
                     encoder_attention_mask=encoder_attention_mask, use_cache=False).last_hidden_state
        return self.h(out) + self.b

def export(net, args, names, output, path):
    tmp = path + '.fp32'
    # The tracing exporter bakes the decoder's mask length into the graph, so it stays off here.
    shapes = tuple({i: torch.export.Dim.AUTO for i in range(a.dim())} for a in args)
    torch.onnx.export(net, args, tmp, input_names=names, output_names=[output], opset_version=18, dynamo=True,
                      dynamic_shapes=shapes, external_data=False, optimize=True)
    onnx.save(strip_model(store_half(onnx.load(tmp))), path)
    os.remove(tmp)

def store_half(graph_model):
    """Stores float weights at half precision behind a Cast, so the graph still computes in float32 on any runtime."""
    graph = graph_model.graph
    casts, seen, renames = [], {}, {}
    weights = list(graph.initializer)
    del graph.initializer[:]
    for w in weights:
        data = numpy_helper.to_array(w)
        # Small tensors are graph constants, such as mask fill values that half precision would overflow.
        half = w.data_type == TensorProto.FLOAT and data.size > 16
        if half: data = data.astype(np.float16)
        key = (data.dtype.str, data.shape, data.tobytes())
        if key in seen:
            renames[w.name] = seen[key]
            continue
        stored = w.name + '.fp16' if half else w.name
        graph.initializer.append(numpy_helper.from_array(data, stored))
        if half: casts.append(helper.make_node('Cast', [stored], [w.name], to=TensorProto.FLOAT))
        seen[key] = w.name
    for node in graph.node:
        for i, name in enumerate(node.input):
            if name in renames: node.input[i] = renames[name]
    nodes = casts + list(graph.node)
    del graph.node[:]
    graph.node.extend(nodes)
    return graph_model

os.makedirs(onnx_dir, exist_ok=True); os.makedirs(pred_dir, exist_ok=True)
enc_path, dec_path = os.path.join(onnx_dir, 'encoder.fp16.onnx'), os.path.join(onnx_dir, 'decoder.fp16.onnx')
x = torch.tensor([[BOS, 5, 6, 7, EOS]]); m = torch.ones_like(x); y = torch.tensor([[BOS, 5, 6]])
with torch.no_grad():
    h = Encoder(model)(x, m)
    export(Encoder(model), (x, m), ['input_ids', 'attention_mask'], 'last_hidden_state', enc_path)
    export(Decoder(model), (y, h, m), ['decoder_input_ids', 'encoder_hidden_states', 'encoder_attention_mask'], 'logits', dec_path)
json.dump({k: vocab[k] for k in ('graphemes', 'phonemes', 'pad', 'bos', 'eos', 'unk', 'cmudict', 'seed')},
          open(os.path.join(onnx_dir, 'vocab.json'), 'w', encoding='utf8', newline='\n'), ensure_ascii=False, indent=1)

def ids(w): return [BOS] + [g2t.get(c, UNK) for c in w] + [EOS]
def text(row):
    s = []
    for t in row:
        if t == EOS: break
        if t > 3: s.append(t2p.get(t, ''))
    return ''.join(s)

def torch_gen(net, words):
    out = []
    with torch.no_grad():
        for i in range(0, len(words), 512):
            chunk = [ids(w) for w in words[i:i + 512]]
            n = max(map(len, chunk))
            b = torch.tensor([r + [PAD] * (n - len(r)) for r in chunk])
            res = net.generate(input_ids=b, attention_mask=(b != PAD).long(), max_length=MAX_LEN, num_beams=1, do_sample=False)
            out += [text(r[1:]) for r in res.tolist()]
    return out

enc_s = ort.InferenceSession(enc_path, providers=['CPUExecutionProvider'])
dec_s = ort.InferenceSession(dec_path, providers=['CPUExecutionProvider'])
def onnx_gen(w):
    a = torch.tensor([ids(w)]).numpy(); mask = (a != PAD).astype(a.dtype)
    h = enc_s.run(None, {'input_ids': a, 'attention_mask': mask})[0]
    row = [BOS]
    while len(row) < MAX_LEN:
        logits = dec_s.run(None, {'decoder_input_ids': torch.tensor([row]).numpy(), 'encoder_hidden_states': h, 'encoder_attention_mask': mask})[0]
        t = int(logits[0, -1].argmax())
        row.append(t)
        if t == EOS: break
    return text(row[1:])

sets = {name: json.load(open(os.path.join(here, 'sets', f'{name}.json'), encoding='utf8')) for name in ('unknown', 'known', 'strange', 'fantasy')}
words = {}
for name, data in sets.items():
    words[name] = sorted({w.lower().replace('’', "'") for w in (data if isinstance(data, list) else data.keys())})
everything = sorted({w for v in words.values() for w in v})

pt32 = dict(zip(everything, torch_gen(model, everything)))
pt16 = dict(zip(everything, torch_gen(model.half(), everything)))
ox = {w: onnx_gen(w) for w in everything}
json.dump(pt32, open(os.path.join(pred_dir, 'pytorch-fp32.json'), 'w', encoding='utf8'), ensure_ascii=False)
json.dump(pt16, open(os.path.join(pred_dir, 'pytorch-fp16.json'), 'w', encoding='utf8'), ensure_ascii=False)
json.dump(ox, open(os.path.join(pred_dir, 'onnx-fp16.json'), 'w', encoding='utf8'), ensure_ascii=False)

for name, group in {**words, 'all': everything}.items():
    print(f'{name}: {len(group)} words; ONNX fp16 differs from PyTorch fp32 on {sum(ox[w] != pt32[w] for w in group)}, from PyTorch fp16 on {sum(ox[w] != pt16[w] for w in group)}')
total = gz = 0
for p in (enc_path, dec_path):
    raw = open(p, 'rb').read()
    total += len(raw); gz += len(gzip.compress(raw, 9))
    print(os.path.basename(p), len(raw), 'gzip', len(gzip.compress(raw, 9)))
print('total', total, 'gzip', gz)
