# COIL-1.0 API

Standalone read model. Crowd and squeeze. Not a forecast. Not an order bot.

Base: `COIL_API_BASE` (this origin). CORS `*` on `GET`. `OPTIONS` returns `204`.
No cookies. No `Authorization`.

Invalid query values fall back to defaults. Endpoints never return `400` for bad `symbol` / `interval` / `window` / `venue`. Missing card fields are `null`, never an HTML error page.

## Query

| Param | Default | Values |
| --- | --- | --- |
| `symbol` | `BTC` | `BTC ETH SOL XRP DOGE BNB AVAX LINK SUI NEAR` |
| `interval` | `5m` | `1m 5m 15m 1H 4H` |
| `window` | `48` | `24 48 96` |
| `venue` | first **live** pit from `/api/venues` | `okx bybit binance all` |
| `format` | `json` | `json csv schema` (`/api/export` only) |
| `download` | unset | any string → `Content-Disposition: attachment` |

Default pit is **not** high-volume demo Binance. Live ranks above demo, then `volumeUsd` desc, then `id`.

## Routes

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/coil` | `CoilSnapshot` |
| `GET` | `/api/desk` | compact card for X Desk |
| `GET` | `/api/breadth` | watchlist scores (max 3 symbols in flight) |
| `GET` | `/api/venues` | `{ pits, default }` ranked live first |
| `GET` | `/api/export` | envelope `{ api, snapshot, card, …card fields }` |
| `GET` | `/api/export?format=csv` | one-row CSV of snapshot fields |
| `GET` | `/api/export?format=schema` | JSON Schema of the export envelope |
| `OPTIONS` | any of the above | `204` |

Server cache: 12s. UI poll: 15s.

## Desk card

```
GET $COIL_API_BASE/api/desk?symbol=BTC&interval=5m&venue=okx
fallback: GET $COIL_API_BASE/api/export?symbol=BTC&interval=5m&window=48&venue=okx&format=json
GET $COIL_API_BASE/api/venues
```

Card fields (root, and again under `snapshot` / `card` on `/api/export`):

`score` `regime` `crowdSide` `bias` `spotLeadsAgainstCrowd` `thinTape` `session` `source` `venue` `symbol` `interval`

`regime`: `quiet` | `squeeze_watch` | `squeeze_armed`  
`crowdSide`: `short` | `long` | `mixed`  
`source`: `live` = real tape, `demo` = synthetic. Never a venue id.  
`session`: `asia` | `london` | `us` | `weekend`

If `source=demo`, treat as mock tape. Desk must not let demo vote in the layers summary.

## `GET /api/venues`

```json
{
  "pits": [
    { "id": "okx", "label": "OKX", "source": "live", "volumeUsd": 120000000 },
    { "id": "binance", "label": "Binance", "source": "demo", "volumeUsd": 900000000 }
  ],
  "default": { "venue": "okx", "interval": "5m" }
}
```

Sort: live first, then `volumeUsd` desc, then `id`.  
`default.venue` = first live pit even if a demo pit has more volume.  
If no pit is live, largest-volume demo; snapshots keep `source: "demo"`.

## Score

```
score = 100 * (0.30*crowd + 0.25*fuel + 0.20*spotLead + 0.15*thinSession + 0.10*mmFlow)
bias  ∈ [-1,+1]   + short-crowd vulnerable    − long-crowd vulnerable
regime: score<35 quiet · 35–59 squeeze_watch · ≥60 squeeze_armed
```

`mmFlow = 0` when the adapter is off. Gravity unavailable does not zero the score. Gravity G and ANVIL A are not mixed into COIL.

## Env

| Name | Meaning |
| --- | --- |
| `GRAVITY_API_BASE` | sibling Gravity origin; `GET $GRAVITY_API_BASE/api/export?...` fail-soft |
| `COIL_DEFAULT_VENUE` | optional live-pit override (`okx` \| `bybit` \| `binance` \| `all`) |
| `MM_FLOW_SOURCE` | `off` (default) \| `demo` \| `url` |
| `MM_FLOW_URL` | JSON list of inventory events when source is `url` |

No API keys. Do not scrape Arkham.

## `venue=all`

Each live pit is scored. Demo pits do not vote. Score/bias are the median of live pits. Consensus requires ≥2 live pits: `agree_up_squeeze` \| `agree_down_squeeze` \| `split` \| `quiet`.
