#!/usr/bin/env python3
"""
Hermes Bridge — local MCP server connecting Claude Desktop / Claude Code to the
Cognitia Episode-002 pipeline (Hermes agent + Codex CLI + V7 renderer + QC).

Transport:
  * default  -> MCP stdio  (how Claude Desktop launches it; NOT network-exposed)
  * --http [port]          -> localhost-only JSON bridge fallback (127.0.0.1)
  * --selftest             -> print a harmless status() result and exit

Safety:
  * read-only by default; copies only (never moves/deletes user files)
  * logs every action to bridge.log
  * 60s final render, Telegram publish, and HeyGen/ElevenLabs credit use are
    GATED behind confirm=true (+ env flags). They refuse otherwise.

Tools (Claude sees them as hermes.<name>):
  hermes.status  hermes.search_assets  hermes.run_job
  hermes.render_preview  hermes.qc  hermes.get_artifacts
"""
from __future__ import annotations
import os, sys, json, time, shutil, platform, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent          # .../tools/hermes_bridge
TOOLS = HERE.parent                              # .../tools
EP_DIR = TOOLS.parent                            # .../hermes/episodes/ep002
def _repo_root() -> Path:
    try:
        out = subprocess.run(["git", "-C", str(EP_DIR), "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=10)
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip())
    except Exception:
        pass
    return EP_DIR.parents[2]
REPO = _repo_root()
SF = EP_DIR / "style_frames"
RUN = EP_DIR / "assets" / "run41"
SHOTS = RUN / "shots"
OUTDIR = EP_DIR / "out"
VISION = REPO / "hermes" / "skills" / "vision-skill" / "vision_skill.py"
LOG = HERE / "bridge.log"
MEDIA_EXT = (".mp4", ".mov", ".webm", ".mkv", ".mp3", ".wav", ".m4a", ".png", ".jpg", ".jpeg", ".webp")

def _py() -> str:
    for c in (EP_DIR / ".venv" / "bin" / "python", EP_DIR / ".venv" / "Scripts" / "python.exe"):
        if c.exists():
            return str(c)
    return sys.executable

def _log(action: str, detail: str = "") -> None:
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')}\t{action}\t{detail}\n")
    except Exception:
        pass

def _which(name: str) -> str | None:
    return shutil.which(name)

def _run(cmd: list[str], cwd: Path | None = None, env: dict | None = None, timeout: int = 1800) -> dict:
    _log("exec", " ".join(map(str, cmd)))
    e = os.environ.copy()
    if env:
        e.update(env)
    try:
        p = subprocess.run([str(c) for c in cmd], cwd=str(cwd) if cwd else None, env=e,
                           capture_output=True, text=True, timeout=timeout)
        tail = (p.stdout or "")[-4000:] + (("\n[stderr]\n" + p.stderr[-2000:]) if p.stderr else "")
        return {"returncode": p.returncode, "log": tail}
    except subprocess.TimeoutExpired:
        return {"returncode": 124, "log": f"timeout after {timeout}s"}
    except Exception as ex:  # noqa
        return {"returncode": 1, "log": f"error: {ex}"}

def _search_dirs() -> list[Path]:
    home = Path.home()
    user = os.environ.get("USER") or os.environ.get("USERNAME") or ""
    cands = [home / "Downloads", home / "Desktop", home / "Pictures",
             home / "Pictures" / "Screenshots", home / "Videos", home / "cognitia-run"]
    if user:
        base = Path(f"/mnt/c/Users/{user}")
        cands += [base / "Downloads", base / "Desktop", base / "Pictures",
                  base / "Pictures" / "Screenshots", base / "Videos", base / "OneDrive"]
    extra = os.environ.get("COGNITIA_ASSETS_DIR")
    if extra:
        cands.append(Path(extra))
    return [c for c in cands if c.exists()]

def _slot_guess(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ("heygen", "avatar", "talking", "facial")): return "heygen"
    if any(k in n for k in ("eleven", "11labs", "voice", "vo", "narration", "audio")): return "elevenlabs"
    if any(k in n for k in ("telegram", "delivery", "delivered")): return "telegram"
    if any(k in n for k in ("qc", "quality", "vision", "score", "brand")): return "qc"
    if any(k in n for k in ("claude", "script", "hermes")): return "claude_script"
    if any(k in n for k in ("ffmpeg", "compose", "render", "log", "terminal")): return "ffmpeg"
    return ""

# ----------------------------------------------------------------------
# Tool implementations (plain functions; wrapped for MCP or HTTP)
# ----------------------------------------------------------------------
def _status() -> dict:
    def git(*a):
        r = subprocess.run(["git", "-C", str(REPO), *a], capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    slots = {s: (SHOTS / f"{s}.png").exists() for s in ("heygen", "elevenlabs", "telegram", "qc")}
    codex = _which("codex")
    codex_ver = ""
    if codex:
        try:
            codex_ver = subprocess.run([codex, "--version"], capture_output=True, text=True, timeout=10).stdout.strip()
        except Exception:
            codex_ver = "unknown"
    out = {
        "ok": True,
        "repo": str(REPO),
        "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
        "head": git("rev-parse", "--short", "HEAD"),
        "head_subject": git("log", "-1", "--pretty=%s"),
        "clean": git("status", "--porcelain") == "",
        "hermes_bin": os.environ.get("HERMES_BIN") or _which("hermes") or None,
        "codex": {"path": codex, "version": codex_ver} if codex else None,
        "python": _py(),
        "renderer": {"preview": (SF / "animate.py").exists(), "final_60s": (SF / "final_ep002.py").exists()},
        "assets_real": {**{f"{k}.png": v for k, v in slots.items()},
                        "vo.mp3": (RUN / "vo.mp3").exists(), "avatar.mp4": (RUN / "avatar.mp4").exists()},
        "placeholders": [k for k, v in slots.items() if not v],
        "artifacts_dir": str(OUTDIR),
        "vision_skill": str(VISION) if VISION.exists() else None,
        "gates": "60s/telegram/credits require confirm=true",
    }
    _log("status", out["head"])
    return out

def _search_assets(query: str = "", slot: str = "", limit: int = 40) -> dict:
    kw = [w for w in (query or "").lower().split() if w]
    if slot:
        kw += {"heygen": ["avatar", "heygen", "talking", "facial"], "elevenlabs": ["voice", "eleven", "vo"],
               "telegram": ["telegram", "delivery"], "qc": ["qc", "vision", "score"]}.get(slot, [slot])
    hits = []
    for d in _search_dirs():
        for root, _dirs, files in os.walk(d):
            for fn in files:
                low = fn.lower()
                if not low.endswith(MEDIA_EXT):
                    continue
                if kw and not any(k in low for k in kw):
                    continue
                p = Path(root) / fn
                try:
                    st = p.stat()
                except Exception:
                    continue
                hits.append({"path": str(p), "name": fn, "size": st.st_size,
                             "modified": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st.st_mtime)),
                             "likely_slot": _slot_guess(fn)})
            if len(hits) > 600:
                break
    hits.sort(key=lambda h: h["modified"], reverse=True)
    _log("search_assets", f"q='{query}' slot='{slot}' -> {len(hits)}")
    return {"ok": True, "count": len(hits), "searched": [str(d) for d in _search_dirs()], "candidates": hits[:limit],
            "note": "read-only listing; nothing copied. Use run_job to place + render."}

def _qc(image_path: str, mode: str = "privacy") -> dict:
    p = Path(image_path)
    if not p.exists():
        return {"ok": False, "error": f"not found: {image_path}"}
    if not VISION.exists():
        return {"ok": False, "error": "vision_skill.py not found"}
    flag = "--frame" if mode == "frameqc" else "--image"
    r = _run([_py(), str(VISION), ("frameqc" if mode == "frameqc" else mode), flag, str(p)], timeout=180)
    try:
        data = json.loads(r["log"].strip().splitlines()[-1])
    except Exception:
        data = {"raw": r["log"]}
    _log("qc", f"{mode} {p.name} rc={r['returncode']}")
    return {"ok": r["returncode"] == 0, "mode": mode, "result": data}

def _render_preview() -> dict:
    if not (SF / "animate.py").exists():
        return {"ok": False, "error": "animate.py missing"}
    r = _run([_py(), "animate.py"], cwd=SF, env={"COG_S": "1"}, timeout=1200)
    OUTDIR.mkdir(parents=True, exist_ok=True)
    out_mp4 = OUTDIR / "preview_real.mp4"
    src = SF / "preview.mp4"
    if src.exists():
        shutil.copy2(src, out_mp4)
        sc = SF / "preview_contact.png"
        if sc.exists():
            shutil.copy2(sc, OUTDIR / "preview_contact.png")
    _log("render_preview", f"rc={r['returncode']}")
    return {"ok": r["returncode"] == 0 and out_mp4.exists(), "preview": str(out_mp4) if out_mp4.exists() else None,
            "contact": str(OUTDIR / "preview_contact.png"), "log_tail": r["log"][-1500:]}

def _get_artifacts() -> dict:
    items = []
    if OUTDIR.exists():
        for p in sorted(OUTDIR.glob("*")):
            if p.is_file():
                st = p.stat()
                items.append({"path": str(p), "name": p.name, "size": st.st_size,
                              "modified": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st.st_mtime))})
    _log("get_artifacts", f"{len(items)}")
    return {"ok": True, "out_dir": str(OUTDIR), "artifacts": items}

def _run_job(approve: bool = False, allow_credit_calls: bool = False, send_telegram: bool = False,
             confirm: bool = False) -> dict:
    """Run the Hermes/deterministic pipeline. Gated actions require confirm=true."""
    gated = [n for n, v in (("approve(60s final)", approve), ("allow_credit_calls", allow_credit_calls),
                            ("send_telegram", send_telegram)) if v]
    if gated and not confirm:
        return {"ok": False, "blocked": True, "needs_confirmation": gated,
                "message": "Re-call with confirm=true to authorize: " + ", ".join(gated)}
    is_win = platform.system() == "Windows"
    if is_win:
        script = TOOLS / "run_hermes_ep002.ps1"
        cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script)]
        if approve:
            cmd.append("-Approve")
    else:
        script = TOOLS / "run_hermes_ep002.sh"
        cmd = ["bash", str(script)]
    env = {"APPROVE": "true" if approve else "false",
           "ALLOW_CREDIT_CALLS": "true" if allow_credit_calls else "false",
           "SEND_TELEGRAM": "true" if send_telegram else "false"}
    r = _run(cmd, cwd=REPO, env=env, timeout=3600)
    _log("run_job", f"approve={approve} credit={allow_credit_calls} tg={send_telegram} rc={r['returncode']}")
    return {"ok": r["returncode"] == 0, "approved": approve, "log_tail": r["log"][-3000:],
            "artifacts": _get_artifacts()["artifacts"]}

TOOLSPEC = [
    ("hermes.status", _status, "Project status: branch, commit, Hermes/Codex detection, real-vs-placeholder slots, artifacts."),
    ("hermes.search_assets", _search_assets, "Read-only search of local folders for candidate media (query/slot). Copies nothing."),
    ("hermes.run_job", _run_job, "Run the pipeline (resolve->derive->QC->preview). 60s/credits/telegram need confirm=true."),
    ("hermes.render_preview", _render_preview, "Render the all-real V7 12s preview -> out/preview_real.mp4."),
    ("hermes.qc", _qc, "Run vision_skill QC on an image (mode=privacy|frameqc|analyze)."),
    ("hermes.get_artifacts", _get_artifacts, "List rendered artifacts in out/."),
]

# ----------------------------------------------------------------------
def _serve_stdio():
    # stdio transport speaks JSON-RPC over stdout. A startup crash here is the
    # usual cause of "the server keeps restarting": Claude relaunches whatever
    # exited. We log the full reason to bridge.log (durable) instead of only a
    # stderr line that vanishes, so the loop is diagnosable after the fact.
    import traceback
    _log("startup", f"py={sys.version.split()[0]} argv={sys.argv[1:]} cwd={os.getcwd()}")
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as ex:
        _log("fatal", f"cannot import 'mcp': {ex!r}")
        sys.stderr.write(
            "[hermes-bridge] FATAL: cannot import 'mcp'; the stdio server cannot start.\n"
            f"  detail: {ex}\n"
            "  fix: run start_bridge.(sh|ps1) once (installs deps), or: pip install 'mcp>=1.0'\n")
        sys.exit(2)
    try:
        try:
            import mcp as _mcpmod
            _log("startup", f"mcp_version={getattr(_mcpmod, '__version__', '?')}")
        except Exception:
            pass
        mcp = FastMCP("hermes")
        for name, fn, desc in TOOLSPEC:
            # Tolerate add_tool signature drift across mcp SDK versions.
            try:
                mcp.add_tool(fn, name=name, description=desc)
            except TypeError:
                try:
                    mcp.add_tool(fn, name=name)
                except Exception as ex:
                    _log("warn", f"register {name} failed: {ex!r}")
            except Exception as ex:
                _log("warn", f"register {name} failed: {ex!r}")
        _log("serve", "stdio")
        mcp.run()
    except SystemExit:
        raise
    except BaseException as ex:  # log the real reason before we die
        _log("fatal", f"stdio serve crashed: {ex!r}\n{traceback.format_exc()}")
        sys.stderr.write("[hermes-bridge] FATAL during stdio serve; see bridge.log next to server.py.\n")
        raise

def _serve_http(port: int = 8765):
    from http.server import BaseHTTPRequestHandler, HTTPServer
    fmap = {name: fn for name, fn, _ in TOOLSPEC}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):  # quiet
            pass
        def _send(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        def do_GET(self):
            if self.path.rstrip("/") in ("", "/health"):
                self._send(200, {"ok": True, "tools": list(fmap)})
            else:
                self._send(404, {"ok": False})
        def do_POST(self):
            name = self.path.strip("/").split("/")[-1]
            if name not in fmap:
                return self._send(404, {"ok": False, "error": f"unknown tool {name}"})
            ln = int(self.headers.get("Content-Length", 0) or 0)
            args = json.loads(self.rfile.read(ln) or b"{}") if ln else {}
            try:
                self._send(200, fmap[name](**args))
            except Exception as ex:  # noqa
                self._send(500, {"ok": False, "error": str(ex)})

    _log("serve", f"http 127.0.0.1:{port}")
    try:
        httpd = HTTPServer(("127.0.0.1", port), H)   # bind localhost ONLY
    except OSError as ex:
        _log("fatal", f"http bind 127.0.0.1:{port} failed: {ex!r}")
        sys.stderr.write(f"[hermes-bridge] cannot bind 127.0.0.1:{port} ({ex}); is it already running?\n")
        sys.exit(1)
    print(f"[hermes-bridge] localhost HTTP on http://127.0.0.1:{port} (not exposed publicly)")
    httpd.serve_forever()

def main():
    args = sys.argv[1:]
    if "--selftest" in args:
        print(json.dumps(_status(), indent=2)); return
    if "--http" in args:
        i = args.index("--http")
        port = int(args[i + 1]) if i + 1 < len(args) and args[i + 1].isdigit() else 8765
        _serve_http(port); return
    _serve_stdio()

if __name__ == "__main__":
    main()
