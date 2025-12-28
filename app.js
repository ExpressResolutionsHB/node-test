const http = require("http");
const url = require("url");
const https = require("https");

// ===== RapidAPI config =====
// Prefer environment variable on Render, fallback to hardcoded for testing
const key = process.env.RAPIDAPI_KEY || "d90acb5d7emsh84d1ba137ac1a63p10cbe3jsn84f9e64afa82";
const rapidHost = "zllw-working-api.p.rapidapi.com";

const headers = {
  "x-rapidapi-key": key,
  "x-rapidapi-host": rapidHost,
  "Content-Type": "application/json",
  "Accept": "application/json"
};
// ===========================

function sendJson(res, status, obj, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    // ✅ CORS (this is the fix)
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin"
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "*";

  // ✅ Handle preflight for browsers
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
  const query = parsedUrl.query;

  if (pathname !== "/value") {
    sendJson(res, 404, { error: "Use /value with address fields" }, origin);
    return;
  }

  const { street, city, state, zip } = query;

  if (!street || !city || !state || !zip) {
    sendJson(
      res,
      400,
      { error: "Missing fields. Use ?street=&city=&state=&zip=" },
      origin
    );
    return;
  }

  const fullAddress = `${street}, ${city}, ${state} ${zip}`;

  const apiUrl =
    "https://" +
    rapidHost +
    "/pro/byaddress?address=" +
    encodeURIComponent(fullAddress);

  const options = { headers };

  https
    .get(apiUrl, options, (apiRes) => {
      let data = "";

      apiRes.on("data", (chunk) => (data += chunk));

      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          // ✅ Pull zestimate from the real response structure you showed
          const zestimate =
            parsed?.propertyDetails?.zestimate ??
            parsed?.zestimate ??
            parsed?.price ??
            null;

          if (!zestimate) {
            sendJson(res, 404, { error: "No Zestimate found" }, origin);
            return;
          }

          // ✅ Return ONLY what you want
          sendJson(res, 200, { address: fullAddress, zestimate }, origin);
        } catch (err) {
          sendJson(res, 500, { error: "Failed to parse Zillow response" }, origin);
        }
      });
    })
    .on("error", (err) => {
      sendJson(res, 500, { error: "Zillow request failed" }, origin);
    });
});

// ✅ Render requires process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on port " + PORT);
});
