# COIL 1.1

**Crowd and squeeze. Not the next candle.**

COIL is a read-only desk that scores one question on crypto perpetual markets:

> Is the crowd trapped, and is spot leading against them on a thin tape?

It is **not** a price forecast, **not** an order bot, and **not** a blended Gravity / ANVIL score. English is the source language of the code, API, and docs so the model can be reviewed internationally.

[API](docs/API.md) · [Contributing](CONTRIBUTING.md) · [License](LICENSE)

---

## What you get

- A dark trading-desk UI: score, regime, crowd side, bias, session, live/demo badge
- Public JSON for a host desk (`/api/desk`, `/api/export`, `/api/venues`)
- Live books from OKX, Bybit, and Binance, with a deterministic **demo** fallback
- Default pit = first **live** venue, even if a demo book prints more volume
- `en` / `ru` labels (copy only — compute stays English)

`source` is locked:

| Value | Meaning |
| --- | --- |
| `live` | Real tape |
| `demo` | Synthetic. Must not vote in a layers summary. |

Never put a venue id in `source`.

---

## Score

```
score = 100 * (0.30*crowd + 0.25*fuel + 0.20*spotLead + 0.15*thinSession + 0.10*mmFlow)
bias  ∈ [-1, +1]
        + short crowd vulnerable
        − long  crowd vulnerable
```

| Regime | When |
| --- | --- |
| `quiet` | no squeeze flag and score `< 35` |
| `squeeze_watch` | `squeeze.watch` or score `≥ 35` |
| `squeeze_armed` | **only** `squeeze.armed` (funding percentile + L/S + OI z + spot lead) |

`mmFlow` is `0` when the inventory adapter is off. Gravity unavailable does **not** zero the score, and Gravity G is **not** mixed into the weights.

---

## Desk API

Host desks set `COIL_API_BASE` to this origin. CORS GET, no cookies, no `Authorization`.

```http
GET $COIL_API_BASE/api/desk?symbol=BTC&interval=5m&venue=okx
GET $COIL_API_BASE/api/export?symbol=BTC&interval=5m&window=48&venue=okx&format=json
GET $COIL_API_BASE/api/venues
```

Card fields (root **or** under `snapshot` / `card`):

`score` · `regime` · `crowdSide` · `bias` · `spotLeadsAgainstCrowd` · `thinTape` · `session` · `source` · `venue` · `symbol` · `interval` · `squeezeSide` · `squeezeWatch` · `squeezeArmed` · `fundingPct` · `oiZ`

Missing fields render as `null`, never as an HTML error page.

`/api/venues` ranks **live first**, then `volumeUsd` desc, then `id`. `default.venue` is the first live pit.

Full contract: [docs/API.md](docs/API.md).

---

## Quick start

```bash
npm install
npm run dev
npm test
npm run typecheck
```

Query defaults: `symbol=BTC`, `interval=5m`, `window=48`. If `venue` is omitted, COIL picks the first live pit from the catalog.

Optional env:

| Name | Meaning |
| --- | --- |
| `GRAVITY_API_BASE` | Sibling Gravity origin (fail-soft, not mixed into score) |
| `COIL_DEFAULT_VENUE` | Live-pit override (`okx` / `bybit` / `binance` / `all`) |
| `MM_FLOW_SOURCE` | `off` (default) / `demo` / `url` |
| `MM_FLOW_URL` | JSON inventory events when source is `url` |

No API keys. Do not scrape Arkham.

---

## Stack

TanStack Start · Vite · React 19 · TanStack Query · Recharts · Tailwind v4 · Zod

---

## License

[MIT](LICENSE) © 2026 Lucky Trends
