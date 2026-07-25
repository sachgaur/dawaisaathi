# DawaiSathi

## Prerequisites
- Python 3.10+
- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials
- A Google Gemini API key

---

## 1. Clone the repository

```bash
git clone https://github.com/Project-eigen/version_1.git
cd version_1
```

---

## 2. Backend setup

```bash
cd backend
pip install -r requirements.txt
```

Copy the env template and fill in your credentials:

```bash
cp .env.example .env
```

Edit `backend/.env` with your actual values:

| Variable | What to put |
|---|---|
| `SECRET_KEY` | Any random secret string |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console → OAuth 2.0 Client |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/api/auth/callback` |
| `FRONTEND_URL` | `http://localhost:5173` |
| `GEMINI_API_KEY` | From Google AI Studio |

Run the backend:

```bash
python app.py
```

Backend runs on **http://localhost:5000**

---

## 3. Frontend setup

```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## 4. Google Cloud OAuth setup

In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client:

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:5000
```

**Authorized redirect URIs:**
```
http://localhost:5000/api/auth/callback
```

---

## 5. Open the app

Open [http://localhost:5173](http://localhost:5173) in your browser.
