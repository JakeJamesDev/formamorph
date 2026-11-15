"""Exports a checkpoint to the browser graph contract (see README) and writes the parity case.

  python testing/coref/export.py --checkpoint <dir> --out <dir> [--compare <older export or fp32 dir>]

Writes, in --out: graph_a.onnx and graph_b.onnx (weight-only int8), tokenizer.json, host-config.json (the files
that ship), fp32/graph_{a,b}.onnx (the unquantized reference) and parity/ (a real passage's graph inputs with
onnxruntime CPU outputs of both forms). --compare runs another export of the same checkpoint on the same inputs
and fails above COMPARE_TOLERANCE.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time

import kit
import numpy as np
import onnx
import torch
from onnx import helper, numpy_helper

sys.path.insert(0, os.path.join(kit.KIT, '..', 'g2p'))
from strip_onnx import strip_model  # noqa: E402

QUANT_MIN_SIZE = 1_000_000
COMPARE_TOLERANCE = 1e-4
PARITY_TEXT = os.path.join(kit.KIT, 'parity-passage.txt')


def coref_logits_matmul(self, start_reps, end_reps):
    """LingMess's _calc_coref_logits as plain MatMuls: onnxruntime WebGPU's three-operand Einsum hangs the GPU."""
    s = self.transpose_for_scores(self.coref_start_all_mlps(start_reps))
    e = self.transpose_for_scores(self.coref_end_all_mlps(end_reps))
    bil = lambda x, w, y: torch.matmul(torch.matmul(x, w), y.transpose(-1, -2))
    logits = bil(s, self.antecedent_s2s_all_weights, s) + bil(e, self.antecedent_e2e_all_weights, e) \
        + bil(s, self.antecedent_s2e_all_weights, e) + bil(e, self.antecedent_e2s_all_weights, s)
    bias = lambda x, b: (x * b[None, :, None, :]).sum(-1)
    biases = bias(s, self.antecedent_s2s_all_biases) + bias(e, self.antecedent_e2e_all_biases) \
        + bias(e, self.antecedent_s2e_all_biases) + bias(s, self.antecedent_e2s_all_biases)
    return logits + biases.unsqueeze(-2)


class LMGraphA(torch.nn.Module):
    def __init__(self, m): super().__init__(); self.m = m

    def forward(self, input_ids, attention_mask, position_ids):
        seq = self.m.base_model(input_ids, attention_mask=attention_mask, position_ids=position_ids).last_hidden_state
        return seq, self.m._calc_mention_logits(self.m.start_mention_mlp(seq), self.m.end_mention_mlp(seq))


class LMGraphB(torch.nn.Module):
    def __init__(self, m): super().__init__(); self.m = m

    def forward(self, seq, starts, ends, span_mask, topk_mention_logits, categories_masks):
        size = (starts.shape[0], starts.shape[1], seq.shape[-1])
        s = torch.gather(seq, 1, starts.unsqueeze(-1).expand(size))
        e = torch.gather(seq, 1, ends.unsqueeze(-1).expand(size))
        final = (self.m._calc_coref_logits(s, e) * categories_masks).sum(dim=1) + topk_mention_logits
        final = self.m._mask_antecedent_logits(final, span_mask)
        return torch.cat((final, torch.zeros_like(final[..., :1])), dim=-1)


class FCGraphA(torch.nn.Module):
    """Segments [n, max_segment_len] -> flattened coref reps and mention logits."""
    def __init__(self, m): super().__init__(); self.m = m

    def forward(self, input_ids, attention_mask, position_ids):
        seq = self.m.base_model(input_ids, attention_mask=attention_mask, position_ids=position_ids) \
            .last_hidden_state.reshape(1, -1, self.m.config.hidden_size)
        mlog = self.m._calc_mention_logits(self.m.start_mention_mlp(seq), self.m.end_mention_mlp(seq))
        return self.m.start_coref_mlp(seq), self.m.end_coref_mlp(seq), mlog


class FCGraphB(torch.nn.Module):
    def __init__(self, m): super().__init__(); self.m = m

    def forward(self, start_reps, end_reps, starts, ends, span_mask, topk_mention_logits):
        size = (starts.shape[0], starts.shape[1], start_reps.shape[-1])
        s = torch.gather(start_reps, 1, starts.unsqueeze(-1).expand(size))
        e = torch.gather(end_reps, 1, ends.unsqueeze(-1).expand(size))
        final = self.m._mask_antecedent_logits(topk_mention_logits + self.m._calc_coref_logits(s, e), span_mask)
        return torch.cat((final, torch.zeros_like(final[..., :1])), dim=-1)


def export(mod, args, path, inames, onames, axes):
    with torch.no_grad():
        torch.onnx.export(mod, args, path, dynamo=False, opset_version=17, input_names=inames, output_names=onames, dynamic_axes=axes)
    onnx.save(strip_model(onnx.load(path)), path)


def export_graphs(arch, m, fp32_dir, seg_len):
    """Traces both graphs; the tracing inputs are shapes only, so random ids do."""
    torch.manual_seed(0)
    L, K = 300, 120
    st = torch.sort(torch.randint(0, L, (1, K))).values
    en = torch.clamp(st + torch.randint(0, 4, (1, K)), max=L - 1)
    sm, tl = torch.ones((1, K), dtype=torch.int32), torch.randn(1, K, K)
    a, b = os.path.join(fp32_dir, 'graph_a.onnx'), os.path.join(fp32_dir, 'graph_b.onnx')
    if arch == 'lingmess':
        ids = torch.randint(5, 1000, (1, L))
        mask, pos = torch.ones_like(ids), torch.arange(2, L + 2)[None]
        with torch.no_grad():
            seq, _ = LMGraphA(m)(ids, mask, pos)
            x, y = seq[:, :K], seq[:, K:2 * K]
            ref = m._calc_coref_logits(x, y)
            m._calc_coref_logits = coref_logits_matmul.__get__(m)
            diff = (m._calc_coref_logits(x, y) - ref).abs().max().item()
        print(f'MatMul coref logits vs Einsum: max diff {diff:.2e}')
        cm = torch.ones((1, m.num_cats, K, K), dtype=torch.int32)
        export(LMGraphA(m), (ids, mask, pos), a, ['input_ids', 'attention_mask', 'position_ids'], ['sequence_output', 'mention_logits'],
               {'input_ids': {0: 'b', 1: 's'}, 'attention_mask': {0: 'b', 1: 's'}, 'position_ids': {0: 'b', 1: 's'},
                'sequence_output': {0: 'b', 1: 's'}, 'mention_logits': {0: 'b', 1: 's', 2: 's'}})
        export(LMGraphB(m), (seq, st, en, sm, tl, cm), b,
               ['sequence_output', 'starts', 'ends', 'span_mask', 'topk_mention_logits', 'categories_masks'], ['final_logits'],
               {'sequence_output': {0: 'b', 1: 's'}, 'starts': {0: 'b', 1: 'k'}, 'ends': {0: 'b', 1: 'k'}, 'span_mask': {0: 'b', 1: 'k'},
                'topk_mention_logits': {0: 'b', 1: 'k', 2: 'k'}, 'categories_masks': {0: 'b', 2: 'k', 3: 'k'},
                'final_logits': {0: 'b', 1: 'k', 2: 'k1'}})
        return
    ids = torch.randint(5, 1000, (1, seg_len)); ids[0, L:] = 1
    mask = torch.ones_like(ids); mask[0, L:] = 0
    pos = torch.where(ids != 1, torch.arange(2, seg_len + 2)[None], 1)
    with torch.no_grad():
        sr, er, _ = FCGraphA(m)(ids, mask, pos)
    export(FCGraphA(m), (ids, mask, pos), a, ['input_ids', 'attention_mask', 'position_ids'], ['start_reps', 'end_reps', 'mention_logits'],
           {'input_ids': {0: 'n'}, 'attention_mask': {0: 'n'}, 'position_ids': {0: 'n'},
            'start_reps': {1: 's'}, 'end_reps': {1: 's'}, 'mention_logits': {1: 's', 2: 's'}})
    export(FCGraphB(m), (sr, er, st, en, sm, tl), b,
           ['start_reps', 'end_reps', 'starts', 'ends', 'span_mask', 'topk_mention_logits'], ['final_logits'],
           {'start_reps': {1: 's'}, 'end_reps': {1: 's'}, 'starts': {1: 'k'}, 'ends': {1: 'k'}, 'span_mask': {1: 'k'},
            'topk_mention_logits': {1: 'k', 2: 'k'}, 'final_logits': {1: 'k', 2: 'k1'}})


def quantize_weights(src, dst):
    """Weight-only int8: every large 2D/3D fp32 initializer becomes int8 + one scale per index of axis 1, read back
    through DequantizeLinear so the math stays fp32. (Dynamic int8, MatMulInteger, is wrong on WebGPU.)"""
    m = onnx.load(src)
    for init in list(m.graph.initializer):
        w = numpy_helper.to_array(init)
        if w.dtype != np.float32 or w.size < QUANT_MIN_SIZE or w.ndim not in (2, 3):
            continue
        red = (0, 2) if w.ndim == 3 else (0,)
        scale = np.maximum(np.abs(w).max(axis=red) / 127, np.finfo(np.float32).tiny).astype(np.float32)
        shape = [1] * w.ndim; shape[1] = -1
        q = np.clip(np.round(w / scale.reshape(shape)), -127, 127).astype(np.int8)
        m.graph.initializer.remove(init)
        m.graph.initializer.extend([numpy_helper.from_array(q, init.name + '_q'), numpy_helper.from_array(scale, init.name + '_s')])
        m.graph.node.insert(0, helper.make_node('DequantizeLinear', [init.name + '_q', init.name + '_s'], [init.name], axis=1))
    onnx.save(m, dst)


def save_arrays(folder, prefix, arrays):
    meta = {}
    for name, arr in arrays.items():
        file = f'{prefix}_{name}.bin'
        np.ascontiguousarray(arr).tofile(os.path.join(folder, file))
        meta[name] = {'file': file, 'dtype': str(arr.dtype), 'dims': list(arr.shape)}
    return meta


def run(sess, feeds):
    return dict(zip([o.name for o in sess.get_outputs()], sess.run(None, feeds)))


def max_diff(x, y):
    ok = (np.abs(x) < 1e30) & (np.abs(y) < 1e30)
    return float(np.abs(x[ok] - y[ok]).max()) if ok.any() else 0.0


def write_parity(out, arch, wrapper, text):
    """The parity case: graph inputs the host would build for a real passage, with CPU outputs of both forms."""
    record = []
    kit.use_onnx(wrapper, arch, *kit.onnx_sessions(out, fp32=True), record=record)
    fp32_clusters = wrapper.predict(texts=[text])[0].get_clusters(as_strings=False)
    (fa, fb), = record
    folder = os.path.join(out, 'parity')
    shutil.rmtree(folder, ignore_errors=True)
    os.makedirs(folder)
    case = {'text': text, 'k': int(fb['starts'].shape[1]), 'graphs': {}}
    q, f = kit.onnx_sessions(out), kit.onnx_sessions(out, fp32=True)
    for g, feeds, qs, fs in (('a', fa, q[0], f[0]), ('b', fb, q[1], f[1])):
        ref, fp = run(qs, feeds), run(fs, feeds)
        case['graphs'][g] = {'inputs': save_arrays(folder, f'{g}_in', feeds), 'reference': save_arrays(folder, f'{g}_ref', ref),
                             'fp32': save_arrays(folder, f'{g}_fp32', fp)}
        for n in ref:
            print(f'  parity {g}.{n}: int8 vs fp32 max diff {max_diff(ref[n], fp[n]):.3g}')
    with open(os.path.join(folder, 'case.json'), 'w', encoding='utf8', newline='\n') as fh:
        json.dump(case, fh, indent=1)
    return fp32_clusters, (fa, fb), case


def compare(other, feeds, out):
    """Runs another export's fp32 graphs on this case's inputs against this export's fp32 outputs; returns the worst diff."""
    d = other if os.path.exists(os.path.join(other, 'graph_a.onnx')) and not os.path.isdir(os.path.join(other, 'fp32')) \
        else os.path.join(other, 'fp32')
    worst = 0.0
    for g, fd in zip('ab', feeds):
        mine = run(kit.ort_session(os.path.join(out, 'fp32', f'graph_{g}.onnx')), fd)
        theirs = run(kit.ort_session(os.path.join(d, f'graph_{g}.onnx')), fd)
        for n in mine:
            diff = max_diff(mine[n], theirs[n])
            worst = max(worst, diff)
            print(f'  vs {d}: {g}.{n} max diff {diff:.3g}')
    return worst


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--compare', help='an older export folder (or a folder of fp32 graph_a/graph_b.onnx) to diff against')
    a = p.parse_args()
    t0 = time.perf_counter()
    arch = kit.arch_of(a.checkpoint)
    wrapper = kit.load_wrapper(arch, a.checkpoint, 'cpu')
    m = wrapper.model.eval()
    head = m.config.coref_head
    os.makedirs(os.path.join(a.out, 'fp32'), exist_ok=True)

    with open(PARITY_TEXT, encoding='utf8') as f:
        text = f.read()
    torch_clusters = wrapper.predict(texts=[text])[0].get_clusters(as_strings=False)
    export_graphs(arch, m, os.path.join(a.out, 'fp32'), head['max_segment_len'])
    for g in 'ab':
        quantize_weights(os.path.join(a.out, 'fp32', f'graph_{g}.onnx'), os.path.join(a.out, f'graph_{g}.onnx'))

    with tempfile.TemporaryDirectory() as tmp:
        wrapper.tokenizer.save_pretrained(tmp)
        shutil.copy(os.path.join(tmp, 'tokenizer.json'), os.path.join(a.out, 'tokenizer.json'))
    config = {'architecture': arch, 'top_lambda': head['top_lambda'], 'max_span_length': head['max_span_length'],
              'max_segment_len': head['max_segment_len'], 'graphContract': kit.GRAPH_CONTRACT}
    with open(os.path.join(a.out, 'host-config.json'), 'w', encoding='utf8', newline='\n') as fh:
        json.dump(config, fh, indent=1)

    onnx_clusters, feeds, case = write_parity(a.out, arch, wrapper, text)
    same = sorted(map(sorted, torch_clusters)) == sorted(map(sorted, onnx_clusters))
    print(f'parity passage: {case["k"]} kept mentions; fp32 ONNX clusters {"equal" if same else "DIFFER from"} PyTorch')
    matches = True
    if a.compare:
        worst = compare(a.compare, feeds, a.out)
        matches = worst <= COMPARE_TOLERANCE
        print(f'--compare: {"match" if matches else "MISMATCH"} (worst {worst:.3g}, tolerance {COMPARE_TOLERANCE})')
    for f in sorted(os.listdir(a.out)):
        path = os.path.join(a.out, f)
        if os.path.isfile(path):
            print(f'  {f}: {os.path.getsize(path) / 1e6:.1f} MB')
    print(f'exported {arch} in {time.perf_counter() - t0:.0f}s')
    if not (same and matches):
        sys.exit(1)


if __name__ == '__main__':
    main()
