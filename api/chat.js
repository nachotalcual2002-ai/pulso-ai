
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar GEMINI_API_KEY en Vercel."
    });
  }

  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Escribe una pregunta."
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        error: "El mensaje es demasiado largo."
      });
    }

    // Consultar los modelos disponibles para esta clave.
    const modelsResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: {
          "x-goog-api-key": apiKey
        }
      }
    );

    const modelsData = await modelsResponse.json();

    if (!modelsResponse.ok) {
      return res.status(502).json({
        error: modelsData.error?.message ||
          "No pude consultar los modelos disponibles."
      });
    }

    const models = (modelsData.models || [])
      .filter(model =>
        model.supportedGenerationMethods?.includes("generateContent") &&
        /flash/i.test(model.name)
      )
      .sort((a, b) => {
        const score = model =>
          /flash-lite/i.test(model.name) ? 0 : 1;
        return score(a) - score(b);
      });

    if (models.length === 0) {
      return res.status(502).json({
        error: "Tu clave no muestra modelos Flash disponibles. Revisa Google AI Studio."
      });
    }

    let lastError = "No se pudo obtener una respuesta.";

    // Probar modelos disponibles, sin repetir ninguno.
    for (const model of models.slice(0, 3)) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "Eres PULSO AI, un ayudante escolar amable. Explica en español claro, paso a paso y con ejemplos sencillos. Ayuda a comprender las materias."
              }]
            },
            contents: [{
              role: "user",
              parts: [{ text: message.trim() }]
            }]
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        const answer = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

        if (answer) {
          return res.status(200).json({ answer });
        }

        lastError = "El modelo no devolvió texto.";
      } else {
        lastError = data.error?.message ||
          `Error al consultar ${model.name}`;

        // Solo probar otro modelo ante saturación o límites temporales.
        if (
          response.status !== 429 &&
          response.status !== 503 &&
          response.status !== 500
        ) {
          break;
        }
      }
    }

    return res.status(502).json({
      error: "PULSO AI no pudo responder. " + lastError
    });

  } catch (error) {
    console.error("Error en PULSO AI:", error);

    return res.status(500).json({
      error: "Error de conexión. Inténtalo de nuevo."
    });
  }
}
