const http = require("http");
const url = require("url");
const https = require("https");

// ===== RapidAPI config =====
const rapidHost = "zllw-working-api.p.rapidapi.com";
const key = process.env.RAPIDAPI_KEY; // set in Render Env Vars

const headers = {
  "x-rapidapi-key": key,
  "x-rapidapi-host": rapidHost,
  "Content-Type": "application/json",
  "Accept": "application/json"
};

// ===== Google Sheets webhook (Apps Script Web App URL) =====
const SHEETS_WEBHOOK = process.env.SHEETS_WEBHOOK; // set in Render Env Vars

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

function postToSheets(payload) {
  return new Promise((resolve) => {
    if (!SHEETS_WEBHOOK) return resolve(false);

    try {
      const u = new URL(SHEETS_WEBHOOK);
      const body = JSON.stringify(payload);

      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + (u.search || ""),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
          }
        },
        (r) => {
          r.on("data", () => {});
          r.on("end", () => resolve(true));
        }
      );

      req.on("error", () => resolve(false));
      req.write(body);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

const server = http.createServer((req, res) => {
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

  if (pathname !== "/value") {
    sendJson(res, 404, { error: "Use /value with address fields" }, origin);
    return;
  }

  // Required address fields
  const street = (q.street || "").trim();
  const city   = (q.city || "").trim();
  const state  = (q.state || "").trim();
  const zip    = (q.zip || "").trim();

  if (!street || !city || !state || !zip) {
    sendJson(res, 400, { error: "Missing fields. Use ?street=&city=&state=&zip=" }, origin);
    return;
  }

  // Optional lead fields
  const name  = (q.name || "").trim();
  const email = (q.email || "").trim();
  const phone = (q.phone || "").trim();

  if (!key) {
    sendJson(res, 500, { error: "Missing RAPIDAPI_KEY env var on server" }, origin);
    return;
  }

  const fullAddress = `${street}, ${city}, ${state} ${zip}`;
  const apiUrl =
    "https://" +
    rapidHost +
    "/pro/byaddress?address=" +
    encodeURIComponent(fullAddress);

  https
    .get(apiUrl, { headers }, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", async () => {
        try {
          const parsed = JSON.parse(data);

          // pull zestimate from common locations
          const zestimate =
            parsed?.propertyDetails?.zestimate ??
            parsed?.zestimate ??
            parsed?.price ??
            null;

          if (!zestimate) {
            sendJson(res, 404, { error: "No Zestimate found" }, origin);
            return;
          }

          // Offer range: zestimate * .55 to .65
          const offerLow  = Math.round(Number(zestimate) * 0.55);
          const offerHigh = Math.round(Number(zestimate) * 0.65);

          // Store lead if any info provided
          if (name || email || phone) {
            await postToSheets({
              name,
              email,
              phone,
              street,
              city,
              state,
              zip,
              offerLow,
              offerHigh
            });
          }

          // Return only offer range
          sendJson(res, 200, { offerLow, offerHigh }, origin);
        } catch {
          sendJson(res, 500, { error: "Failed to parse Zillow response" }, origin);
        }
      });
    })
    .on("error", () => {
      sendJson(res, 500, { error: "Zillow request failed" }, origin);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server listening on port " + PORT));
