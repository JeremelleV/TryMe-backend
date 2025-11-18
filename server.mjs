// server.mjs — Node/Express backend for TryMe

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@gradio/client";

dotenv.config();

const app = express();

// Allow JSON bodies up to ~10MB (for data URLs)
app.use(express.json({ limit: "10mb" }));
// Simple CORS so your extension can call this
app.use(cors());

// Lazy-init Gradio client so we reuse the same connection
let clientPromise = null;
function getGradioClient() {
  if (!clientPromise) {
    clientPromise = Client.connect("yisol/IDM-VTON", {
      // If you ever duplicate the Space and need auth:
      // hf_token: process.env.HF_TOKEN,
    });
  }
  return clientPromise;
}

// Helper: convert data:image/...;base64,... → Buffer
function dataUrlToBuffer(dataUrl) {
  const parts = dataUrl.split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid data URL");
  }
  const base64 = parts[1];
  return Buffer.from(base64, "base64");
}

// POST /tryon  { selfieDataUrl, garmentDataUrl }
app.post("/tryon", async (req, res) => {
  try {
    const { selfieDataUrl, garmentDataUrl } = req.body || {};
    if (!selfieDataUrl || !garmentDataUrl) {
      return res
        .status(400)
        .json({ error: "Missing selfieDataUrl or garmentDataUrl" });
    }

    const client = await getGradioClient();

    const humanBuffer = dataUrlToBuffer(selfieDataUrl);
    const garmentBuffer = dataUrlToBuffer(garmentDataUrl);

    // Call the IDM-VTON Space via gradio JS client
    const result = await client.predict("/tryon", [
      { background: humanBuffer, layers: [], composite: null }, // human editor input
      garmentBuffer,                                            // garment image
      "Virtual try-on from TryMe",                             // text prompt
      true,                                                    // auto mask
      false,                                                   // auto crop
      30,                                                      // denoising steps
      42                                                       // seed
    ]);

    const [outputImage, maskedImage] = result.data || [];

    if (!outputImage) {
      return res.status(500).json({
        error: "IDM-VTON returned no image",
        raw: result
      });
    }

    return res.json({
      ok: true,
      result: outputImage,
      masked: maskedImage ?? null
    });
  } catch (err) {
    console.error("TryOn error:", err);
    return res.status(500).json({
      ok: false,
      error: "Backend error",
      details: String(err)
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TryMe backend listening on port ${PORT}`);
});
