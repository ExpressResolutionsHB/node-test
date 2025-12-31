const http = require("http");
const https = require("https");
const url = require("url");

// ===== RapidAPI config =====
const key = process.env.RAPIDAPI_KEY || "PASTE_YOUR_RAPIDAPI_KEY_HERE";
const rapidHost = "zllw-working-api.p.rapidapi.com";

const headers = {
  "x-rapidapi-key": key,
  "x-rapidapi-host": rapidHost,
  "Accept": "application/json"
};

// Keep-alive speeds up repeated calls a lot
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

function sendJson(res, status, obj, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin"
  });
  res.end(JSON.stringify(obj));
}

function fetchZestimate(fullAddress) {
  return new Promise((resolve, reject) => {
    const apiUrl =
      "https://" +
      rapidHost +
      "/pro/byaddress?address=" +
      encodeURIComponent(fullAddress);

    const req = https.get(apiUrl, { headers, agent: httpsAgent }, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          const zestimate =
            parsed?.propertyDetails?.zestimate ??
            parsed?.zestimate ??
            parsed?.price ??
            parsed?.data?.property?.zestimate ??
            null;

          if (!zestimate) return reject(new Error("No Zestimate found"));
          resolve({ zestimate, raw: parsed });
        } catch {
          reject(new Error("Failed to parse Zillow response"));
        }
      });
    });

    // Hard timeout (RapidAPI sometimes stalls)
    req.setTimeout(25000, () => {
      req.destroy(new Error("Upstream timeout"));
    });

    req.on("error", (err) => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "*";

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Vary": "Origin"
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const q = parsedUrl.query;

  // Health check
  if (pathname === "/health") {
    sendJson(res, 200, { ok: true }, origin);
    return;
  }

  if (pathname !== "/value") {
    sendJson(res, 404, { error: "Use /value with address fields" }, origin);
    return;
  }

  const street = (q.street || "").trim();
  const city = (q.city || "").trim();
  const state = (q.state || "").trim();
  const zip = (q.zip || "").trim();

  if (!street || !city || !state || !zip) {
    sendJson(res, 400, { error: "Missing fields. Use ?street=&city=&state=&zip=" }, origin);
    return;
  }

  const fullAddress = `${street}, ${city}, ${state} ${zip}`;

  try {
    const { zestimate } = await fetchZestimate(fullAddress);
    sendJson(res, 200, { address: fullAddress, zestimate }, origin);
  } catch (e) {
    sendJson(res, 502, { error: e.message || "Zillow request failed" }, origin);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server listening on port " + PORT));
