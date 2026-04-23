import json
import os
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


PORT = int(os.environ.get("PORT", "4173"))
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DATA_FILE = os.path.join(DATA_DIR, "events.json")

SEED_EVENTS = [
    {
        "id": str(uuid.uuid4()),
        "name": "デベロゴン",
        "start": "2026-04-01",
        "end": "2026-04-19",
        "interview": "2026-04-11",
        "fill": "#dff4dc",
        "ink": "#255725",
    },
    {
        "id": str(uuid.uuid4()),
        "name": "ブイプロ",
        "start": "2026-04-18",
        "end": "2026-04-27",
        "interview": "2026-04-24",
        "fill": "#e0edf8",
        "ink": "#1f4b77",
    },
    {
        "id": str(uuid.uuid4()),
        "name": "なおき",
        "start": "2026-04-18",
        "end": "2026-04-27",
        "interview": "2026-04-25",
        "fill": "#f6e9d7",
        "ink": "#7b4f1f",
    },
]


def ensure_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(SEED_EVENTS, f, ensure_ascii=False, indent=2)


def read_events():
    ensure_data_file()
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def write_events(events):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)


class CalendarHandler(SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/events":
            self._send_json({"events": read_events()})
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/events":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw) if raw else {}

            required = ["name", "start", "end", "interview", "fill", "ink"]
            if not all(k in payload and payload[k] for k in required):
                self._send_json({"error": "invalid payload"}, status=400)
                return

            events = read_events()
            new_event = {"id": str(uuid.uuid4()), **payload}
            events.append(new_event)
            write_events(events)
            self._send_json({"event": new_event}, status=201)
            return
        self._send_json({"error": "not found"}, status=404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/events/"):
            event_id = parsed.path.split("/")[-1]
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw) if raw else {}

            events = read_events()
            updated = None
            next_events = []
            for event in events:
                if event["id"] == event_id:
                    updated = {**event, **payload, "id": event_id}
                    next_events.append(updated)
                else:
                    next_events.append(event)

            if not updated:
                self._send_json({"error": "not found"}, status=404)
                return

            write_events(next_events)
            self._send_json({"event": updated})
            return
        self._send_json({"error": "not found"}, status=404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/events":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw) if raw else {}
            ids = payload.get("ids", [])
            if not isinstance(ids, list):
                self._send_json({"error": "invalid ids"}, status=400)
                return

            events = read_events()
            next_events = [e for e in events if e["id"] not in ids]
            write_events(next_events)
            self._send_json({"deleted": len(events) - len(next_events)})
            return

        if parsed.path.startswith("/api/events/"):
            event_id = parsed.path.split("/")[-1]
            events = read_events()
            next_events = [e for e in events if e["id"] != event_id]
            if len(next_events) == len(events):
                self._send_json({"error": "not found"}, status=404)
                return
            write_events(next_events)
            self._send_json({"ok": True})
            return
        self._send_json({"error": "not found"}, status=404)


if __name__ == "__main__":
    ensure_data_file()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), CalendarHandler)
    print(f"Server started on port {PORT}")
    server.serve_forever()
