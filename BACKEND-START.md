# Local appointment form backend

This is a local learning prototype. It accepts appointment requests and appends them to `data/appointments.ndjson` on this computer. The file contains personal data in readable form. Use fake details while learning; this setup is not ready for real patient data or public hosting.

## Start it

1. Open PowerShell in this project folder (`C:\Users\user\Desktop\dental`).
2. Run `node server.js`.
3. Open `http://127.0.0.1:3000` in your browser. Do not open `mainpage.html` directly as a `file://` URL.
4. Submit a test appointment using fake details.
5. Stop the server with `Ctrl+C`. Requests are saved in `data/appointments.ndjson`, one JSON record per line.

## View requests in a readable page

With the server running, open the public page at `http://127.0.0.1:3000` and click the tooth icon. Enter the owner password `kosmic` to open the dashboard. The dashboard formats dates and shows each request's contact details. Press **Refresh** to load new requests. Select a request and use **Arrived** or **No-show** beside its name to mark attendance; clicking the active mark again resets it to **New**. Marked names are crossed out and the status is saved with the request.

This password protects the local prototype only. The request file contains personal details, including any note the patient adds, in readable form. Use fake details while learning. This starter does not send email or text notifications. Do not deploy it or use real patient data until it has secure hosting and storage, stronger secret configuration, and appropriate access controls. Do not commit or share the generated `data` folder.
