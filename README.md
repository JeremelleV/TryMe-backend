# TryMe Backend — Node/Express API

![Node.js](https://img.shields.io/badge/Language-Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Framework-Express.js-000000?logo=express&logoColor=white)
![HuggingFace](https://img.shields.io/badge/API-HuggingFace_Space-FFD21E?logo=huggingface&logoColor=black)
![Render](https://img.shields.io/badge/Hosted_on-Render-46E3B7?logo=render&logoColor=white)

---

## Overview

This backend provides:
- /tryon endpoint (garment + selfie → IDM-VTON try-on generation)
- /reverse-search endpoint (temporary garment hosting → Google Lens search)
- Serves static files under /public/reverse/
- Falls back to a mock result when HF quota is exhausted

Built for the TryMe Chrome Extension.

See the TryMe repo: 🔗 **[TryMe](https://github.com/JeremelleV/TryMe)**

---

## Hugging Face Token & ZeroGPU Limitations

IDM-VTON runs on Hugging Face ZeroGPU free tier.  
Key caveats:

- Daily GPU minutes are limited
- API calls may still behave as anonymous
- When quota is exceeded:
  - Hugging Face returns 500 errors
  - Backend automatically returns a mock preview
- Daily quota resets every 24 hours
- Recommended to fork IDM-VTON for your own quota pool

---

## Google Lens Reverse Image Search

The /reverse-search endpoint:
1. Accepts garmentDataUrl
2. Converts it to a JPEG file
3. Stores it in public/reverse/
4. Returns a Google Lens upload-by-URL search link

Caveat:
- Lens URLs are undocumented
- Implementation works as of version 1.0 (2025-11)
- May break if Google changes Lens behavior

---

## API Endpoints

### /tryon
Input: garment image + selfie image  
Output: generated try-on image or mock fallback  

### /reverse-search
Input: garment image  
Output: public URL + Google Lens search URL  

---

## Model Credit — yisol/IDM-VTON

All virtual try-on results are generated using the excellent open-source model licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 License:

### **IDM-VTON on Hugging Face**  
🔗 https://huggingface.co/spaces/yisol/IDM-VTON  

### **GitHub Repository**  
🔗 https://github.com/yisol/IDM-VTON  

This extension does **not** modify or distribute model weights.  
All inference calls go directly through the publicly available **Hugging Face Space API** using the `@gradio/client` library.

If you use or extend this project, please credit **yisol et al.** for their work.
