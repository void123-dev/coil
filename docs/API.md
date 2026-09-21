# COIL-1.1 API

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

Server cache: 12s for snapshots, **60s** for 30-day OI/funding series. UI poll: 15s.

## Desk card

```
GET $COIL_API_BASE/api/desk?symbol=BTC&interval=5m&venue=okx
fallback: GET $COIL_API_BASE/api/export?symbol=BTC&interval=5m&window=48&venue=okx&format=json
GET $COIL_API_BASE/api/venues
```

Card fields (root, and again under `snapshot` / `card` on `/api/export`):

`score` `regime` `crowdSide` `bias` `spotLeadsAgainstCrowd` `thinTape` `session` `source` `venue` `symbol` `interval` `squeezeSide` `squeezeWatch` `squeezeArmed` `fundingPct` `oiZ`

`regime`: `quiet` | `squeeze_watch` | `squeeze_armed`  
`crowdSide`: `short` | `long` | `mixed`  
`source`: `live` = real tape, `demo` = synthetic. Never a venue id.  
`session`: `asia` | `london` | `us` | `weekend`  
`squeezeSide`: `short` | `long` | `none`

If `source=demo`, treat as mock tape. Desk must not let demo vote in the layers summary. Demo never presents `squeeze.watch` / `squeeze.armed`.

## Squeeze flags (COIL-1.1)

Lookback = last **30 days** on the same venue+symbol (daily OI + ~100 funding prints). If history **< 10 days** → all flags false, `fundingPct` / `oiZ` on the squeeze object are null. `source` stays `live` if the tape is live.

```
shortsCrowded =
  fundingPct <= 0.20
  AND (lsAccount <= 1.05 OR lsTop <= 0.95)
  // at least one L/S series required
  // if BOTH ls series exist and both are long-crowded
  // (lsAccount>=1.60 AND lsTop>=2.20), deny shortsCrowded

longsCrowded =
  fundingPct >= 0.80
  AND (lsAccount >= 1.60 OR lsTop >= 2.20)

fuelOn  = oiZ >= 1.0
fuelHot = oiZ >= 1.5 OR (oiZ >= 1.2 AND oiRising)

shortSqueezeWatch = shortsCrowded AND fuelOn
shortSqueezeArmed = shortsCrowded AND fuelHot AND spotLeadsAgainstCrowd === true
longSqueezeWatch  = longsCrowded AND fuelOn
longSqueezeArmed  = longsCrowded AND fuelHot AND spotLeadsAgainstCrowd === true
```

If both sides would trigger → `side="none"`, watch/armed false.

`spotLeadsAgainstCrowd` stays the existing boolean (shorts + spot taker buy ≥ 52%) or (longs + spot taker buy ≤ 48%). Gravity G is not inside these flags.

`/layers` may treat `squeeze.armed` as COIL armed. Telegram `squeeze_impulse` should key off `squeeze.armed`, not raw score.

Extra diagnostic (not a flag): `squeeze.covering` = price up while OI lags (spent cover, not a live arm). `squeeze.historyDays` is the lookback span.

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
```

Regime:

- `squeeze_armed` only if `squeeze.armed`
- else `squeeze_watch` if `squeeze.watch` **or** score ≥ 35
- else `quiet`

Score ≥ 60 does **not** arm the regime by itself.

`mmFlow = 0` when the adapter is off. Gravity unavailable does not zero the score. Gravity G and ANVIL A are not mixed into COIL.

Envelope: `api: "coil-export"`, `version: "1.1"`, `model: "COIL-1.1"`.

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
