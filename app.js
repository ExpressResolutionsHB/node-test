const http = require("http");
const url = require("url");
const https = require("https");

// ===== RapidAPI config =====
const key =
  process.env.RAPIDAPI_KEY || "d90acb5d7emsh84d1ba137ac1a63p10cbe3jsn84f9e64afa82";
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
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin"
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "*";

  // Preflight for browser calls
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

  const street = (query.street || "").trim();
  const city = (query.city || "").trim();
  const state = (query.state || "").trim();
  const zip = (query.zip || "").trim();

  // Optional lead fields (not stored yet)
  const name = (query.name || "").trim();
  const email = (query.email || "").trim();
  const phone = (query.phone || "").trim();

  if (!street || !city || !state || !zip) {
    sendJson(res, 400, { error: "Missing fields. Use ?street=&city=&state=&zip=" }, origin);
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

      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          // This matches the real response you pasted earlier
          const zestimate =
            parsed?.propertyDetails?.zestimate ??
            parsed?.zestimate ??
            parsed?.price ??
            null;

          if (!zestimate) {
            sendJson(res, 404, { error: "No Zestimate found" }, origin);
            return;
          }

          // Offer range = Zestimate * .55 to .65
          const offerLow = Math.round(Number(zestimate) * 0.55);
          const offerHigh = Math.round(Number(zestimate) * 0.65);

          // Return ONLY what you want (offer range) + keep lead fields if you want to view them
          sendJson(
            res,
            200,
            {
              offerLow,
              offerHigh
            },
            origin
          );
        } catch (err) {
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
