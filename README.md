# LinkSnip

A URL shortener built with React, Vite, FastAPI and PostgreSQL
## Requirements 

### 1. Clone the project

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
cd LinkSnip-mainBackend

1 . cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

2. Frontend
Open a new PowerShell:

cd frontend
npm install
npm run dev

3. Cloudflare
Check if installed

cloudflared --version
if not = winget install --id Cloudflare.cloudflared
----------------------------------------------------------------------------------------
If you get:

cloudflared : The term 'cloudflared' is not recognized

run:

$env:Path += ";C:\Program Files (x86)\cloudflared"
----------------------------------------------------------------------------------------
Then check again:

cloudflared --version

Or directly:

& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --version
----------------------------------------------------------------------------------------
3. Make PATH permanent 
==========================================
$dir = "C:\Program Files (x86)\cloudflared"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($userPath -notlike "*$dir*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$userPath;$dir",
        "User"
    )
}
=====================================
Restart PowerShell after this.
----------------------------------------------------------------------------------------
4. Start your frontend
cd frontend
npm run dev

Frontend:

http://localhost:5173
----------------------------------------------------------------------------------------

5. Start Cloudflare Tunnel

Open another PowerShell:

cloudflared tunnel --url http://localhost:5173