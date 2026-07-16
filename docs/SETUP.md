# OGG PDU Dashboard — SharePoint / Microsoft 365 Setup Guide

This dashboard can run in two modes:

- **Local-only mode** (default, no setup needed): each technician's data stays in their own browser. Fine for testing, not shared.
- **SharePoint-connected mode**: all 6 technicians see the same PDU statuses, notes, technician roster, and inventory, refreshed automatically every ~20 seconds. This requires the one-time setup below, done by your M365/SharePoint admin.

The file must also be **hosted at a real https:// URL** your team can browse to (a SharePoint site page, a document library link, or any internal web server). Microsoft sign-in will not work if the file is just double-clicked from a folder (`file://`) — that's a Microsoft security restriction, not something this file can work around.

---

## Step 1 — Create a SharePoint list

On the SharePoint site your team will use, create **one list**:

- **List name:** `OGG_Dashboard_Data`
- **Columns:**
  | Column name | Type |
  |---|---|
  | `Title` | Single line of text (this is the default column — just use it) |
  | `Payload` | Multiple lines of text — set to **Plain text**, not "Enhanced rich text" |

That's it — just those two columns. The app stores everything else (PDU statuses, notes, technicians, inventory) as JSON inside `Payload`, using `Title` as a key (`PDU_DATA`, `TECHNICIANS`, `INVENTORY`, `SYSTEM_NOTES`). The app creates these four rows automatically the first time each type of data is saved — you don't need to create the rows yourself.

Note the **site URL**, e.g. `https://yourtenant.sharepoint.com/sites/OGGOperations` — you'll need it in Step 3.

---

## Step 2 — Register an Azure AD (Entra) App

In the [Azure Portal](https://portal.azure.com) or [Entra admin center](https://entra.microsoft.com):

1. **App registrations → New registration**
   - Name: `OGG PDU Dashboard`
   - Supported account types: **Single tenant** (accounts in your organization only)
   - Redirect URI: platform = **Single-page application (SPA)**, URL = the exact `https://` URL where this file will be hosted (e.g. the SharePoint page URL you'll publish it to)
   - Click **Register**
2. From the **Overview** page, copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**
3. Go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**
   - Add `Sites.ReadWrite.All`
   - Click **Grant admin consent** (requires a Global/SharePoint admin)

   *More secure alternative:* use `Sites.Selected` instead, then have an admin grant the app access to only the one SharePoint site (via PnP PowerShell's `Grant-PnPAzureADAppSitePermission` or the Graph `sites/{id}/permissions` API). This avoids giving the app access to every site in your tenant. Ask your M365 admin if this matters for your organization's policy.

---

## Step 3 — Fill in the config block

Open the HTML file and find the `SP_CONFIG` block near the top of the `<script>` section:

```js
const SP_CONFIG = {
  enabled: true,
  tenantId: "YOUR_TENANT_ID",
  clientId: "YOUR_CLIENT_ID",
  siteHostname: "yourtenant.sharepoint.com",
  sitePath: "/sites/OGGOperations",
  listName: "OGG_Dashboard_Data",
  syncIntervalMs: 20000
};
```

Replace the placeholder values with what you gathered in Steps 1–2. Set `enabled: false` at any time to force the tool back into local-only/offline mode (useful for testing without touching SharePoint).

---

## Step 4 — Host and test

1. Upload the `.html` file to a document library on your SharePoint site, or host it on any internal web server reachable over `https://`.
2. Browse to it — you should see a **"Sign in with Microsoft 365"** button in the top status bar.
3. Sign in with an account that has access to the SharePoint site.
4. Make a small change (add a technician, edit a PDU note) and confirm it shows up when another technician opens the same URL.

If sign-in or sync fails, the browser's developer console (F12 → Console) will show the specific Graph API error — that's the fastest way to tell whether it's a permissions issue, a wrong site path, or a missing list/column.

---

## What is *not* synced to SharePoint (by design)

The floating **"Site & Vendor Info"** panel (location, server info, login credentials, vendor contact) stays **local to each browser only** — it is never sent to SharePoint. Login credentials in particular shouldn't be stored in a shared list in plain text. If your team wants that panel shared too, a safer approach is a secrets manager or a restricted SharePoint list with limited read permissions — let me know if you'd like that wired up separately.
