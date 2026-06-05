const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { image1, image2, problems } = JSON.parse(event.body);

    const problemsText = problems?.length > 0
      ? `Der Nutzer hat folgende Probleme angegeben: ${problems.join(", ")}.`
      : "Der Nutzer hat keine spezifischen Probleme angegeben.";

    const prompt = `Du bist ein Experte für Rasenpflege und Gartendiagnose. Analysiere die beiden hochgeladenen Rasenfotos und erstelle eine strukturierte Diagnose.

${problemsText}

Antworte NUR als JSON-Objekt (kein Markdown, keine Erklärungen):
{
  "score": <Zahl 1-10>,
  "titel": "<kurzer Diagnosetitel>",
  "zusammenfassung": "<2 Sätze Gesamtbild>",
  "befunde": [
    { "icon": "<emoji>", "typ": "gut|warn|alert", "titel": "<Befundname>", "text": "<1 Satz>" }
  ],
  "empfehlungen": [
    { "prioritaet": "sofort|bald|info", "text": "<konkrete Maßnahme>" }
  ]
}`;

    const requestBody = JSON.stringify({
      model: "claude-sonnet-4-20250514",
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

    const result = await new Promise((resolve, reject) => {
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

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });

      req.on("error", reject);
      req.write(requestBody);
      req.end();
    });

    if (result.status !== 200) {
      console.error("API Error:", result.body);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `API returned ${result.status}: ${result.body}` })
      };
    }

    const data = JSON.parse(result.body);
    const raw = data.content.map(b => b.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: clean
    };

  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
