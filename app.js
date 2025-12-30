const http = require("http");
const url = require("url");
const https = require("https");

const RAPIDAPI_KEY =
  process.env.RAPIDAPI_KEY || "PASTE_YOUR_RAPIDAPI_KEY_HERE";
const RAPID_HOST = "zllw-working-api.p.rapidapi.com";

const headers = {
  "x-rapidapi-key": RAPIDAPI_KEY,
  "x-rapidapi-host": RAPID_HOST,
  "Accept": "application/json",
  "Content-Type": "application/json",
};

function sendJson(res, status, obj, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin",
  });
  res.end(JSON.stringify(obj));
}

function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function extractZestimate(parsed) {
  // Your real response had: raw.propertyDetails.zestimate (and also adTargets.zestimate)
  const candidates = [
    parsed?.propertyDetails?.zestimate,
    parsed?.propertyDetails?.adTargets?.zestimate,
    parsed?.propertyDetails?.price,
    parsed?.zestimate,
    parsed?.price,
    parsed?.homeValue,
    parsed?.data?.property?.zestimate,
  ];

  for (const c of candidates) {
    const n = toNumber(c);
    if (n) return n;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "*";

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Vary": "Origin",
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const q = parsedUrl.query;

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
  const apiUrl =
    "https://" + RAPID_HOST + "/pro/byaddress?address=" + encodeURIComponent(fullAddress);

  https
    .get(apiUrl, { headers }, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const zestimate = extractZestimate(parsed);

          if (!zestimate) {
            sendJson(
              res,
              404,
              {
                error: "No Zestimate found",
                address: fullAddress,
                zillowURL: parsed?.zillowURL || parsed?.propertyDetails?.zillowURL || null,
              },
              origin
            );
            return;
          }

          sendJson(res, 200, { address: fullAddress, zestimate }, origin);
        } catch (e) {
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
