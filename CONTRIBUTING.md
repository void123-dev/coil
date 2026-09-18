# Contributing to COIL

Thank you for helping improve COIL. This project is written in English so that researchers, traders, and engineers anywhere can read the model, the API, and the code without a language barrier.

## What belongs here

COIL answers one question: **is the crowd trapped, and is spot leading against them on a thin tape?**

Please keep that scope. Pull requests that add forecasts, order routing, or blended Gravity / ANVIL scores will be declined.

## Ground rules

- Do not describe the model as manipulation.
- Do not write buy / sell advice in UI copy or docs.
- `source` is only `live` or `demo` — never a venue id.
- Demo rows must never vote in a multi-venue summary.
- Default venue is the first **live** pit, not the highest-volume demo book.
- Missing desk-card fields must serialize as `null`, not throw.

## Tests that must stay green

```bash
npm test
npm run typecheck
```

Covered cases include session labels (`ny_close`, `weekend`), short-crowd + spot-lead bias, `mmFlow = 0` when the adapter is off, demo packs never labeled as a live venue, invalid interval fallback (`3m` → `5m`), Gravity offline not zeroing the score, and live-first venue ranking.

## Code layout

| Path | Role |
| --- | --- |
| `src/coil/` | Pure compute. No I/O. |
| `src/lib/venues/` | Exchange adapters + demo fallback. |
| `src/routes/api/` | Public JSON API (CORS GET, no auth). |
| `src/components/coil/` | Desk UI. |
| `docs/API.md` | Contract for host desks. |

## Pull requests

1. Fork and branch from `main`.
2. Keep commits in English, in the imperative mood (`Add OKX long/short ratio`, not `added stuff`).
3. Update `docs/API.md` when you change a public field.
4. Open a PR with a short English description of *why*, not only *what*.

## License

By contributing you agree that your work is released under the MIT License.
