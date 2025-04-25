# %%
import requests
import time
import os
import json
import shutil
import tempfile
from datetime import datetime,timedelta
from google.cloud import storage
from zoneinfo import ZoneInfo
# configration
API_KEY = '2900B648-68DC-4DA9-8912-108C4DC5B87A'
BBOX    = '-124.48,32.53,-114.13,42.01'
SRS     = 'EPSG:4326'
PARAMS  = 'PM25'                                # Pollutant
BUCKET_NAME = "wildfire-monitor-data"
DEST_FOLDER = 'smoke_contours'
# %% fetch data
def fetch_smoke_data():
    now_ca = datetime.now(ZoneInfo("America/Los_Angeles"))
    yesterday_ca = now_ca - timedelta(days=1)
    date_str = yesterday_ca.strftime("%Y-%m-%d")
    start = f"{date_str}T00"
    end   = f"{date_str}T23"
    url = (
        "https://www.airnowapi.org/aq/data/"
        f"?startDate={start}"
        f"&endDate={end}"
        f"&parameters=PM25"
        f"&BBOX={BBOX}"
        f"&dataType=A"               # AQI 
        f"&format=application/json"
        f"&verbose=1"
        f"&monitorType=0"            # 0=Permanent monitors
        f"&includerawconcentration=1"
        f"&API_KEY={API_KEY}"
    )
    print(f"[DEBUG] CA now: {now_ca} → fetching for: {date_str}")
    
    for attempt in range(3):
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            print(f"[WARN] attempt {attempt+1} failed:", e)
            if attempt < 2:
                time.sleep(5*(attempt+1))
            else:
                raise


# %% upload to GCS
def upload_file_to_gcs(local_path, bucket_name, dest_blob):
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob   = bucket.blob(dest_blob)
    blob.upload_from_filename(local_path, content_type='application/json')
    print(f"[{datetime.utcnow()}] Uploaded file → gs://{bucket_name}/{dest_blob}")

def main():
    # fetch data
    data = fetch_smoke_data()

    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected payload type: {type(data)}")
    count = len(data)
    print(f"[{datetime.utcnow()}] Fetched {count} records from AirNow API.")
    if count > 0:
        sample = data[:3] 
        print("Sample record keys:", list(sample[0].keys()))
        print("First record:", json.dumps(sample[0], ensure_ascii=False, indent=2))
    else:
        print(" Warning: fetched empty data array!")

    # temporary json file
    temp_dir = tempfile.mkdtemp(prefix='smoke_')
    try:
        filename = (datetime.utcnow() - timedelta(days=1)).strftime('%Y%m%d') + '_PM25_data.json'
        tmp_file = os.path.join(temp_dir, filename)

        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[{datetime.utcnow()}] Wrote data to {tmp_file}")

        # upload to GCS
        dest_blob = f"{DEST_FOLDER}/{filename}"
        upload_file_to_gcs(tmp_file, BUCKET_NAME, dest_blob)

    finally:
        # clean temp_file
        shutil.rmtree(temp_dir)
        print(f"[{datetime.utcnow()}] Removed temporary dir {temp_dir}")

if __name__ == '__main__':

    main()
# %%
