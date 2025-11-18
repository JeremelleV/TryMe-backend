// server.mjs — Node/Express backend for TryMe

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@gradio/client";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory to store temporary reverse-search images
const PUBLIC_DIR = path.join(__dirname, "public");
const REVERSE_DIR = path.join(PUBLIC_DIR, "reverse");
fs.mkdirSync(REVERSE_DIR, { recursive: true });

const app = express();

// Serve /public so Google can access the images
app.use("/public", express.static(PUBLIC_DIR));

// Allow JSON bodies up to ~10MB (for data URLs)
app.use(express.json({ limit: "10mb" }));
// Simple CORS so extension can call this
app.use(cors());

// Lazy-init Gradio client so we reuse the same connection
let clientPromise = null;
function getGradioClient() {
  if (!clientPromise) {
    clientPromise = Client.connect("yisol/IDM-VTON", {
      // If you duplicate the Space and need auth:
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
        .json({ ok: false, error: "Missing selfieDataUrl or garmentDataUrl" });
    }

    const client = await getGradioClient();

    const humanBuffer = dataUrlToBuffer(selfieDataUrl);
    const garmentBuffer = dataUrlToBuffer(garmentDataUrl);

    console.log("Calling IDM-VTON /tryon...");
    const result = await client.predict("/tryon", [
      { background: humanBuffer, layers: [], composite: null }, // human
      garmentBuffer,                                            // garment
      "Virtual try-on from TryMe",                             // text prompt
      true,                                                    // auto mask
      false,                                                   // auto crop
      30,                                                      // denoising steps
      42                                                       // seed
    ]);

    console.log("Raw result from IDM-VTON:", JSON.stringify(result));

    let [outputImage, maskedImage] = result.data || [];

    // ---------- NORMALIZE OUTPUT SO THE BROWSER CAN LOAD IT ----------

    function normalizeImage(img) {
      if (!img) return null;

      // If Gradio returns an object, try common fields
      if (typeof img === "object") {
        const candidate = img.url || img.path || img.image || null;
        if (!candidate) return null;
        img = candidate;
      }

      if (typeof img !== "string") return null;

      // Already a data URL? Use as-is.
      if (img.startsWith("data:image")) {
        return img;
      }

      // Already a full URL? Use as-is.
      if (/^https?:\/\//.test(img)) {
        return img;
      }

      // Paths like "file=/tmp/gradio/..." or "/file=/tmp/..."
      if (img.startsWith("file=") || img.startsWith("/file=")) {
        const trimmed = img.replace(/^\/+/, ""); // remove leading '/'
        const base = "https://yisol-idm-vton.hf.space/";
        return base + trimmed;
      }

      // Fallback: treat as a relative path on the Space
      return "https://yisol-idm-vton.hf.space/" + img.replace(/^\/+/, "");
    }

    const normalizedOutput = normalizeImage(outputImage);
    const normalizedMasked = normalizeImage(maskedImage);

    if (!normalizedOutput) {
      console.error("Could not normalize IDM-VTON output:", outputImage);
      return res.status(500).json({
        ok: false,
        error: "IDM-VTON returned an unsupported image format",
        raw: result
      });
    }

    return res.json({
      ok: true,
      result: normalizedOutput,
      masked: normalizedMasked
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

// POST /reverse-search  { garmentDataUrl }
app.post("/reverse-search", async (req, res) => {
  try {
    const { garmentDataUrl } = req.body || {};
    if (!garmentDataUrl) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing garmentDataUrl" });
    }

    // Reuse your data URL → Buffer helper
    const buffer = dataUrlToBuffer(garmentDataUrl);

    const id =
      crypto.randomUUID?.() ?? crypto.randomBytes(16).toString("hex");
    const filename = `${id}.jpg`;
    const filePath = path.join(REVERSE_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);

    // Build public URL like: https://tryme-backend-fapp.onrender.com/public/reverse/<file>
    const imageUrl = `${req.protocol}://${req.get(
      "host"
    )}/public/reverse/${filename}`;

    const encodedImageUrl = encodeURIComponent(imageUrl);
    const googleUrl = `https://lens.google.com/uploadbyurl?url=${encodedImageUrl}&hl=en`;

    return res.json({
      ok: true,
      imageUrl,
      googleUrl,
    });
  } catch (err) {
    console.error("Reverse search error:", err);
    return res.status(500).json({
      ok: false,
      error: "Backend error during reverse search",
      details: String(err),
    });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TryMe backend listening on port ${PORT}`);
});
