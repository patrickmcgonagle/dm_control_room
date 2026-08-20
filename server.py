#!/usr/bin/env python3
"""DM Control Room - dependency-free local tabletop presentation server."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import socket
import ssl
import sys
import threading
import time
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MEDIA_DIR = ROOT / "media"
STATE_FILE = DATA_DIR / "state.json"
LIBRARY_CONFIG_FILE = DATA_DIR / "library_config.json"
CUSTOM_SPELL_LIBRARY_FILE = DATA_DIR / "custom_spells.json"
LOCK = threading.RLock()
PORT = int(os.environ.get("DM_PORT", "8765"))

DATA_DIR.mkdir(exist_ok=True)
MEDIA_DIR.mkdir(exist_ok=True)

LIBRARY_DEFS = {
    "maps": {"label": "Maps", "folder": "maps", "kinds": {"image", "video"}},
    "scene-art": {"label": "Scene Art", "folder": "scene-art", "kinds": {"image", "video"}},
    "music": {"label": "Music", "folder": "music", "kinds": {"audio"}},
    "ambience": {"label": "Ambience", "folder": "ambience", "kinds": {"audio"}},
    "sound-effects": {"label": "Sound Effects", "folder": "sound-effects", "kinds": {"audio"}},
    "tokens": {"label": "Tokens / Portraits", "folder": "tokens", "kinds": {"image"}},
    "handouts": {"label": "Handouts", "folder": "handouts", "kinds": {"image", "pdf"}},
}

for _library in LIBRARY_DEFS.values():
    (MEDIA_DIR / _library["folder"]).mkdir(parents=True, exist_ok=True)

EXT_KIND = {
    ".mp4": "video", ".webm": "video", ".ogv": "video", ".mkv": "video", ".mov": "video",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".webp": "image", ".svg": "image",
    ".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".m4a": "audio", ".aac": "audio", ".flac": "audio", ".opus": "audio",
    ".pdf": "pdf",
}

DEFAULT_STATE = {'campaign': 'Shadows of the Misty Forest',
 'session': 'Session 1',
 'displayMode': 'scene',
 'displayVisible': True,
 'currentSceneId': 'forest-intro',
 'round': 1,
 'turnIndex': 0,
 'players': [{'id': 'orc',
              'name': 'Orc Fighter',
              'hp': 14,
              'maxHp': 14,
              'ac': 16,
              'passive': 11,
              'initiative': 0,
              'condition': '',
              'speed': 30,
              'spellDC': '',
              'stats': {'str': '', 'dex': '', 'con': '', 'int': '', 'wis': '', 'cha': ''},
              'notes': ''},
             {'id': 'fairy',
              'name': 'Fairy Rogue',
              'hp': 9,
              'maxHp': 9,
              'ac': 14,
              'passive': 13,
              'initiative': 0,
              'condition': '',
              'speed': 30,
              'spellDC': '',
              'stats': {'str': '', 'dex': '', 'con': '', 'int': '', 'wis': '', 'cha': ''},
              'notes': ''},
             {'id': 'druid',
              'name': 'Elven Druid',
              'hp': 10,
              'maxHp': 10,
              'ac': 14,
              'passive': 12,
              'initiative': 0,
              'condition': '',
              'speed': 30,
              'spellDC': '',
              'stats': {'str': '', 'dex': '', 'con': '', 'int': '', 'wis': '', 'cha': ''},
              'notes': ''},
             {'id': 'apprentice',
              'name': 'Druid Apprentice',
              'hp': 9,
              'maxHp': 9,
              'ac': 13,
              'passive': 12,
              'initiative': 0,
              'condition': '',
              'speed': 30,
              'spellDC': '',
              'stats': {'str': '', 'dex': '', 'con': '', 'int': '', 'wis': '', 'cha': ''},
              'notes': ''},
             {'id': 'ranger',
              'name': 'Ranger',
              'hp': 12,
              'maxHp': 12,
              'ac': 15,
              'passive': 14,
              'initiative': 0,
              'condition': '',
              'speed': 30,
              'spellDC': '',
              'stats': {'str': '', 'dex': '', 'con': '', 'int': '', 'wis': '', 'cha': ''},
              'notes': ''}],
 'enemies': [],
 'initiative': [],
 'scenes': [{'id': 'forest-intro',
             'title': 'The Misty Forest',
             'subtitle': 'The deeper you travel, the quieter the forest becomes...',
             'image': '',
             'music': '',
             'ambience': '',
             'hueScene': '',
             'notes': 'Introduce the unnatural quiet. Flowers fail to bloom, leaves wilt, and the animals '
                      'have gone distant.',
             'tabletopMap': None},
            {'id': 'crossroads',
             'title': 'The Crossroads',
             'subtitle': 'Branches snap somewhere beyond the trail.',
             'image': '',
             'music': '',
             'ambience': '',
             'hueScene': '',
             'notes': 'The druids are attacked. The orc and fairy approach from different directions. The '
                      'ranger can provide a distant arrow if needed.',
             'tabletopMap': None},
            {'id': 'keep',
             'title': 'The Ruined Keep',
             'subtitle': 'A silent suit of armor stands beside the sealed entrance.',
             'image': '',
             'music': '',
             'ambience': '',
             'hueScene': '',
             'notes': 'Animated armor guards the closed door. This is the latest point for the ranger to '
                      'catch up.',
             'tabletopMap': None},
            {'id': 'cocoons',
             'title': 'The Cocoon Chamber',
             'subtitle': 'Something moves inside the web-wrapped shapes along the walls.',
             'image': '',
             'music': '',
             'ambience': '',
             'hueScene': '',
             'notes': 'Zombies rip free from spider cocoons and surround the party.',
             'tabletopMap': None},
            {'id': 'spider',
             'title': "The Spider's Lair",
             'subtitle': 'The web trembles. Something enormous descends from the darkness.',
             'image': '',
             'music': '',
             'ambience': '',
             'hueScene': '',
             'notes': 'Final level-one battle with the giant spider. Seed evidence that something '
                      'intelligent was directing it.',
             'tabletopMap': None}],
 'sfx': [],
 'audio': {'music': {'src': '', 'playing': False, 'volume': 0.65, 'seq': 0},
           'ambience': {'src': '', 'playing': False, 'volume': 0.5, 'seq': 0},
           'sfx': {'src': '', 'volume': 0.8, 'seq': 0}},
 'hue': {'bridgeIp': '', 'appKey': '', 'lastStatus': 'Not configured'},
 'updatedAt': 0,
 'tabletop': {'visible': True,
              'sourceType': 'none',
              'sourceKind': 'image',
              'sourceUrl': '',
              'sourceName': '',
              'youtubeUrl': '',
              'displayFit': 'fill',
              'playing': True,
              'loop': True,
              'muted': True,
              'playbackSeq': 0,
              'restartSeq': 0,
              'mapZoom': 100,
              'mapX': 0,
              'mapY': 0,
              'mapRotation': 0,
              'brightness': 100,
              'shape': 'circle',
              'maskWidth': 82,
              'maskHeight': 82,
              'maskX': 0,
              'maskY': 0,
              'maskRotation': 0,
              'gridEnabled': True,
              'gridType': 'square',
              'gridSize': 64,
              'gridOpacity': 0.55,
              'gridThickness': 1,
              'gridColor': '#ffffff',
              'gridOffsetX': 0,
              'gridOffsetY': 0,
              'fogEnabled': False,
              'fogOpacity': 0.65,
              'calibrationPattern': False,
              'measureMode': False,
              'locked': False,
              'profiles': [],
              'tokens': [],
              'tokensVisible': True,
              'tokenSnap': True,
              'tokenMovementLocked': False,
              'tokenShowNames': True,
              'outputWidth': 0,
              'outputHeight': 0,
              'sourceLibraryPath': '',
              'shareEnabled': False,
              'shareFullScreen': True,
              'shareAnimate': False}}


def load_state():
    with LOCK:
        if not STATE_FILE.exists():
            save_state(DEFAULT_STATE)
            return json.loads(json.dumps(DEFAULT_STATE))
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return json.loads(json.dumps(DEFAULT_STATE))


def save_state(state):
    state["updatedAt"] = time.time()
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def spell_key(value):
    return re.sub(r"\s+", " ", str(value or "").replace("’", "'").strip().lower())


def load_custom_spell_library():
    if not CUSTOM_SPELL_LIBRARY_FILE.exists():
        return []
    try:
        raw = json.loads(CUSTOM_SPELL_LIBRARY_FILE.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            raw = raw.get("spells", [])
        return raw if isinstance(raw, list) else []
    except Exception:
        return []


def save_custom_spell_library(spells):
    payload = {"version": 1, "updatedAt": time.time(), "spells": spells}
    tmp = CUSTOM_SPELL_LIBRARY_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(CUSTOM_SPELL_LIBRARY_FILE)


def _spell_classes(spell, character):
    classes = []
    for value in spell.get("classes", []) if isinstance(spell.get("classes"), list) else []:
        value = str(value or "").strip()
        if value and value not in classes:
            classes.append(value)
    sheet = character.get("sheet", {}) if isinstance(character.get("sheet"), dict) else {}
    char_class = str(sheet.get("className", "") or "").strip()
    source = str(spell.get("source", "") or "")
    known = ["Artificer","Bard","Cleric","Druid","Paladin","Ranger","Sorcerer","Warlock","Wizard"]
    if char_class and char_class not in classes:
        classes.append(char_class)
    for name in known:
        if re.search(r"\b" + re.escape(name) + r"\b", source, re.I) and name not in classes:
            classes.append(name)
    return classes


def _custom_spell_from_character(spell, character):
    if not isinstance(spell, dict):
        return None
    name = str(spell.get("name", "") or "").strip()
    if not name:
        return None
    if str(spell.get("librarySource", "") or "").strip().lower().startswith("srd 5.2.1"):
        return None
    try:
        level = int(spell.get("level", 0) or 0)
    except Exception:
        level = 0
    level = max(0, min(9, level))
    sid = str(spell.get("id", "") or "")
    library_source = str(spell.get("librarySource", "") or "").strip()
    if not library_source:
        library_source = "D&D Beyond Import" if sid.startswith("ddb_spell_") else "Custom / Imported"
    return {
        "id": "custom_" + re.sub(r"[^a-z0-9]+", "_", spell_key(name)).strip("_"),
        "name": name, "level": level,
        "source": str(spell.get("source", "") or ""),
        "school": str(spell.get("school", "") or ""),
        "classes": _spell_classes(spell, character),
        "castingTime": str(spell.get("castingTime", spell.get("time", "")) or ""),
        "range": str(spell.get("range", "") or ""),
        "saveAttack": str(spell.get("saveAttack", spell.get("save", "")) or ""),
        "components": str(spell.get("components", "") or ""),
        "duration": str(spell.get("duration", "") or ""),
        "ritual": bool(spell.get("ritual", False)),
        "concentration": bool(spell.get("concentration", False)),
        "notes": str(spell.get("notes", "") or ""),
        "description": str(spell.get("description", "") or ""),
        "librarySource": library_source,
        "updatedAt": time.time(),
    }


def learn_custom_spells_from_characters(characters):
    library = load_custom_spell_library()
    by_key = {spell_key(x.get("name")): x for x in library if isinstance(x, dict) and spell_key(x.get("name"))}
    changed = False
    for character in characters or []:
        if not isinstance(character, dict):
            continue
        sheet = character.get("sheet", {}) if isinstance(character.get("sheet"), dict) else {}
        for raw in sheet.get("spellbook", []) if isinstance(sheet.get("spellbook"), list) else []:
            item = _custom_spell_from_character(raw, character)
            if not item:
                continue
            key = spell_key(item["name"])
            old = by_key.get(key)
            if old is None:
                by_key[key] = item
                changed = True
                continue
            merged = dict(old)
            for field in ("name","source","school","castingTime","range","saveAttack","components","duration","notes","description","librarySource"):
                if item.get(field):
                    merged[field] = item[field]
            merged["level"] = item["level"]
            merged["ritual"] = bool(item.get("ritual", old.get("ritual", False)))
            merged["concentration"] = bool(item.get("concentration", old.get("concentration", False)))
            merged["classes"] = sorted(set([str(x) for x in old.get("classes", []) if x] + [str(x) for x in item.get("classes", []) if x]))
            if merged != old:
                merged["updatedAt"] = time.time()
                by_key[key] = merged
                changed = True
    spells = sorted(by_key.values(), key=lambda x: (int(x.get("level", 0) or 0), str(x.get("name", "")).lower()))
    if changed or (not CUSTOM_SPELL_LIBRARY_FILE.exists() and spells):
        save_custom_spell_library(spells)
    return spells


def learn_custom_spells_from_state(state):
    return learn_custom_spells_from_characters(state.get("players", []) if isinstance(state, dict) else [])


PROFILE_FIELDS = ("name", "portrait", "sheet", "playerEditable", "stats", "profileUpdatedAt")

def merge_newer_character_profiles(incoming, current):
    """Keep newer player-side character-sheet edits when a stale full state is posted."""
    current_players = {str(x.get("id", "")): x for x in current.get("players", []) if isinstance(x, dict)}
    for p in incoming.get("players", []) if isinstance(incoming, dict) else []:
        if not isinstance(p, dict):
            continue
        old = current_players.get(str(p.get("id", "")))
        if not old:
            continue
        try:
            old_ts = float(old.get("profileUpdatedAt", 0) or 0)
        except Exception:
            old_ts = 0
        try:
            new_ts = float(p.get("profileUpdatedAt", 0) or 0)
        except Exception:
            new_ts = 0
        if old_ts > new_ts:
            for field in PROFILE_FIELDS:
                if field in old:
                    p[field] = json.loads(json.dumps(old[field]))
    return incoming

def default_library_config():
    return {key: "" for key in LIBRARY_DEFS}


def load_library_config():
    if not LIBRARY_CONFIG_FILE.exists():
        return default_library_config()
    try:
        raw = json.loads(LIBRARY_CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = {}
    return {key: str(raw.get(key, "") or "").strip() for key in LIBRARY_DEFS}


def save_library_config(config):
    clean = {key: str(config.get(key, "") or "").strip() for key in LIBRARY_DEFS}
    tmp = LIBRARY_CONFIG_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(clean, indent=2), encoding="utf-8")
    tmp.replace(LIBRARY_CONFIG_FILE)


def library_root(key: str) -> Path:
    if key not in LIBRARY_DEFS:
        raise ValueError("Unknown media library")
    configured = load_library_config().get(key, "").strip()
    if configured:
        return Path(os.path.expandvars(os.path.expanduser(configured))).resolve()
    return (MEDIA_DIR / LIBRARY_DEFS[key]["folder"]).resolve()


def library_payload():
    config = load_library_config()
    libraries = []
    for key, info in LIBRARY_DEFS.items():
        root = library_root(key)
        libraries.append({
            "key": key,
            "label": info["label"],
            "path": config.get(key, ""),
            "effectivePath": str(root),
            "defaultPath": str((MEDIA_DIR / info["folder"]).resolve()),
            "exists": root.is_dir(),
        })
    return {"ok": True, "libraries": libraries}


def file_kind(path: Path):
    return EXT_KIND.get(path.suffix.lower(), "")


def encoded_rel_path(rel: Path) -> str:
    return "/".join(quote(part, safe="") for part in rel.parts)


def safe_under(root: Path, relative: str) -> Path:
    root = root.resolve()
    rel = Path(relative.replace("\\", "/").lstrip("/"))
    target = (root / rel).resolve()
    if target != root and root not in target.parents:
        raise PermissionError("Path is outside the configured library")
    return target


def media_item(root: Path, library: str, item: Path):
    rel = item.relative_to(root)
    return {
        "name": item.name,
        "relativePath": rel.as_posix(),
        "folder": rel.parent.as_posix() if rel.parent != Path(".") else "",
        "url": f"/library/{quote(library, safe='')}/{encoded_rel_path(rel)}",
        "kind": file_kind(item),
        "size": item.stat().st_size,
        "library": library,
    }


def browse_library(library: str, current_path: str = "", query: str = ""):
    if library not in LIBRARY_DEFS:
        raise ValueError("Unknown media library")
    root = library_root(library)
    allowed = LIBRARY_DEFS[library]["kinds"]
    current_path = (current_path or "").replace("\\", "/").strip("/")
    query = (query or "").strip().lower()
    if not root.is_dir():
        return {"ok": True, "library": library, "path": current_path, "exists": False, "folders": [], "files": [], "root": str(root)}
    current = safe_under(root, current_path)
    if not current.is_dir():
        current = root
        current_path = ""
    folders = []
    files = []
    if query:
        iterator = root.rglob("*")
        for item in iterator:
            try:
                if not item.is_file() or file_kind(item) not in allowed:
                    continue
                rel_text = item.relative_to(root).as_posix().lower()
                if query not in rel_text:
                    continue
                files.append(media_item(root, library, item))
                if len(files) >= 600:
                    break
            except (OSError, ValueError):
                continue
        files.sort(key=lambda x: x["relativePath"].lower())
    else:
        for item in sorted(current.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            try:
                if item.is_dir():
                    rel = item.relative_to(root)
                    folders.append({"name": item.name, "path": rel.as_posix()})
                elif item.is_file() and file_kind(item) in allowed:
                    files.append(media_item(root, library, item))
            except (OSError, ValueError):
                continue
    return {"ok": True, "library": library, "path": current_path, "exists": True, "folders": folders, "files": files, "root": str(root), "query": query}


def json_response(handler, payload, status=200):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length) if length else b"{}"
    return json.loads(raw.decode("utf-8"))


def safe_filename(name: str):
    name = Path(name).name
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-.") or "file"
    return f"{uuid.uuid4().hex[:8]}-{stem}"


def hue_request(state, method, path, body=None, headers=None):
    ip = state.get("hue", {}).get("bridgeIp", "").strip()
    if not ip:
        raise ValueError("Hue bridge IP is not configured")
    url = f"https://{ip}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_lan_ips():
    ips = []
    # Prefer the address Windows/macOS/Linux would use for outbound LAN traffic.
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith(("127.", "169.254.")):
                ips.append(ip)
        finally:
            sock.close()
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip and not ip.startswith(("127.", "169.254.")) and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


class Handler(BaseHTTPRequestHandler):
    server_version = "DMControlRoom/0.2"

    def log_message(self, fmt, *args):
        if urlparse(self.path).path == "/api/state":
            return
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        if path == "/api/state":
            return json_response(self, load_state())
        if path == "/api/network":
            return json_response(self, {"ok": True, "port": PORT, "lanIps": get_lan_ips()})
        if path == "/api/spell-library":
            try:
                with LOCK:
                    spells = learn_custom_spells_from_state(load_state())
                return json_response(self, {"ok": True, "spells": spells, "count": len(spells)})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)
        if path == "/api/libraries":
            return json_response(self, library_payload())
        if path == "/api/media":
            try:
                library = query.get("library", ["maps"])[0]
                current = query.get("path", [""])[0]
                search = query.get("q", [""])[0]
                return json_response(self, browse_library(library, current, search))
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)
        if path == "/api/hue/scenes":
            state = load_state()
            try:
                key = state.get("hue", {}).get("appKey", "")
                data = hue_request(state, "GET", "/clip/v2/resource/scene", headers={"hue-application-key": key})
                scenes = [{"id": x.get("id"), "name": x.get("metadata", {}).get("name", "Unnamed Hue scene")} for x in data.get("data", [])]
                return json_response(self, {"ok": True, "scenes": scenes})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)
        if path in ("/", "/dm", "/dm.html"):
            return self.serve_file(ROOT / "dm.html")
        if path in ("/player", "/player.html"):
            return self.serve_file(ROOT / "player.html")
        if path in ("/tabletop", "/tabletop.html"):
            return self.serve_file(ROOT / "tabletop.html")
        if path == "/README.md":
            return self.serve_file(ROOT / "README.md")
        if path.startswith("/library/"):
            try:
                rest = path[len("/library/"):]
                library, rel = rest.split("/", 1)
                root = library_root(library)
                target = safe_under(root, rel)
                return self.serve_file(target)
            except (ValueError, PermissionError):
                self.send_error(403)
                return
        if path.startswith("/media/"):
            rel = path[len("/media/"):]
            try:
                target = safe_under(MEDIA_DIR.resolve(), rel)
            except PermissionError:
                self.send_error(403)
                return
            return self.serve_file(target)
        if path.startswith("/static/"):
            target = (ROOT / path.lstrip("/")).resolve()
            return self.serve_file(target)
        self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/state":
            try:
                incoming = read_json(self)
                with LOCK:
                    current = load_state()
                    merge_newer_character_profiles(incoming, current)
                    learn_custom_spells_from_state(incoming)
                    save_state(incoming)
                return json_response(self, {"ok": True, "updatedAt": incoming.get("updatedAt")})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        if path == "/api/character":
            try:
                payload = read_json(self)
                char_id = str(payload.get("id", "")).strip()
                if not char_id:
                    raise ValueError("Character id is required")
                with LOCK:
                    current = load_state()
                    character = next((x for x in current.get("players", []) if str(x.get("id", "")) == char_id), None)
                    if not character:
                        raise ValueError("Character was not found")
                    if not character.get("playerEditable", False):
                        return json_response(self, {"ok": False, "error": "Player editing is disabled for this character"}, 403)
                    if "name" in payload:
                        name = str(payload.get("name", "")).strip()
                        if name:
                            character["name"] = name
                    if "portrait" in payload:
                        character["portrait"] = str(payload.get("portrait", "") or "")
                    sheet = payload.get("sheet")
                    if isinstance(sheet, dict):
                        character["sheet"] = sheet
                        if isinstance(sheet.get("stats"), dict):
                            character["stats"] = dict(sheet["stats"])
                    character["profileUpdatedAt"] = time.time()
                    tabletop = current.get("tabletop", {}) if isinstance(current.get("tabletop", {}), dict) else {}
                    for token in tabletop.get("tokens", []) if isinstance(tabletop.get("tokens", []), list) else []:
                        if isinstance(token, dict) and token.get("entityType") == "player" and str(token.get("entityId", "")) == char_id:
                            token["name"] = character.get("name", token.get("name", "Token"))
                            if character.get("portrait") and not token.get("image"):
                                token["image"] = character["portrait"]
                    current["updatedAt"] = time.time()
                    learn_custom_spells_from_characters([character])
                    save_state(current)
                return json_response(self, {"ok": True, "character": character})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        if path == "/api/tabletop/metrics":
            try:
                payload = read_json(self)
                width = max(0, int(float(payload.get("width", 0) or 0)))
                height = max(0, int(float(payload.get("height", 0) or 0)))
                with LOCK:
                    current = load_state()
                    tabletop = current.setdefault("tabletop", {})
                    tabletop["outputWidth"] = width
                    tabletop["outputHeight"] = height
                    current["updatedAt"] = time.time()
                    save_state(current)
                return json_response(self, {"ok": True, "width": width, "height": height})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        if path == "/api/libraries":
            try:
                payload = read_json(self)
                paths = payload.get("paths", payload) if isinstance(payload, dict) else {}
                save_library_config(paths)
                return json_response(self, library_payload())
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        if path == "/api/upload":
            try:
                original_name = parse_qs(parsed.query).get("name", [""])[0].strip()
                if not original_name:
                    raise ValueError("No file name supplied")
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0:
                    raise ValueError("No file selected")
                if length > 300 * 1024 * 1024:
                    raise ValueError("File is too large (300 MB maximum)")
                file_data = self.rfile.read(length)
                if len(file_data) != length:
                    raise ValueError("Upload ended unexpectedly")
                filename = safe_filename(original_name)
                out = MEDIA_DIR / filename
                out.write_bytes(file_data)
                return json_response(self, {"ok": True, "url": f"/media/{quote(filename)}", "name": original_name})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        if path == "/api/hue/pair":
            state = load_state()
            try:
                payload = read_json(self)
                ip = payload.get("bridgeIp", "").strip()
                if not ip:
                    raise ValueError("Enter the bridge IP first")
                state.setdefault("hue", {})["bridgeIp"] = ip
                response = hue_request(state, "POST", "/api", {"devicetype": "dm_control_room#local"})
                success = next((x.get("success") for x in response if "success" in x), None)
                if not success or not success.get("username"):
                    err = response[0].get("error", {}).get("description", "Pairing failed") if response else "Pairing failed"
                    raise ValueError(err)
                state["hue"]["appKey"] = success["username"]
                state["hue"]["lastStatus"] = "Paired"
                save_state(state)
                return json_response(self, {"ok": True, "appKey": success["username"]})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        if path == "/api/hue/recall":
            state = load_state()
            try:
                payload = read_json(self)
                scene_id = payload.get("sceneId", "").strip()
                if not scene_id:
                    raise ValueError("No Hue scene ID selected")
                key = state.get("hue", {}).get("appKey", "")
                if not key:
                    raise ValueError("Hue is not paired")
                data = hue_request(state, "PUT", f"/clip/v2/resource/scene/{scene_id}", {"recall": {"action": "active"}}, {"hue-application-key": key})
                state["hue"]["lastStatus"] = "Scene recalled"
                save_state(state)
                return json_response(self, {"ok": True, "response": data})
            except Exception as e:
                return json_response(self, {"ok": False, "error": str(e)}, 400)

        self.send_error(404)

    def serve_file(self, target: Path):
        if not target.exists() or not target.is_file():
            self.send_error(404)
            return
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        total = target.stat().st_size
        range_header = self.headers.get("Range", "")
        start = 0
        end = total - 1
        status = 200
        stream_media = ctype.startswith("video/") or ctype.startswith("audio/")
        max_media_chunk = 2 * 1024 * 1024
        if range_header.startswith("bytes="):
            m = re.match(r"bytes=(\d*)-(\d*)", range_header)
            if m:
                a, b = m.groups()
                if a:
                    start = max(0, int(a))
                    if b:
                        end = min(total - 1, int(b))
                    elif stream_media:
                        end = min(total - 1, start + max_media_chunk - 1)
                    else:
                        end = total - 1
                elif b:
                    length = min(total, int(b))
                    if stream_media:
                        length = min(length, max_media_chunk)
                    start = total - length
                if start <= end < total:
                    status = 206
        length = max(0, end - start + 1)
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
        self.send_header("Cache-Control", "no-cache" if ctype.startswith("text/") else "public, max-age=3600")
        self.end_headers()
        if self.command == "HEAD" or length <= 0:
            return
        with target.open("rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(128 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                    # Browser media elements cancel range requests during seeks and
                    # metadata probing. That is normal and should not take down the server.
                    return
                remaining -= len(chunk)

    def do_HEAD(self):
        # Reuse the GET routing; serve_file suppresses the body for HEAD requests.
        return self.do_GET()


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("\nDM Control Room")
    print(f"DM screen:     http://localhost:{PORT}")
    print(f"Player screen: http://localhost:{PORT}/player")
    print(f"Tabletop:      http://localhost:{PORT}/tabletop")
    print(f"Player table:  http://localhost:{PORT}/tabletop?share=1")
    print("For a TV/other device on the same network, replace localhost with this computer's LAN IP.")
    print("Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
