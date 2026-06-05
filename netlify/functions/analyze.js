const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const image1 = body.image1;
    const image2 = body.image2;
    const problems = body.problems || [];

    const problemsText = problems.length > 0
      ? "Der Nutzer hat folgende Probleme angegeben: " + problems.join(", ") + "."
      : "Der Nutzer hat keine spezifischen Probleme angegeben.";

    const prompt = "Du bist ein Experte fuer Rasenpflege. Analysiere die Rasenfotos.\n\n" + problemsText + "\n\nAntworte NUR als JSON (kein Markdown):\n{\"score\":7,\"titel\":\"Rasendiagnose\",\"zusammenfassung\":\"Text.\",\"befunde\":[{\"icon\":\"🌿\",\"typ\":\"gut\",\"titel\":\"Name\",\"text\":\"Text\"}],\"empfehlungen\":[{\"prioritaet\":\"bald\",\"text\":\"Massnahme\"}]}";

    const requestBody = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image1 } },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image2 } },
          { type: "text", text: prompt }
        ]
      }]
    });

    const result = await new Promise(function(resolve, reject) {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(requestBody)
        }
      };

      const req = https.request(options, function(res) {
        let data = "";
        res.on("data", function(chunk) { data += chunk; });
        res.on("end", function() { resolve({ status: res.statusCode, body: data }); });
      });

      req.on("error", reject);
      req.write(requestBody);
      req.end();
    });

    if (result.status !== 200) {
      console.error("API Error:", result.body);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API Error: " + result.body })
      };
    }

    const data = JSON.parse(result.body);
    const raw = data.content.map(function(b) { return b.text || ""; }).join("");
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: clean
    };

  } catch (err) {
    console.error("Function error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
