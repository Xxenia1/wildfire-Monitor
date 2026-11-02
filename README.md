# California Wildfire Monitoring Dashboard

A static [Leaflet](https://leafletjs.com/) map for exploring California fire reports, wind vectors, preliminary PM₂.₅ air-quality observations, and historical 2024 vegetation imagery.

## What the map shows

| Mode | Source | What it means |
| --- | --- | --- |
| Fire | NASA FIRMS VIIRS, WFIGS perimeters, CAL FIRE incidents | FIRMS detections from the last five available days, with a 24-hour filter; reported fire perimeters and incidents. The “recent uncontained reports” list uses reports dated within 30 days and is not an official active-fire list. |
| Wind | NOAA HRRR | Animated wind vectors from a daily snapshot. The model reference time appears in the header. |
| Air Quality | EPA AirNow | Preliminary PM₂.₅ AQI readings at monitoring sites. This is not a smoke plume or dispersion forecast. |
| NDVI | Historical 2024 files | A small trend animation loads initially; the two large animations load only when selected. |

The background map uses [OpenStreetMap standard tiles](https://operations.osmfoundation.org/policies/tiles/) with visible attribution. This service is best effort and has a usage policy; a higher-traffic deployment should arrange a suitable tile provider.

## Updates and freshness

Scheduled GitHub Actions workflows write shared snapshots into `public/data/` and `Data/Wind/`. The fire workflow is scheduled about every 30 minutes, AirNow about hourly, and wind daily; GitHub may delay scheduled runs. Browsers read those snapshots and refresh their view without making provider API requests.

The header distinguishes **fetched** time from AirNow **observed** time and the wind model time. A recently fetched WFIGS file can still contain older individual fire perimeters. Open a perimeter to see its report date. Missing containment is displayed as unknown, not 0%.

## Credentials and local checks

Set `FIRMS_KEY` and `AIRNOW_API_KEY` as GitHub Actions repository secrets. Do not put keys or provider request URLs in this public repository. `Backend/fetch_smoke.py` is an optional archive tool and is not used by the site.

```sh
npm ci
npm test
npm run check:public-data
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. The local Fire view needs the generated files in `public/data/`; when those are absent, the published site still uses its own committed snapshots.

The site is an exploratory visualization, not an emergency dispatch source or a fire-spread prediction. See [the rollout and operations plan](docs/rollout-plan.zh-CN.md) for scheduled jobs, quota checks, and recovery.
