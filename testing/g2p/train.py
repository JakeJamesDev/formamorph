"""Train the grapheme-to-phoneme model on the pairs from writePairs.ts, and nothing else.

Usage: python train.py <pairs.json> <out dir> [--epochs 200]
Full runs need a GPU and about 70 minutes. Runs repeat the data split and seed, not the exact bytes.
"""
import argparse, json, math, os, random, time
import torch
from transformers import BartConfig, BartForConditionalGeneration

ap = argparse.ArgumentParser()
ap.add_argument('pairs')
ap.add_argument('out')
ap.add_argument('--epochs', type=int, default=200)
args = ap.parse_args()

src = json.load(open(args.pairs, encoding='utf8'))
random.seed(src['seed']); torch.manual_seed(src['seed'])
dev = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Q9 sets the width, layers, heads, and dropout.
D_MODEL, FFN, LAYERS, HEADS, DROPOUT, ATTN_DROPOUT = 256, 1024, 2, 4, 0.3, 0.1
BATCH, LR, VAL, MAX_LEN = 256, 1e-3, 3000, 48
PAD, BOS, EOS, UNK = 0, 1, 2, 3

pairs = [tuple(p) for p in src['pairs']]
random.shuffle(pairs)
val, train = pairs[:VAL], pairs[VAL:]
G = sorted({c for w, _ in pairs for c in w})
P = sorted({c for _, p in pairs for c in p})
g2t = {c: i + 4 for i, c in enumerate(G)}
p2t = {c: i + 4 for i, c in enumerate(P)}
t2p = {i + 4: c for i, c in enumerate(P)}
print(f'{dev} train {len(train)} val {len(val)} graphemes {len(G)} phonemes {len(P)}', flush=True)

cfg = BartConfig(vocab_size=4 + max(len(G), len(P)), d_model=D_MODEL, encoder_ffn_dim=FFN, decoder_ffn_dim=FFN,
                 encoder_layers=LAYERS, decoder_layers=LAYERS, encoder_attention_heads=HEADS, decoder_attention_heads=HEADS,
                 decoder_start_token_id=BOS, max_position_embeddings=64, bos_token_id=BOS, eos_token_id=EOS, pad_token_id=PAD,
                 forced_eos_token_id=None, max_length=MAX_LEN, num_beams=1, dropout=DROPOUT,
                 attention_dropout=ATTN_DROPOUT, activation_dropout=ATTN_DROPOUT)
model = BartForConditionalGeneration(cfg).to(dev)
print('params', sum(p.numel() for p in model.parameters()), flush=True)

def enc(w): return [BOS] + [g2t.get(c, UNK) for c in w] + [EOS]
def dec(p): return [BOS] + [p2t[c] for c in p] + [EOS]
def pad(rows):
    n = max(map(len, rows))
    return torch.tensor([r + [PAD] * (n - len(r)) for r in rows], device=dev)
def gen(words):
    out = []
    with torch.no_grad():
        for i in range(0, len(words), 512):
            b = pad([enc(w) for w in words[i:i + 512]])
            ids = model.generate(input_ids=b, attention_mask=(b != PAD).long(), max_length=MAX_LEN, num_beams=1, do_sample=False)
            for row in ids.tolist():
                s = []
                for t in row[1:]:
                    if t == EOS: break
                    if t > 3: s.append(t2p.get(t, ''))
                out.append(''.join(s))
    return out

opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
steps = args.epochs * (len(train) // BATCH)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / 500) * 0.5 * (1 + math.cos(math.pi * min(1, s / steps))))
t0 = time.time(); best = (-1, None)
for ep in range(1, args.epochs + 1):
    random.shuffle(train); model.train(); total = 0
    for i in range(0, len(train) - BATCH + 1, BATCH):
        chunk = train[i:i + BATCH]
        x = pad([enc(w) for w, _ in chunk]); y = pad([dec(p) for _, p in chunk])
        labels = y[:, 1:].clone(); labels[labels == PAD] = -100
        loss = model(input_ids=x, attention_mask=(x != PAD).long(), decoder_input_ids=y[:, :-1], labels=labels).loss
        opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step()
        total += loss.item()
    if ep % 5 == 0 or ep == args.epochs:
        model.eval()
        pr = gen([w for w, _ in val])
        acc = sum(a == p for a, (_, p) in zip(pr, val)) / len(val)
        print(f'epoch {ep}/{args.epochs} loss {total / (len(train) // BATCH):.4f} val_exact {acc:.3f} {time.time() - t0:.0f}s', flush=True)
        if acc > best[0]:
            best = (acc, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()})

model.load_state_dict(best[1])
model.eval()
print(f'best val_exact {best[0]:.3f}', flush=True)
os.makedirs(args.out, exist_ok=True)
model.save_pretrained(args.out)
json.dump({'graphemes': G, 'phonemes': P, 'pad': PAD, 'bos': BOS, 'eos': EOS, 'unk': UNK, 'cmudict': src['cmudict']['commit'], 'seed': src['seed']},
          open(os.path.join(args.out, 'vocab.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('done', flush=True)
