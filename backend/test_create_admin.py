import urllib.request
import json
import uuid

# First get a token as super admin
try:
    data = b"username=super@helpdesk.com&password=super123"
    req = urllib.request.Request("http://127.0.0.1:8000/api/auth/token", data=data)
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        token = res["access_token"]
        print("Got token")
except Exception as e:
    print("Token failed:", e)
    token = None

if token:
    try:
        user_data = {
            "name": f"Test Admin {uuid.uuid4().hex[:4]}",
            "email": f"test_{uuid.uuid4().hex[:4]}@company.com",
            "password": "testpassword",
            "role": "ADMIN"
        }
        req = urllib.request.Request("http://127.0.0.1:8000/api/users", 
            data=json.dumps(user_data).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as response:
            print("Create user success:", response.status)
            print(response.read().decode())
    except urllib.error.HTTPError as e:
        print("Create user HTTP ERROR:", e.code, e.read().decode())
    except Exception as e:
        print("Create user ERROR:", e)
