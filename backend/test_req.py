import urllib.request
import urllib.error

try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/tickets")
    response = urllib.request.urlopen(req, timeout=5)
    print("STATUS:", response.status)
    print("BODY:", response.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode())
except Exception as e:
    print("ERROR:", str(e))
