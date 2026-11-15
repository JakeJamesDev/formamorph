"""Shared parts of the coref kit: paths, library patches, model loading, the ONNX host replica and corpus scoring."""
import hashlib
import json
import math
import os
import subprocess
import sys

KIT = os.path.dirname(os.path.abspath(__file__))


def _main_checkout():
    """The main formamorph checkout, also from a git worktree (its common git dir's parent)."""
    repo = os.path.dirname(os.path.dirname(KIT))
    try:
        common = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=repo,
                                capture_output=True, text=True, check=True).stdout.strip()
        return os.path.dirname(common)
    except (OSError, subprocess.CalledProcessError):
        return repo


MAIN = _main_checkout()
WORK = os.path.abspath(os.environ.get('COREF_WORK', os.path.join(MAIN, '.scratch', 'coref')))
DATA = os.path.abspath(os.environ.get('FORMAMORPH_TRAINING_DATA', os.path.join(MAIN, '..', 'formamorph-training-data')))
CORPUS, RUNS, CACHE = (os.path.join(WORK, d) for d in ('corpus', 'runs', 'cache'))
GOLD = os.path.join(DATA, 'coref', 'gold')
VENDOR = os.path.join(KIT, 'vendor', 'lingmess_coref')

GRAPH_CONTRACT = 1
ARCHS = ('lingmess', 'fcoref')
GPU_BUSY_MIB = 3000
os.environ.setdefault('WANDB_MODE', 'disabled')
os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')

import numpy as np  # noqa: E402
import torch  # noqa: E402
import transformers  # noqa: E402

# CPU work (export, scoring, smoke runs) leaves most cores to the person at the machine.
torch.set_num_threads(int(os.environ.get('COREF_THREADS', max(1, (os.cpu_count() or 4) // 4))))

_from_pretrained = transformers.PreTrainedModel.from_pretrained.__func__
# Longformer has no SDPA path; eager attention everywhere keeps training, scoring and export on one code path.
transformers.PreTrainedModel.from_pretrained = classmethod(
    lambda cls, *a, **k: _from_pretrained(cls, *a, **{'attn_implementation': 'eager', **k}))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def gpu_guard():
    """Training needs CUDA and a nearly empty GPU: another loaded model pushes it to OOM or spills."""
    if not torch.cuda.is_available():
        sys.exit('CUDA is not available; refusing to train on CPU (use --smoke for a CPU check).')
    try:
        used = int(subprocess.run(['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'],
                                  capture_output=True, text=True, check=True).stdout.split()[0])
    except (OSError, subprocess.CalledProcessError, ValueError, IndexError) as e:
        sys.exit(f'Could not read GPU memory with nvidia-smi: {e}')
    if used > GPU_BUSY_MIB:
        sys.exit(f'GPU is busy ({used} MiB in use, limit {GPU_BUSY_MIB}). Unload LM Studio/Ollama models and start again.')
    print(f'GPU memory in use: {used} MiB')


def dense_longformer():
    """Longformer's banded attention as dense masked attention: the form the browser graph uses."""
    from transformers.models.longformer import modeling_longformer as ml

    def forward(self, hidden_states, attention_mask=None, layer_head_mask=None, is_index_masked=None,
                is_index_global_attn=None, is_global_attn=None, output_attentions=False):
        B, S, E = hidden_states.shape
        H, D = self.num_heads, self.head_dim
        q = (self.query(hidden_states) / math.sqrt(D)).view(B, S, H, D).transpose(1, 2)
        k = self.key(hidden_states).view(B, S, H, D).transpose(1, 2)
        v = self.value(hidden_states).view(B, S, H, D).transpose(1, 2)
        pos = torch.arange(S, device=hidden_states.device)
        blocked = ((pos[None, :] - pos[:, None]).abs() > self.one_sided_attn_window_size)[None, None] \
            | (attention_mask != 0)[:, None, None, :]
        scores = (q @ k.transpose(-1, -2)).masked_fill(blocked, torch.finfo(q.dtype).min)
        probs = torch.softmax(scores, dim=-1).masked_fill(is_index_masked[:, None, :, None], 0.0)
        return ((probs @ v).transpose(1, 2).reshape(B, S, E),)

    def no_pad(self, input_ids, attention_mask, token_type_ids, position_ids, inputs_embeds, pad_token_id):
        return 0, input_ids, attention_mask, token_type_ids, position_ids, inputs_embeds

    ml.LongformerSelfAttention.forward = forward
    ml.LongformerModel._pad_to_window_size = no_pad


def arch_of(checkpoint):
    with open(os.path.join(checkpoint, 'config.json'), encoding='utf8') as f:
        cfg = json.load(f)
    return 'lingmess' if cfg.get('model_type') == 'longformer' else 'fcoref'


def load_wrapper(arch, checkpoint, device='cpu'):
    """The fastcoref inference wrapper (spaCy words, RoBERTa BPE) around a checkpoint."""
    from fastcoref import FCoref, LingMessCoref
    if arch == 'lingmess':
        dense_longformer()
        return LingMessCoref(model_name_or_path=checkpoint, device=device, enable_progress_bar=False)
    return FCoref(model_name_or_path=checkpoint, device=device, enable_progress_bar=False)


def position_ids(mask):
    """Pads take 1; other tokens take 2, 3, … per row (RoBERTa's padding_idx + 1 onward)."""
    return torch.where(mask == 1, torch.cumsum(mask, dim=1) + 1, torch.ones_like(mask))


def onnx_sessions(export_dir, fp32=False):
    d = os.path.join(export_dir, 'fp32') if fp32 else export_dir
    return tuple(ort_session(os.path.join(d, f'graph_{g}.onnx')) for g in 'ab')


def ort_session(path):
    import onnxruntime as ort
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = torch.get_num_threads()
    # Optimizations fuse DequantizeLinear + MatMul into an int8-activation kernel the browser never runs.
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    return ort.InferenceSession(path, opts, providers=['CPUExecutionProvider'])


def use_onnx(wrapper, arch, A, B, record=None):
    """Routes the wrapper's model forward through graphs A and B, replicating the browser host's steps.
    record: a list that receives each (feeds_a, feeds_b) pair."""
    m = wrapper.model.eval()
    i64 = lambda t: t.cpu().numpy().astype(np.int64)

    def lingmess_forward(batch, gold_clusters=None, return_all_outputs=False):
        ids, mask = batch['input_ids'], batch['attention_mask']
        assert ids.shape[0] == 1, 'the host runs one passage at a time'
        fa = {'input_ids': i64(ids), 'attention_mask': i64(mask), 'position_ids': i64(position_ids(mask))}
        seq, mlog = A.run(None, fa)
        ml_t = torch.from_numpy(mlog)
        starts, ends, span_mask, topk, _ = m._prune_topk_mentions(ml_t, mask)
        _, cat = m._get_categories_labels(batch['tokens'], batch['subtoken_map'], batch['new_token_map'], starts, ends)
        fb = {'sequence_output': seq, 'starts': i64(starts), 'ends': i64(ends), 'span_mask': span_mask.numpy().astype(np.int32),
              'topk_mention_logits': topk.numpy().astype(np.float32), 'categories_masks': cat.numpy().astype(np.int32)}
        final, = B.run(None, fb)
        if record is not None:
            record.append((fa, fb))
        out = (starts, ends, ml_t, torch.from_numpy(final))
        return ((torch.zeros(()),) + out) if gold_clusters is not None else out

    def fcoref_forward(batch, gold_clusters=None, return_all_outputs=False):
        ids, mask = batch['input_ids'], batch['attention_mask']
        assert ids.shape[0] == 1, 'the host runs one passage at a time'
        # Graph A takes whole segments: every row, the leftover included, is padded to max_segment_len.
        seg, full = ids.shape[-1], wrapper.max_segment_len
        rows_ids, rows_mask = list(ids.reshape(-1, seg)), list(mask.reshape(-1, seg))
        if len(batch['leftovers']['input_ids']) > 0:
            rows_ids.append(batch['leftovers']['input_ids'][0]); rows_mask.append(batch['leftovers']['attention_mask'][0])
        padded = lambda rows, v: torch.stack([torch.nn.functional.pad(r, (0, full - r.shape[-1]), value=v) for r in rows])
        ids, mask = padded(rows_ids, wrapper.tokenizer.pad_token_id), padded(rows_mask, 0)
        fa = {'input_ids': i64(ids), 'attention_mask': i64(mask), 'position_ids': i64(position_ids(mask))}
        sr, er, mlog = A.run(None, fa)
        flat = mask.reshape(1, -1)
        ml_t = torch.from_numpy(mlog)
        # Padding is not a mention: the host masks it before top-k.
        pad = (flat == 0)
        ml_t = ml_t.masked_fill(pad[:, :, None] | pad[:, None, :], torch.finfo(ml_t.dtype).min)
        starts, ends, span_mask, topk = m._prune_topk_mentions(ml_t, flat, None)
        fb = {'start_reps': sr, 'end_reps': er, 'starts': i64(starts), 'ends': i64(ends),
              'span_mask': span_mask.numpy().astype(np.int32), 'topk_mention_logits': topk.numpy().astype(np.float32)}
        final, = B.run(None, fb)
        if record is not None:
            record.append((fa, fb))
        out = (starts, ends, ml_t, torch.from_numpy(final))
        return ((torch.zeros(()),) + out) if gold_clusters is not None else out

    m.forward = lingmess_forward if arch == 'lingmess' else fcoref_forward


def read_jsonlines(path):
    with open(path, encoding='utf8') as f:
        return [json.loads(line) for line in f if line.strip()]


def write_jsonlines(path, docs):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8', newline='\n') as f:
        for d in docs:
            f.write(json.dumps(d) + '\n')  # ASCII escapes: fastcoref reads with the locale's codepage


def corpus_dataset(path, tokenizer):
    from fastcoref.utilities import coref_dataset
    return coref_dataset.create(file=path, tokenizer=tokenizer, nlp=None)


def conll_f1(model, collator, dataset, arch):
    """CoNLL F1 (mean of MUC, B³, CEAFe) on a token-form corpus dataset, one document at a time."""
    from fastcoref.utilities.metrics import CorefEvaluator
    from fastcoref.utilities.util import create_clusters, create_mention_to_antecedent, extract_clusters, \
        extract_mentions_to_clusters
    evaluator = CorefEvaluator()
    model.eval()
    for example in dataset:
        if arch == 'lingmess' and example['length'] > 4096:
            sys.exit(f"{example['doc_key']} is {example['length']} BPE tokens; LingMess reads at most 4096.")
        batch = collator([example])
        with torch.no_grad():
            out = model(batch, return_all_outputs=True)
        starts, ends, _, logits = (t.cpu().numpy() for t in out[-4:])
        doc_idx, m2a = create_mention_to_antecedent(starts, ends, logits)
        predicted = create_clusters(m2a[np.nonzero(doc_idx == 0)])
        gold = extract_clusters([[tuple(s) for s in c] for c in example['gold_clusters']])
        evaluator.update(predicted, gold, extract_mentions_to_clusters(predicted), extract_mentions_to_clusters(gold))
    return evaluator.get_f1()
