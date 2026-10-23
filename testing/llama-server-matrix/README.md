# llama-server load matrix and smoke test

Real-binary checks for the desktop engine. They run **outside the gates** and load models on the GPU.
Run them before the engine merges to main, and after every llama.cpp pin bump.

## Load matrix

Starts the bundled `llama-server` in router mode once per setting combination, loads a small model,
answers one chat turn, then stops. After each stop it checks that no `llama-server` process remains and
that GPU memory is back near the starting figure.

```bash
npm run llama-server:fetch
node testing/llama-server-matrix/run.mjs --model <small.gguf>
```

| Flag | Meaning |
| --- | --- |
| `--model <gguf>` | Required. Any small model (a 3B Q4 is enough). |
| `--bin <path>` | The `llama-server` to test. Default: the bundled build. |
| `--only a,b` | Run only these combination ids. |
| `--context <n>` | Context Size for every load. Default 4096. |
| `--tolerance <MiB>` | GPU memory allowed above the starting figure after a stop. Default 400. |
| `--list` | Print the combination ids and stop. |

Combinations (`--list` prints the ids):

- The baseline: Flash Attention on, Unified KV Cache on, F16/F16, KV on the GPU, device Auto, GPU Layers Auto.
- Each setting alone: Flash Attention off, Unified KV Cache off (2 Parallel Requests), KV Cache in RAM,
  GPU Layers Max and Custom, GPU Device pinned to the first device.
- Every K × V cache type pair with Flash Attention on.

`bad-v-q8-fa-off` forces a quantized V cache with Flash Attention off. The panel never allows it. The
matrix must see it **fail to load**; that proves the script can fail.

The exit code is 0 when every row passes. The last lines print a Markdown table for the landing note.

Notes:

- Other apps hold VRAM too, so the check compares against the figure read before the first load.
- Per-process VRAM is not available on Windows GeForce, so the check reads whole-GPU use.
- A run needs the GPU for a few minutes. Close other heavy GPU work first.

## Packaged-build smoke test (Windows)

Proves the installed build starts the engine, loads, answers, and frees the GPU on quit.

1. `node testing/llama-server-matrix/afterQuit.mjs` and note the GPU memory (the baseline).
2. `npm run desktop:build`. It writes `release/win-unpacked/`.
3. `node testing/llama-server-matrix/smoke.mjs --models-dir <folder with the small .gguf>`. It starts the
   unpacked app on a throwaway root, loads the model through the app's bridge, sends one chat turn,
   and quits. It prints `PASS` when the engine is ready and the turn answers.
4. `node testing/llama-server-matrix/afterQuit.mjs --baseline <MiB from step 1>`. It must print `PASS`:
   no `llama-server` process and no GPU memory held.

Port 8977 must be free; the engine always binds it. To prove a crash frees the GPU too, kill the app
in Task Manager before step 4.
