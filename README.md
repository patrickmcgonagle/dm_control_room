# DM Control Room

A free, local-first **5E-compatible** game-master dashboard for running an in-person tabletop campaign with separate DM, player-display, and tabletop-projector screens.

Current packaged version: **v2.15.3**

## What it does

- Private DM dashboard for party/enemy HP, AC, initiative, conditions, notes, and creature stats
- Character sheets with D&D Beyond PDF import for user-supplied character exports
- Shared SRD 5.2.1 spell library plus a local reusable custom/imported spell library
- Equipment/loadout management
- Printable spell and equipment cards
- Scene control for player artwork, music, ambience, optional Hue scene, and an assigned tabletop map/video
- Separate Player Screen and Tabletop Screen
- Projector masks for rectangle, square, circle, and oval tables
- Square/hex grid overlay with physical 1-inch calibration
- Movable player/enemy minis and cards
- Local image/video maps plus optional YouTube embeds
- Recursive media libraries, favorites/recent files, and cached still thumbnails for video maps
- Optional read-only tabletop sharing to players on the same LAN
- Optional Philips Hue local-bridge integration

## Included demo campaign

A small original starter scenario, **Shadows of the Misty Forest**, is included in `data/default_state.json` so a fresh install has characters and scenes to explore immediately. It includes the Misty Forest opening, crossroads encounter, ruined keep, cocoon chamber, and spider-lair scenes.

The demo contains **text/data only**. No Wizards artwork, book scans, purchased maps, downloaded videos, music, D&D Beyond PDFs, or other third-party media are bundled.

The Misty Forest name/location is a Wizards of the Coast setting reference used as free, unofficial fan content. See `NOTICE.md`.

## Windows quick start

No Python installation is required on Windows.

1. Download or clone the repository.
2. Double-click `start_windows.bat`.
3. Keep the PowerShell server window open while using the app.
4. The DM Screen opens at `http://localhost:8765`.

Other views:

- Player Screen: `http://localhost:8765/player`
- Tabletop Screen: `http://localhost:8765/tabletop`

For another device on the same private network, replace `localhost` with the DM computer's local IPv4 address.

## Important network note

DM Control Room is designed for a **trusted local network**. It has no user authentication and should **not be exposed directly to the public internet**.

## Media libraries

The app creates local media folders under `media/` for maps, scene art, music, ambience, sound effects, tokens, and handouts. You can also point those libraries to folders elsewhere on your computer from **Settings → Media Libraries**.

The public repository intentionally contains **no media assets**. Only use and redistribute media you have the rights to use. Downloaded videos, commercial battlemaps, purchased game assets, music, character art, and other user-supplied media should remain local unless their licenses explicitly permit redistribution.

## Local/private data

The following runtime files are intentionally ignored by Git:

- `data/state.json` — campaign, characters, scenes, tabletop state, and Hue configuration
- `data/custom_spells.json` — reusable custom/imported spell entries
- `data/library_config.json` — local media-library paths
- `media/**` — user-supplied media

These files can contain private information or content that you may not have redistribution rights for.

## Spell/rules content

The repository includes a bundled SRD 5.2.1 spell database. See [`NOTICE.md`](NOTICE.md) for SRD attribution and license information.

The custom/imported spell library is local runtime data and is not included in the repository. This is intentional: imported character data can contain material outside the SRD.

## D&D Beyond PDF import

The importer reads data from a character PDF supplied locally by the user. No D&D Beyond PDFs, book scans, logos, artwork, or purchased content are included with this repository.

## YouTube

YouTube maps are displayed through an embedded player. The repository does not include downloaded YouTube videos. Users are responsible for complying with the rights and terms applicable to any media they use.

## Philips Hue

Hue support is optional and communicates with a Hue Bridge on the local network. Hue application keys are stored in local runtime state and are excluded from Git.

## Water.org

DM Control Room is free. The app contains a small optional **Donate to Water.org** link that opens Water.org's official donation page directly. DM Control Room is not affiliated with or endorsed by Water.org, and no Water.org logo or branding is bundled.

## Licensing

- **Original DM Control Room code and original repository material:** PolyForm Noncommercial License 1.0.0 — see [`LICENSE`](LICENSE). You may use, modify, and share it for noncommercial purposes. The license does not grant commercial use.
- **SRD 5.2.1-derived rules material:** CC BY 4.0 — see [`NOTICE.md`](NOTICE.md). The SRD license is separate and permits uses according to its own terms.
- **Wizards setting references in the demo:** used as free, unofficial fan content under Wizards of the Coast's Fan Content Policy; see [`NOTICE.md`](NOTICE.md).

Because of the noncommercial software license, this repository is public/source-available but is **not OSI open-source software**.

## Repository hygiene

Before committing, run `git status` and make sure no live campaign state, custom imported spells, local media, PDFs, API keys, personal file paths, or generated ZIPs are being added. The included `.gitignore` covers the normal runtime locations.
