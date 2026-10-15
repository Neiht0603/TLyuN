# TLyuN mock API

This local-only mock server serves the frontend and fake API responses. It uses
PowerShell and .NET built-ins, so it does not require Node.js or a database.

From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\test\mock-api.ps1
```

Then open `http://localhost:8787/frontend/pages/services.html`. The home page
is available at `http://localhost:8787/frontend/pages/index.html`.

The first quote submission redirects to a mock sign-in page. Select **Tiếp tục
với tài khoản demo** to return to the form and resume the submission. Submitting
again records the fake request in memory; view the requests at
`http://localhost:8787/api/v1/mock/quotes`. Nothing is sent to or stored by a
real backend. To test the sign-out / draft flow again, open
`http://localhost:8787/api/v1/mock-logout`. Stop the server with Ctrl+C.

Fake API data is in `mock-data.json`. To use another port:

```powershell
powershell -ExecutionPolicy Bypass -File .\test\mock-api.ps1 -Port 9000
```

The homepage warehouse and partner sample images use the external URLs in
`mock-data.json`, so they require an internet connection to load.
The mock serves read-only published page copy for all public pages. Admin CMS
endpoints and staff permissions are intentionally not simulated; those require
the backend and database work listed in `docs/content-management-tasks.md`.
