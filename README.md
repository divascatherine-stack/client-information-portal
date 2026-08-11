# Shared client information portal

The HTML form now submits records to the shared server API instead of browser-only storage.

The project also includes a Netlify Function using Netlify Blobs, so the form and admin dashboard can share records after deployment.

## Start locally

Set the `ADMIN_KEY` environment variable to a long private value, then start the server with `npm start`.

Open the intake form at `http://localhost:3000/` and the admin dashboard at `http://localhost:3000/admin`.

For another device on the same network, use this computer's local IP address instead of `localhost`, for example `http://192.168.1.25:3000/`. Allow Node through the Windows firewall if needed.

## Deployment

Deploy this folder to a server with HTTPS. Set `ADMIN_KEY` in the hosting provider's environment settings. Do not commit the `data` folder or expose it publicly. The current demo stores records in `data/records.json`; use an encrypted database, authentication, backups, and appropriate privacy/security controls before using real identity or retirement records.

## Netlify

Deploy the repository as a Netlify site. The included `netlify.toml` publishes the `html` folder and discovers the function in `netlify/functions`. In Netlify site settings, add a long private `ADMIN_KEY` environment variable and enable Netlify Blobs for the site. The deployed form uses `/.netlify/functions/records`; the admin page uses the same function with the admin key.
