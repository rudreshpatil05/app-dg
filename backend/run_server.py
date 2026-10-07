import socket
from pathlib import Path

import uvicorn

PORT_FILE = Path(__file__).resolve().parent / ".server-port"


def get_available_port(start_port=8000, max_tries=20):
    port = start_port
    for _ in range(max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            result = sock.connect_ex(("127.0.0.1", port))
            if result != 0:
                return port
        port += 1
    raise RuntimeError(f"No available port found starting from {start_port}")


if __name__ == "__main__":
    port = get_available_port()
    PORT_FILE.write_text(str(port), encoding="utf-8")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
