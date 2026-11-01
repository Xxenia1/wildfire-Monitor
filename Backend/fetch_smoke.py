"""Fetch California AirNow PM2.5 data without putting the API key in source files."""

import getpass
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


API_URL = "https://www.airnowapi.org/aq/data/"
BBOX = "-124.48,32.53,-114.13,42.01"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "Data" / "Smoke"


def get_api_key():
    key = os.environ.get("AIRNOW_API_KEY", "").strip()
    if not key and sys.stdin.isatty():
        key = getpass.getpass("AirNow API key (input hidden): ").strip()
    if not key:
        raise RuntimeError(
            "AirNow API key missing. Run in a terminal to enter it securely, "
            "or set AIRNOW_API_KEY in the job's secret environment."
        )
    return key


def fetch_smoke_data(api_key, day):
    date_str = day.strftime("%Y-%m-%d")
    params = {
        "startDate": f"{date_str}T00",
        "endDate": f"{date_str}T23",
        "parameters": "PM25",
        "BBOX": BBOX,
        "dataType": "A",
        "format": "application/json",
        "verbose": "1",
        "monitorType": "0",
        "includerawconcentration": "1",
        "API_KEY": api_key,
    }
    request = Request(f"{API_URL}?{urlencode(params)}", headers={"Accept": "application/json"})

    for attempt in range(3):
        try:
            with urlopen(request, timeout=60) as response:
                payload = response.read()
            try:
                return json.loads(payload)
            except ValueError:
                raise RuntimeError("AirNow returned invalid JSON") from None
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            # Network exceptions may include the full URL and its API key.
            status = exc.code if isinstance(exc, HTTPError) else "network error"
            print(f"AirNow request attempt {attempt + 1} failed: {status}", file=sys.stderr)
            if attempt == 2:
                raise RuntimeError(f"AirNow request failed: {status}") from None
            time.sleep(5 * (attempt + 1))


def save_json(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=".airnow-", delete=False
    ) as temporary:
        temp_path = Path(temporary.name)
        temporary.write(content)
    try:
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def upload_if_configured(path):
    bucket_name = os.environ.get("AIRNOW_GCS_BUCKET", "").strip()
    if not bucket_name:
        return
    from google.cloud import storage

    blob = storage.Client().bucket(bucket_name).blob(f"smoke_contours/{path.name}")
    blob.upload_from_filename(str(path), content_type="application/json")
    print(f"Uploaded {path.name} to configured GCS bucket")


def main():
    api_key = get_api_key()
    day = datetime.now(ZoneInfo("America/Los_Angeles")).date() - timedelta(days=1)
    data = fetch_smoke_data(api_key, day)
    if not isinstance(data, list) or not data:
        raise RuntimeError("AirNow returned no PM2.5 records; existing data was not replaced")

    content = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if api_key in content:
        raise RuntimeError("Refusing to save a response containing the API key")

    dated_path = OUTPUT_DIR / f"{day:%Y%m%d}_PM25_data.json"
    latest_path = OUTPUT_DIR / "airnow_pm25_latest.json"
    save_json(dated_path, content)
    save_json(latest_path, content)
    upload_if_configured(dated_path)
    print(f"Saved {len(data)} AirNow records to {latest_path}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
