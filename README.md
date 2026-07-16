# OGG Operations Dashboard v2.0

A collaborative PDU status board for the OGG video wall's 55-PDU screen housing, built for a 6-person IT technician team.

## Project structure

```
OGG-Operations-Dashboard/
├── index.html          # page shell — open this file (or its hosted URL) to run the app
├── css/
│   ├── theme.css        # color variables, base page styles
│   └── panels.css        # every component's styling (grid, panels, modals, etc.)
├── js/
│   ├── sync.js            # SP_CONFIG, MSAL auth, SharePoint/Graph sync, shared STATE object
│   ├── pdu.js               # 55-PDU grid rendering, flags, tooltip, PDU edit panel
│   ├── ops.js                 # technician roster, health card, active issues, activity feed
│   ├── extras.js                # inventory table, ticker strip, system notes banner, export/import, site & vendor info panel
│   └── app.js                     # wires everything together and boots the app
└── docs/
    └── SETUP.md          # step-by-step SharePoint / Microsoft 365 connection guide
```

## What's implemented

- **55-PDU grid** — 11×5 layout, three status colors (green/Active, red/Inactive-Broken, amber/Maintenance), clean bold-text background so every dot is easy to read.
- **PDU flags** — any PDU with a note gets a small flag icon on the grid, so open issues are visible at a glance.
- **Technician roster** — editable list (defaults to 6 blank slots), each with an Active/Idle toggle.
- **Technician radial** — the PDU editor lets a tech select who's working an issue from the roster; **closing a note requires selecting a name first** (verification step).
- **Active Issues panel** — live list of every PDU with an open note; click one to jump straight to it.
- **IT Department Tasks board** — a general work/task tracker *not* tied to any specific PDU (e.g. "order more UPS batteries," "quarterly maintenance sweep"). Title, assigned technician, status (Open / In Progress / Done), due date, and notes — synced to the whole team the same way as everything else.
- **"View Active Notes"** toolbar button replaces the old "Clear All Notes" — opens a modal listing every PDU with a note.
- **Health card** — live counts and a bar showing Active / Inactive / Maintenance split across all 55 PDUs.
- **Activity feed** — chronological log of status changes, notes, and closures (who, what, when).
- **Lightweight attachments** — attach small photos/files (capped ~180KB each) to a PDU's note.
- **Static System Notes banner** — large, non-scrolling, bold text at the top of the page for the OGG Ticker / iCandy info, always readable.
- **Working Export/Import** — JSON and CSV export use a reliable Blob-download pattern; JSON import merges into existing data.
- **Equipment Inventory** — collapsible Part/Qty/Notes table, minimum 5 rows.
- **Site & Vendor Info panel** — floating, draggable, local-only (never synced) panel for location, server info, login credentials, and vendor/replacement contact.
- **SharePoint / Microsoft 365 sync** — when connected (see `docs/SETUP.md`), PDU statuses, notes, technician roster, inventory, activity feed, and system notes all sync across the whole team automatically (~20s polling). Falls back to local-only/offline mode automatically if not configured or not signed in.

## Running it

- **Quick local test (no SharePoint):** open `index.html` directly in a browser. Everything works, but stays in that one browser only.
- **Team-shared mode:** follow `docs/SETUP.md` to register an Azure AD app and create the SharePoint list, then host this folder somewhere reachable at `https://` and fill in `SP_CONFIG` in `js/sync.js`.

## Known limitations / good next steps

- **Attachments are inline, not a document library.** Fine for small screenshots; not meant for large manuals or many files per PDU. A real SharePoint document library integration would be the next step if you need that.
- **Sync is polling-based (~20s), not push/websocket.** Good enough for a small team checking status, but there's a short delay before you see someone else's update. A "Refresh Now" button is provided for an immediate pull.
- **Last-write-wins.** If two people edit the exact same PDU within the same ~20s window, whichever save lands last on the server wins — there's no conflict merge.
- **No login/authentication for the app itself beyond the Microsoft 365 sign-in.** Anyone with the site URL and a Microsoft account with SharePoint access can view/edit. If you need per-user permissions beyond what SharePoint's own sharing controls give you, that would need a real backend.
