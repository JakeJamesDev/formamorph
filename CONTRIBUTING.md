# Contributing to Formamorph

Thanks for your interest in improving Formamorph! Contributions are welcome. Please read this short guide first — especially the **CLA** section, which is required.

## 📜 Licensing & the CLA (read first)

Formamorph is **source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE)**, and the maintainer also distributes commercial builds (e.g. on Steam). To keep that possible, **every contribution requires agreeing to the [Contributor License Agreement](CLA.md)**.

In plain terms: you keep the copyright to your work, but you grant the maintainer a broad license — including the right to include your contribution in **commercial** releases. Without this, your contribution couldn't legally ship in a paid build.

**How to agree** (one-time): when you open your first pull request, the **CLA Assistant bot** will automatically comment with a link to the [CLA](CLA.md) and the exact phrase to sign. Reply to that comment with:

> I have read the CLA Document and I hereby sign the CLA

The bot records your signature and turns its status check green; you won't be asked again on future PRs. (Comment `recheck` if the check ever needs to re-run.)

## 🎨 Asset contributions

Because the project ships commercially, **any non-code asset** (image, audio, 3D model, font, animation) must be **your original work or cleared for commercial use and redistribution**. Include the source and license in your PR. Assets that are "free for personal use only," scraped, or of unknown origin **cannot** be accepted.

## 🛠️ Development setup

```bash
npm install
npm run dev      # Vite dev server on :5173
```

Requires **Node ≥ 20.19** (see `.nvmrc`).

## ✅ Before you open a PR — "Done = green"

All four must pass:

| Command | Checks |
|---|---|
| `npm run typecheck` | TypeScript (strict; the real type gate — there's no type-aware lint) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run build` | Production build |

New logic should come with tests where practical (pure helpers especially — mirror the existing `*.test.ts` style).

## 🧭 Conventions

- **TypeScript strict**, no explicit `any` (use precise types / `unknown` + narrowing). Path alias `@/*` → `src/*`.
- **American English** everywhere (code, comments, docs).
- The product name is **Formamorph** (single capital); lowercase only in URLs / `package.json`.
- Keep comments short and present-tense (explain the code as it is, not its history).
- Shared domain types live in `src/types`.

## 🔀 Pull request process

1. Fork, branch from `main`.
2. Make focused changes; keep the diff scoped to one concern.
3. Ensure the four gates are green and include/adjust tests.
4. Open the PR with a clear description, the CLA agreement line (first PR), and signed-off commits.

## ⚖️ Conduct & content

Formamorph is an adults-only AI roleplay tool. Contributions must not add features whose primary purpose is generating illegal content. Be respectful in issues and reviews.

---

Questions? Open an issue. Thanks for contributing! 🙌
