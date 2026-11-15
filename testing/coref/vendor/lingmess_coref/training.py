import json
import os
import logging
import random
import signal
import sys
import time
import numpy as np
import torch
from tqdm import tqdm
from torch.optim import AdamW
from transformers import get_linear_schedule_with_warmup
from util import save_all
import wandb

logger = logging.getLogger(__name__)


def train(args, train_batches, model, tokenizer, evaluator):
    """ Train the model """
    t_total = len(train_batches) * args.train_epochs

    # Prepare optimizer and schedule (linear warmup and decay)
    no_decay = ['bias', 'LayerNorm.weight']
    head_params = ['coref', 'mention', 'antecedent']

    model_decay = [p for n, p in model.named_parameters() if
                   not any(hp in n for hp in head_params) and not any(nd in n for nd in no_decay)]
    model_no_decay = [p for n, p in model.named_parameters() if
                      not any(hp in n for hp in head_params) and any(nd in n for nd in no_decay)]
    head_decay = [p for n, p in model.named_parameters() if
                  any(hp in n for hp in head_params) and not any(nd in n for nd in no_decay)]
    head_no_decay = [p for n, p in model.named_parameters() if
                     any(hp in n for hp in head_params) and any(nd in n for nd in no_decay)]

    head_learning_rate = args.head_learning_rate if args.head_learning_rate else args.learning_rate
    optimizer_grouped_parameters = [
        {'params': model_decay, 'lr': args.learning_rate, 'weight_decay': args.weight_decay},
        {'params': model_no_decay, 'lr': args.learning_rate, 'weight_decay': 0.0},
        {'params': head_decay, 'lr': head_learning_rate, 'weight_decay': args.weight_decay},
        {'params': head_no_decay, 'lr': head_learning_rate, 'weight_decay': 0.0}
    ]
    optimizer = AdamW(optimizer_grouped_parameters,
                      lr=args.learning_rate,
                      betas=(args.adam_beta1, args.adam_beta2),
                      eps=args.adam_epsilon)
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=t_total * 0.1, num_training_steps=t_total)

    # using mixed precision
    # bf16: fp16 overflows on this loss and the scaler skips most steps. AMP=fp16 selects fp16.
    amp_dtype = torch.float16 if os.environ.get('AMP') == 'fp16' else torch.bfloat16
    amp_device = torch.device(args.device).type  # cpu for the kit's --smoke check
    scaler = torch.amp.GradScaler(amp_device, enabled=amp_dtype == torch.float16 and amp_device == 'cuda')

    # Train!
    logger.info("***** Running training *****")
    logger.info("  Num Epochs = %d", args.train_epochs)
    logger.info("  Total optimization steps = %d", t_total)

    global_step, tr_loss, logging_loss = 0, 0.0, 0.0
    best_f1, best_global_step = -1, -1

    # resume.pt holds the full state; the seed fixes batch order, so skipping taken steps replays the run.
    state_path = os.path.join(args.output_dir, 'resume.pt')
    if os.path.exists(state_path):
        state = torch.load(state_path, map_location=args.device, weights_only=False)
        model.load_state_dict(state['model'])
        optimizer.load_state_dict(state['optimizer'])
        scheduler.load_state_dict(state['scheduler'])
        scaler.load_state_dict(state['scaler'])
        global_step, tr_loss, logging_loss = state['global_step'], state['tr_loss'], state['logging_loss']
        best_f1, best_global_step = state['best_f1'], state['best_global_step']
        random.setstate(state['py_rng']); np.random.set_state(state['np_rng'])
        torch.set_rng_state(state['torch_rng'].cpu())
        if state['cuda_rng'] is not None: torch.cuda.set_rng_state(state['cuda_rng'].cpu())
        del state
        logger.info(f'Resumed at step {global_step} of {t_total}')
    start_step = global_step

    def fingerprint(tag):
        """Test hook (FINGERPRINT=1): eval-mode loss on the first batch plus optimizer-state sums."""
        if os.environ.get('FINGERPRINT') != '1':
            return
        b = {k: v for k, v in train_batches[0].items()}
        for k in ('input_ids', 'attention_mask', 'gold_clusters'):
            b[k] = torch.tensor(b[k], device=args.device)
        model.eval()
        with torch.no_grad(), torch.amp.autocast(amp_device, dtype=amp_dtype):
            fl = model(b, gold_clusters=b['gold_clusters'], return_all_outputs=False)[0].item()
        model.train()
        osum = sum(float(s['exp_avg_sq'].double().sum()) for s in optimizer.state.values() if 'exp_avg_sq' in s)
        psum = sum(float(p.double().sum()) for p in model.parameters())
        logger.info(f'FINGERPRINT {tag} step={global_step} loss={fl!r} params={psum!r} adam={osum!r} '
                    f'lr={scheduler.get_last_lr()[0]!r} scale={scaler.get_scale()!r}')

    if start_step:
        fingerprint('after-load')

    def save_state():
        tmp = state_path + '.tmp'
        torch.save({'model': model.state_dict(), 'optimizer': optimizer.state_dict(),
                    'scheduler': scheduler.state_dict(), 'scaler': scaler.state_dict(),
                    'global_step': global_step, 'tr_loss': tr_loss, 'logging_loss': logging_loss,
                    'best_f1': best_f1, 'best_global_step': best_global_step,
                    'py_rng': random.getstate(), 'np_rng': np.random.get_state(),
                    'torch_rng': torch.get_rng_state(), 'cuda_rng': torch.cuda.get_rng_state() if amp_device == 'cuda' else None}, tmp)
        os.replace(tmp, state_path)
        logger.info(f'Saved resume state at step {global_step}')
        fingerprint('at-save')

    # Ctrl+C / Ctrl+Break asks for a stop; it happens at the next step boundary, after a state save.
    stop = {'asked': False}

    def ask_stop(signum, frame):
        stop['asked'] = True
        logger.info('Stop requested; saving at the end of this step.')

    signal.signal(signal.SIGINT, ask_stop)
    if hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, ask_stop)
    save_every = float(os.environ.get('SAVE_MINUTES', '10')) * 60
    stop_at = int(os.environ.get('STOP_AT_STEP', '0'))  # test hook: behave as if stopped after this step
    last_save = time.monotonic()

    train_iterator = tqdm(range(int(args.train_epochs)), desc="Epoch")
    for epoch in train_iterator:
        if (epoch + 1) * len(train_batches) <= start_step:
            continue
        epoch_iterator = tqdm(train_batches, desc="Iteration")
        for step, batch in enumerate(epoch_iterator):
            if epoch * len(train_batches) + step < start_step:
                continue
            batch['input_ids'] = torch.tensor(batch['input_ids'], device=args.device)
            batch['attention_mask'] = torch.tensor(batch['attention_mask'], device=args.device)
            batch['gold_clusters'] = torch.tensor(batch['gold_clusters'], device=args.device)
            if 'leftovers' in batch:
                batch['leftovers']['input_ids'] = torch.tensor(batch['leftovers']['input_ids'], device=args.device)
                batch['leftovers']['attention_mask'] = torch.tensor(batch['leftovers']['attention_mask'], device=args.device)

            model.zero_grad()
            model.train()

            with torch.amp.autocast(amp_device, dtype=amp_dtype):
                outputs = model(batch, gold_clusters=batch['gold_clusters'], return_all_outputs=False)

            loss = outputs[0]  # model outputs are always tuple in transformers (see doc)

            tr_loss += loss.item()
            scaler.scale(loss).backward()

            scaler.step(optimizer)
            scheduler.step()        # Update learning rate schedule
            scaler.update()         # Updates the scale for next iteration
            global_step += 1

            # Log metrics
            if global_step % args.logging_steps == 0:
                loss = (tr_loss - logging_loss) / args.logging_steps
                logger.info(f"\nloss step {global_step}: {loss}")
                wandb.log({'loss': loss}, step=global_step)
                logging_loss = tr_loss

            # Evaluation
            if global_step % args.eval_steps == 0:
                results = evaluator.evaluate(model, prefix=f'step_{global_step}')
                wandb.log(results, step=global_step)

                f1 = results["f1"]
                if f1 > best_f1:
                    best_f1, best_global_step = f1, global_step
                    wandb.run.summary["best_f1"] = best_f1

                    # Save model
                    output_dir = os.path.join(args.output_dir, f'model')
                    save_all(tokenizer=tokenizer, model=model, output_dir=output_dir)
                logger.info(f"best f1 is {best_f1} on global step {best_global_step}")

            stop_file = os.path.join(os.path.dirname(os.path.abspath(args.output_dir)), 'STOP')
            if stop['asked'] or global_step == stop_at or os.path.exists(stop_file):
                save_state()
                logger.info(f'Stopped at step {global_step} of {t_total}; run the same command to resume.')
                sys.exit(3)
            if time.monotonic() - last_save > save_every:
                save_state()
                last_save = time.monotonic()

    # best_f1.json marks the run finished; the 7 GB resume state is no longer needed.
    with open(os.path.join(args.output_dir, f"best_f1.json"), "w") as f:
        json.dump({"best_f1": best_f1, "best_global_step": best_global_step}, f)
    if os.path.exists(state_path):
        os.remove(state_path)

    return global_step, tr_loss / global_step



