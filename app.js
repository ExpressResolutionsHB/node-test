const http = require("http");
const url = require("url");
const https = require("https");

// ===== RapidAPI config =====
const key = "d90acb5d7emsh84d1ba137ac1a63p10cbe3jsn84f9e64afa82";
const rapidHost = "zllw-working-api.p.rapidapi.com";

const headers = {
  "x-rapidapi-key": key,
  "x-rapidapi-host": rapidHost,
  "Content-Type": "application/json",
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

  const options = { headers };

  https.get(apiUrl, options, apiRes => {
    let data = "";

    apiRes.on("data", chunk => {
      data += chunk;
    });

    apiRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);

        // ✅ CORRECT PATH (from your actual response)
        const zestimate = parsed?.propertyDetails?.zestimate;

        if (!zestimate) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No Zestimate found" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            zestimate
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
