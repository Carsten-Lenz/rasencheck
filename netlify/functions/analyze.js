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

Antworte NUR als JSON-Objekt (kein Markdown):
{
  "score": <Zahl 1-10>,
  "titel": "<kurzer Diagnosetitel>",
  "zusammenfassung": "<2 Sätze>",
  "befunde": [
    { "icon": "<emoji>", "typ": "gut|warn|alert", "titel": "<Name>", "text": "<1 Satz>" }
  ],
  "empfehlungen": [
    { "prioritaet": "sofort|bald|info", "text": "<Maßnahme>" }
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
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
      })
    });

    const data = await response.json();
    const raw = data.content.map(b => b.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: clean
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
