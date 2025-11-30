Quick start for the new JS frontend + Python backend

Prereqs

- Python 3.11+ (venv recommended)
- Node.js & npm (for running frontend dev server)

Run backend (Flask)

PowerShell

```powershell
# from project root
venv\Scripts\Activate.ps1
python web_api.py
```

This will start the Flask API on `http://0.0.0.0:5000` and serve the static frontend when using the production build.

Run frontend (development)

```powershell
cd frontend
npm install
npm run dev
```

If you run the frontend dev server, configure proxy in `vite.config.js` to point `/api` to `http://localhost:5000` (or run the Flask backend on the same origin by building and letting Flask serve `frontend/dist`).

Notes

- The new UI exposes a "TFTP" page (route `/tftp`) with two tabs: Server and Client.
- The Client tab dynamically fetches available filenames from the project's `tftp_files.db` and populates a searchable list/datalist.
- The Server tab allows starting/stopping the TFTP server, viewing DB files and logs.
- The backend endpoints are implemented in `web_api.py` using the existing `TftpServer`, `TftpClient` and `DBManager` classes so the behaviour matches the existing desktop app logic.
