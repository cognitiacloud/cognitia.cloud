#!/usr/bin/env python3
"""Guarded ElevenLabs TTS helper (only invoked when ALLOW_CREDIT_CALLS=true).
Reads script.md, strips markdown, requests speech, writes mp3. Spends credits.
Usage: _eleven_tts.py <script.md> <out.mp3> <voice_id> <api_key>
"""
import sys, re, json, urllib.request

md, out, vid, key = sys.argv[1:5]
text = open(md, encoding="utf-8").read()
text = re.sub(r"(?m)^\s*(#|>|\*\*\[).*$", "", text)
text = " ".join(text.split())[:2400]
req = urllib.request.Request(
    f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
    data=json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode(),
    headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
)
with urllib.request.urlopen(req, timeout=120) as r:
    open(out, "wb").write(r.read())
print("vo.mp3 written")
