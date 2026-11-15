"""Trains one architecture on the kit corpus. Resumable: run the same command again to continue.

  python testing/coref/train.py --arch fcoref --run fcoref-litbank
  python testing/coref/train.py --arch lingmess --run lingmess-e120 --epochs 120
  python testing/coref/train.py --arch fcoref --run smoke --smoke      # CPU check on a corpus slice

Stops cleanly on Ctrl+C or when <runs>/STOP exists (exit 3, state saved); saves every SAVE_MINUTES (10).
The best checkpoint on the LitBank dev split lands in <runs>/<run>/model; best_f1.json marks the run finished.
"""
import argparse
import json
import os
import shutil
import sys

import kit

DEFAULTS = {
    'lingmess': {'base': 'allenai/longformer-large-4096', 'epochs': 120, 'ffnn': 2048, 'eval_steps': 400},
    'fcoref': {'base': 'distilroberta-base', 'epochs': 120, 'ffnn': 1024, 'eval_steps': 200},
}


def smoke_corpus(out):
    """Two short train documents and one dev document cut from the corpus, clusters kept inside the cut."""
    def cut(doc, n=120):
        clusters = [[s for s in c if s[1] < n] for c in doc['clusters']]
        return {'doc_key': doc['doc_key'], 'tokens': doc['tokens'][:n], 'clusters': [c for c in clusters if len(c) > 1]}
    train = [cut(d) for d in kit.read_jsonlines(os.path.join(kit.CORPUS, 'train.jsonlines'))[:2]]
    dev = [cut(d) for d in kit.read_jsonlines(os.path.join(kit.CORPUS, 'litbank.dev.jsonlines'))[:1]]
    paths = os.path.join(out, 'smoke.train.jsonlines'), os.path.join(out, 'smoke.dev.jsonlines')
    kit.write_jsonlines(paths[0], train)
    kit.write_jsonlines(paths[1], dev)
    return paths


def vendor_args(a, out, train_file, dev_file):
    d = DEFAULTS[a.arch]
    epochs = a.epochs or (2 if a.smoke else d['epochs'])
    argv = [f'--model_name_or_path={a.base or d["base"]}', f'--output_dir={out}',
            f'--train_file={train_file}', f'--dev_file={dev_file}', '--eval_split=dev', '--do_train',
            f'--max_tokens_in_batch={a.max_tokens}', f'--train_epochs={epochs}',
            f'--head_learning_rate={a.head_lr}', f'--learning_rate={a.lr}', f'--ffnn_size={d["ffnn"]}',
            f'--logging_steps={1 if a.smoke else 100}', f'--eval_steps={1 if a.smoke else d["eval_steps"]}',
            f'--seed={a.seed}', f'--device={"cpu" if a.smoke else "cuda:0"}', f'--cache_dir={kit.CACHE}']
    if not os.path.exists(os.path.join(out, 'resume.pt')):
        argv.append('--overwrite_output_dir')
    return argv


def train_lingmess(argv):
    import modeling_lingmess
    lm_from = modeling_lingmess.LingMessCoref.from_pretrained.__func__

    def from_pretrained(cls, *a, **k):
        out = lm_from(cls, *a, **k)
        model = out[0] if isinstance(out, tuple) else out
        # from_pretrained skips __init__-time init, leaving the torch.empty antecedent weights as garbage (NaN loss).
        if isinstance(out, tuple) and 'antecedent_s2s_all_weights' in out[1]['missing_keys']:
            model.reset_parameters()
        if os.environ.get('GC', '1') == '1':  # gradient checkpointing
            model.base_model.gradient_checkpointing_enable()
        return out

    modeling_lingmess.LingMessCoref.from_pretrained = classmethod(from_pretrained)
    import run
    sys.argv = [sys.argv[0], *argv, '--experiment_name=coref-kit']
    run.main()


def train_fcoref(argv):
    import torch
    from transformers import AutoConfig, AutoTokenizer
    from fastcoref.coref_models.modeling_fcoref import FCorefModel
    from fastcoref.utilities.collate import DynamicBatchSampler, LeftOversCollator
    from cli import parse_args
    from training import train
    from util import set_seed
    import wandb

    sys.argv = [sys.argv[0], *argv]
    args = parse_args()
    if args.overwrite_output_dir and os.path.exists(args.output_dir):
        shutil.rmtree(args.output_dir)
    os.makedirs(args.output_dir, exist_ok=True)
    args.device = torch.device(args.device)
    args.n_gpu = 1
    set_seed(args)
    wandb.init(project='coref-kit', config=args)

    config = AutoConfig.from_pretrained(args.model_name_or_path, cache_dir=args.cache_dir)
    config.coref_head = {'max_span_length': args.max_span_length, 'top_lambda': args.top_lambda, 'ffnn_size': args.ffnn_size,
                         'dropout_prob': args.dropout_prob, 'max_segment_len': args.max_segment_len}
    tokenizer = AutoTokenizer.from_pretrained(args.model_name_or_path, use_fast=True, add_prefix_space=True, cache_dir=args.cache_dir)
    model = FCorefModel.from_pretrained(args.model_name_or_path, config=config, cache_dir=args.cache_dir).to(args.device)
    collator = LeftOversCollator(tokenizer=tokenizer, device=args.device, max_segment_len=args.max_segment_len)

    train_set = kit.corpus_dataset(args.train_file, tokenizer)
    dev_set = kit.corpus_dataset(args.dev_file, tokenizer)
    sampler = DynamicBatchSampler(train_set, collator=collator, max_tokens=args.max_tokens_in_batch, max_segment_len=args.max_segment_len)
    from fastcoref.utilities.coref_dataset import create_batches
    batches = create_batches(sampler).shuffle(seed=args.seed)

    class Evaluator:
        def evaluate(self, model, prefix=''):
            f1 = kit.conll_f1(model, collator, dev_set, 'fcoref')
            print(f'{prefix} dev CoNLL F1 {f1:.4f}', flush=True)
            return {'f1': f1}

    train(args, batches, model, tokenizer, Evaluator())


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--arch', choices=kit.ARCHS, required=True)
    p.add_argument('--run', required=True, help='run name: the folder under the runs directory')
    p.add_argument('--epochs', type=float)
    p.add_argument('--base', help='pretrained encoder to start from (default per architecture)')
    p.add_argument('--lr', type=float, default=1e-5)
    p.add_argument('--head-lr', type=float, default=3e-4)
    p.add_argument('--max-tokens', type=int, default=5000)
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--smoke', action='store_true', help='CPU, 4 threads, a corpus slice: proves the loop, not the model')
    a = p.parse_args()

    out = os.path.join(kit.RUNS, a.run)
    if os.path.exists(os.path.join(out, 'best_f1.json')):
        with open(os.path.join(out, 'best_f1.json')) as f:
            print(f'{a.run} already finished:', json.load(f))
        return
    stop = os.path.join(kit.RUNS, 'STOP')
    if os.path.exists(stop):
        os.remove(stop)  # it stopped the last run; this one starts clean
    if os.path.isdir(out) and not os.path.exists(os.path.join(out, 'resume.pt')) and os.listdir(out):
        sys.exit(f'{out} holds a run with no resume state. Pick another --run name.')
    if a.smoke:
        import torch
        torch.set_num_threads(4)
        train_file, dev_file = smoke_corpus(out + '.smoke-data')
    else:
        kit.gpu_guard()
        train_file, dev_file = (os.path.join(kit.CORPUS, f) for f in ('train.jsonlines', 'litbank.dev.jsonlines'))
        for f in (train_file, dev_file):
            if not os.path.exists(f):
                sys.exit(f'{f} is missing. Build the corpus first: python testing/coref/corpus.py')
    sys.path.insert(0, kit.VENDOR)
    argv = vendor_args(a, out, train_file, dev_file)
    (train_lingmess if a.arch == 'lingmess' else train_fcoref)(argv)


if __name__ == '__main__':
    main()
