# Parks pipeline — self-refreshing park data

Keeps MotherDuck `hitchpass.parks_staging` current and regenerates the app's committed
`parks.data.json`. The app loads that file at runtime (with the inline array in `index.html` as an
offline fallback), so a refresh never requires editing the app.

**Autonomy is OFF.** The workflow runs on manual dispatch only, in DRY-RUN, and produces an artifact.
No schedule, no commit step. Going live is the two deliberate steps below.

## Layout

- `scrape_els.py` — Thousand Trails / Encore / Trails Collection from `thousandtrails.com/explore-campgrounds` (coords exposed; `destination-campgrounds` brand → `dc`). Robots-allowed.
- `scrape_c2c.py` — Coast to Coast from `coastresorts.com/directory` (one GET per state, no coords). Robots-allowed.
- `scrape_pa.py` — Passport America. The public site is a client-rendered Angular app backed by a Firebase Firestore collection (`campgrounds`, project `ionicapp-970ad`) that is world-readable over the Firestore REST API with the site's own public web key (no App Check on reads). We pull the canonical records directly — real coords + addresses, no geocoding, no page crawl. Active US/CA/MX parks only.
- `scrape_koa.py` — KOA from `koa.com`. Root campground pages (`/campgrounds/<slug>/`, derived from the campground sitemap's sub-page URLs) carry a schema.org JSON-LD block with a postal address and geo coordinates. Fetched with a browser User-Agent (Cloudflare serves real content to a normal browser UA); coords come from the JSON-LD, no geocoding. Robots-allowed for `/campgrounds/<slug>/`.
- `ingest_rpi.py` — reads the newest file in `../data/rpi_manual/`. **Never crawls RPI** (`resortparks.com` robots: `Disallow: /`).
- **Boondockers Welcome — not ingested.** Host listings are behind a member login and the exact host location is deliberately withheld until a stay is booked, so there is no public coordinate to ingest, and publishing private residential locations on a public map is out of bounds. Documented here so a future session does not re-attempt it.
- `geocode.py` — free Census → Nominatim, **delta only**, sanity-guarded (state match + ≤40 km from city + in-bounds). Never fabricates a coordinate.
- `upsert.py` — upserts into `parks_staging` on the natural key; carries existing coords forward.
- `sanity_gates.py` — aborts the run if any network drops >20%, overall coord completeness <98%, any coord out of bounds, or the total falls below last-known-good.
- `export_app_data.py` — regenerates `parks.data.json` with **stable ids** (reused by natural key; only new parks get new ids) so saved trips never break.
- `run_pipeline.py` — orchestrator.

## Go live — the only two manual steps

1. **Add the secret.** Repo → Settings → Secrets and variables → Actions → `MOTHERDUCK_TOKEN`.
2. **After watching one clean manual dispatch,** enable autonomy in `.github/workflows/parks-refresh.yml`:
   (a) uncomment the `schedule:` block, and (b) add this commit step after the pipeline step, and set `DRY_RUN: "0"` on the pipeline step so it writes the committed file:

```yaml
      - name: Commit refreshed parks.data.json
        run: |
          git config user.name "parks-refresh-bot"
          git config user.email "actions@users.noreply.github.com"
          git add parks.data.json
          git diff --cached --quiet || git commit -m "chore(parks): scheduled data refresh [skip ci]"
          git push
```

Also change `permissions:` to `contents: write` so the bot can push. Nothing else changes.

## Rollback

Nothing here touches `main`'s app behavior until step 2. To remove entirely: delete
`.github/workflows/parks-refresh.yml` and the `pipeline/` directory.
