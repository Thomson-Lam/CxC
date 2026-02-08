# Prec0gnition

Precognition is a wallet-weighted prediction market signal platform. It ingests trade-level data from Polymarket, profiles every wallet's historical accuracy, infers current beliefs from trade sequences, and publishes a manipulation-aware **SmartCrowd Probability**: what calibrated traders actually think will happen that is separated from the raw market price. This project uses NextJS for frontend, FastAPI for backend and SQLite for fast lightweight storage.

## Frontend

Requirements: pnpm

```bash
cd frontend && pnpm install && pnpm dev
```

Visit `localhost:3000` to view the dashboard.

## Backend

Wallet-weighted Precognition backend lives in `backend/`.

Quick run:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pip install -e .
python scripts/seed_demo_data.py --load
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

### Data Ingestion Setup

Due to the pagination nature of the Polymarket API, the pipeline has two ingestion modes: **demo CSV** and **live Polymarket API**.

#### Demo data (offline)

Seeds the database with synthetic markets, trades, and resolved outcomes for local development:

```bash
python scripts/seed_demo_data.py --load
```

Then run the pipeline to compute wallet metrics, trust weights, and precognition snapshots:

```bash
# POST to the running server
curl -X POST http://localhost:8000/pipeline/recompute
```

#### Live Polymarket data

Fetches real market and trade data directly from the Polymarket API. Stop the server first (SQLite allows only one writer at a time):

```bash
python scripts/load_polymarket.py           # ingest only
python scripts/load_polymarket.py --run-backtest   # ingest + run backtest sweep
```

Or trigger incrementally via the API while the server is running:

```bash
POST http://localhost:8000/ingest/polymarket
```

Or trigger a full ingestion via the running web UI to refresh live data in the SQLite DB to work with.

#### Pipeline stages

Each recompute runs four stages in order:

1. **`compute_wallet_metrics`**: Scores every wallet on Brier, log loss, calibration error, churn, persistence, timing edge, ROI, and specialization. Metrics are sliced by market category and prediction horizon bucket (`intraday` / `short` / `medium` / `long`).

2. **`compute_wallet_weights`**: Blends local per-category/horizon edge estimates with global wallet track records using shrinkage (James-Stein style). Applies style penalties for high churn, miscalibration, and lack of specialization. Output: a trust weight in `[0.10, 4.00]` per wallet per context.

3. **`build_snapshots_for_all_markets`**: For each active market, infers wallet beliefs from trade sequences (recency-decayed, persistence-boosted), multiplies by trust weight × confidence, and aggregates into a single Precognition probability with disagreement, Herfindahl concentration, and integrity risk scores.

4. **`backfill_market_snapshots`** *(optional)*: Reconstructs `n` evenly-spaced historical snapshots per market from the trade history, enabling time-series visualization.

#### SQLite environment variables

| Variable | Default | Description |
|---|---|---|
| `PRECOGNITION_DB_PATH` | `backend/data/precognition.db` | SQLite database path |
| `PRECOGNITION_HALF_LIFE_HOURS` | `48` | Recency decay half-life for belief inference |
| `PRECOGNITION_BACKTEST_CUTOFF_HOURS` | `12` | Default backtest horizon |
