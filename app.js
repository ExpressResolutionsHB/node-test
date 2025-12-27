const http = require("http");
const url = require("url");
const https = require("https");

// ===== RapidAPI config =====
const key = process.env.RAPIDAPI_KEY;
const rapidHost = "zllw-working-api.p.rapidapi.com";

const headers = {
  "x-rapidapi-key": key,
  "x-rapidapi-host": rapidHost,
  "Accept": "application/json"
};
// ===========================

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (pathname !== "/value") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Use /value with address fields" }));
    return;
  }

  const { street, city, state, zip } = query;

  if (!street || !city || !state || !zip) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Missing fields. Use ?street=&city=&state=&zip="
      })
    );
    return;
  }

  const fullAddress = `${street}, ${city}, ${state} ${zip}`;

  const apiUrl =
    "https://" +
    rapidHost +
    "/pro/byaddress?address=" +
    encodeURIComponent(fullAddress);

  https.get(apiUrl, { headers }, apiRes => {
    let data = "";

    apiRes.on("data", chunk => {
      data += chunk;
    });

    apiRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);

        // 🔒 KEEP THIS LOGIC — THIS IS WHY IT WORKS
        const estimatedValue =
          parsed?.zestimate ||
          parsed?.price ||
          parsed?.homeValue ||
          parsed?.data?.property?.zestimate;

        if (!estimatedValue) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No value returned from Zillow" }));
          return;
        }

        const offer = Math.round(estimatedValue * 0.6);

        // ✅ ONLY RETURN WHAT YOU WANT
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            address: fullAddress,
            zestimate: estimatedValue,
            offer: offer
          })
        );

      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to parse Zillow response" }));
      }
    });
  }).on("error", () => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Zillow request failed" }));
  });
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
