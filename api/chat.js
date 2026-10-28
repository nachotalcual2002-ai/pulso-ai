
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
      error: "Falta configurar la clave de IA en Vercel."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const message = body.message;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Escribe una pregunta."
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        error: "Tu mensaje es demasiado largo."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "Eres PULSO AI, el asistente de PULSO+. Ayudas con tareas escolares, matemáticas, ciencias, lenguaje, tecnología y otras materias. Habla en español claro, explica paso a paso y utiliza ejemplos sencillos. Sé amable, preciso y útil. Ayuda al estudiante a comprender."
            }]
          },
          contents: [{
            role: "user",
            parts: [{
              text: message.trim()
            }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Error de Gemini:", data.error);

      return res.status(502).json({
        error:
          data.error?.message ||
          "La IA no pudo responder. Inténtalo otra vez."
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    return res.status(200).json({
      answer: answer || "No recibí una respuesta."
    });

  } catch (error) {
    console.error("Error en PULSO AI:", error);

    return res.status(500).json({
      error: "Error de conexión. Inténtalo de nuevo."
    });
  }
}
