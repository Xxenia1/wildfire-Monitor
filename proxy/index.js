const fetch = require('node-fetch');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const PORT = 5001;


app.get("/api/sensors", async (req, res) => {
  const { nwlng, nwlat, selng, selat } = req.query;
  const url = `https://api.purpleair.com/v1/sensors?fields=name,latitude,longitude,pm2.5,humidity,temperature,altitude&nwlng=${nwlng}&nwlat=${nwlat}&selng=${selng}&selat=${selat}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-API-Key": process.env.PURPLEAIR_API_KEY
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(` Proxy server running at http://localhost:${PORT}`);
});
