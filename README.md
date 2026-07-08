# 🌿 Mareeye — App-ka AI ee Beeraha

App dhab ah oo Soomaali ku hadla, oo garta cudurrada dalagga. Beeralaygu sawir buu qaadaa,
AI-guna wuxuu sheegaa cudurka, daawada (dabiici iyo kiimiko), iyo talooyin beereed.

Wasaaradda Beeraha iyo Waraabka JFS — **App casri ah oo la isticmaali karo**

---

## 📦 Waxa ku jira mashruucan

```
mareeye-app/
├── server.js              → Backend (furaha API-gu halkan buu ku ammaan yahay)
├── package.json           → Xogta mashruuca
├── .env.example           → Tusaale environment variables
└── public/                → App-ka front-end
    ├── index.html         → App-ka oo dhan
    ├── manifest.json      → Si app loogu rakibo telefoonka (PWA)
    ├── service-worker.js  → Shaqada offline ee shell-ka
    ├── icon-192.png       → Astaanta app-ka
    └── icon-512.png
```

**Muhiim:** Furaha API-gu **weligiis ma galo** telefoonka ama app-ka. Wuxuu ku jiraa server-ka
kaliya. App-ku wuxuu la hadlaa server-kaaga, server-kuna wuxuu la hadlaa Anthropic. Sidan ayaa
loo ammaan galiyaa furahaaga.

---

## 1️⃣ Hel furaha API-ga

1. Aad: **https://console.anthropic.com**
2. Samee akoon, geli **Billing** oo ku shub lacag (credit) yar.
3. Aad **API Keys → Create Key**, koobiye fur­aha (wuxuu bilaabmaa `sk-ant-...`).
   - ⚠️ Furahan cid kale ha tusin — waa sida furaha guriga.

---

## 2️⃣ Ku shub internet (Render — bilaash ah)

**Render** waa server bilaash ah oo fudud (hore ayaad u isticmaashay).

1. Aad **https://render.com** oo gal.
2. Riix **New → Web Service**.
3. Soo geli koodhka (upload GitHub, ama isticmaal `render.com` upload):
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Qeybta **Environment**, ku dar labadan:
   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | furahaagii `sk-ant-...` |
   | `MODEL` | `claude-sonnet-5` |
5. Riix **Deploy**. Sug 1-2 daqiiqo.
6. Render wuxuu ku siin doonaa link sida: `https://mareeye-app.onrender.com`

✅ Furaha app-kaaga ayuu hadda internetka ka shaqeeyaa!

> 💡 **Localka ku tijaabinta (ikhtiyaari):** koobiye `.env.example` → `.env`, geli furahaaga,
> kadibna: `npm install && npm start`. Fur `http://localhost:3000`.

---

## 3️⃣ Ku rakib telefoonka (App dhab ah)

Fur linkiga Render-ka **telefoonka** (Chrome/Safari):

**Android (Chrome):**
1. Riix summada `⋮` (kore-midig).
2. Dooro **"Add to Home screen" / "Install app"**.
3. App-ka ayaa telefoonka ku soo dhici doona sida app dhab ah — logada Wasaaradda leh!

**iPhone (Safari):**
1. Riix summada **Share** (□↑).
2. Dooro **"Add to Home Screen"**.

Hadda app-ku wuxuu leeyahay astaan, wuu furmaa iyada oo aan browser lahayn, wuuna u shaqeeyaa
sida app kasta oo kale.

---

## 💰 Qiimaha (muhiim)

- Baaritaan kasta (sawir + jawaab) wuxuu ku kacaa **lacag aad u yar** (sicir-jibbaaran).
- `claude-sonnet-5` = tayo sare. Haddaad rabto **inaad qiimaha yarayso**, beddel `MODEL`-ka
  oo ka dhig `claude-haiku-4-5-20251001` (jaban, degdeg, ku filan aqoonsiga cudurka).
- Ku shub kaliya lacag yar marka hore si aad u tijaabiso.

---

## 🌐 Internet-ka

- **App-ka furitaankiisa** wuu shaqeeyaa xitaa internet la'aan (shell-ka waa la kaydiyay).
- **Baaritaanka AI-ga** wuxuu weli u baahan yahay internet (sawirku server buu u gudbaa).
- Nooca mustaqbalka: model yar oo telefoonka gudihiisa ku shaqeeya (offline) — mashruuc weyn.

---

## ✅ Diyaar u ah isticmaal

Mareeye waa app dhamaystiran oo casri ah oo la isticmaali karo — wuxuu si dhab ah u baaraa
sawirrada, wuxuuna bixiyaa jawaab af Soomaali ah oo cudurka, daawada, iyo talooyinka. Marka
la shubo, waa app buuxa oo beeralaygu maalin kasta isticmaali karo — telefoon kasta.

---

## 🔧 Waxa xiga (haddii Wasaaraddu ay xiiseyso)

1. Ururinta sawirro dalagyada Soomaaliya si model gaar ah loo tababaro (tayo sare).
2. Xog-ururin (dashboard) oo Wasaaraddu ku aragto cudurrada meel kasta ka dhacaya dalka.
3. Cod Soomaali ah (app-ku hadlo) beeralayda aan qorista aqoon.
4. SMS/USSD nooca beeralayda internmarka aan lahayn.

---

*Mareeye · moa.gov.so · Loogu talagalay beeraleyda Soomaaliya 🇸🇴*
