import requests
import uuid
import sys
import io

BASE_URL = 'http://localhost:8000/api'

def run_tests():
    print("=== Starting Phase 3 API Verification ===")
    
    # 1. Test Signup (which now creates an inactive user and sends verification email)
    print("\n[Test 1] Registering a new unverified user...")
    username = f"user_{uuid.uuid4().hex[:6]}"
    password = "testpassword123"
    email = f"{username}@example.com"
    try:
      r = requests.post(f"{BASE_URL}/auth/signup/", json={
          "username": username,
          "email": email,
          "password": password
      })
      print(f"Status: {r.status_code}")
      res_data = r.json()
      print(f"Data: {res_data}")
      assert r.status_code == 201
      print("[OK] User signup created inactive account & verification mail successfully!")
    except Exception as e:
      print(f"[FAIL] Signup failed: {e}")
      sys.exit(1)

    # 2. Test Login on Unverified Account (should return 403 Forbidden)
    print("\n[Test 2] Testing login on unverified user (should fail)...")
    try:
      r = requests.post(f"{BASE_URL}/auth/login/", json={
          "username": username,
          "password": password
      })
      print(f"Status: {r.status_code}")
      res_data = r.json()
      print(f"Data: {res_data}")
      assert r.status_code == 403
      assert res_data["unverified"] is True
      print("[OK] Login appropriately blocked for unverified accounts!")
    except Exception as e:
      print(f"[FAIL] Inactive account login check failed: {e}")
      sys.exit(1)

    # 3. Create a verified user for file upload tests
    print("\n[Test 3] Creating a pre-activated test user for auth testing...")
    active_username = f"active_{uuid.uuid4().hex[:6]}"
    active_password = "activepassword123"
    active_email = f"{active_username}@example.com"
    try:
      # We create user via REST signup, then fetch the verification token from the console
      # In this script, we'll create the user directly in django database using shell or bypass
      # Since we have shell access, we'll just sign them up and then programmatically activate them
      r = requests.post(f"{BASE_URL}/auth/signup/", json={
          "username": active_username,
          "email": active_email,
          "password": active_password
      })
      assert r.status_code == 201
      
      # Programmatically activate the user so we can obtain an Auth Token
      import subprocess
      activate_cmd = f".\\venv\\Scripts\\python.exe manage.py shell -c \"from django.contrib.auth.models import User; u=User.objects.get(username='{active_username}'); u.is_active=True; u.save()\""
      subprocess.run(activate_cmd, shell=True, check=True)
      
      # Now login to obtain token
      r = requests.post(f"{BASE_URL}/auth/login/", json={
          "username": active_username,
          "password": active_password
      })
      assert r.status_code == 200
      token = r.json()["token"]
      headers = {"Authorization": f"Token {token}"}
      print("[OK] Active user created and authenticated successfully!")
    except Exception as e:
      print(f"[FAIL] Active user setup failed: {e}")
      sys.exit(1)

    # 4. Test File Upload (Authenticated, Max 5MB)
    print("\n[Test 4] Uploading a document file...")
    file_data = b"This is a mock document for LinguaBot test verification."
    files = {"file": ("test_doc.txt", io.BytesIO(file_data), "text/plain")}
    try:
      r = requests.post(f"{BASE_URL}/chat/upload/", files=files, headers=headers)
      print(f"Status: {r.status_code}")
      res_data = r.json()
      print(f"Data: {res_data}")
      assert r.status_code == 201
      assert "file_url" in res_data
      print("[OK] Authenticated File Upload works!")
      file_path = res_data["file_path"]
      file_name = res_data["file_name"]
    except Exception as e:
      print(f"[FAIL] File upload failed: {e}")
      sys.exit(1)

    # 5. Test Password Reset Request
    print("\n[Test 5] Requesting a password reset link...")
    try:
      r = requests.post(f"{BASE_URL}/auth/password-reset/", json={
          "email": active_email
      })
      print(f"Status: {r.status_code}")
      res_data = r.json()
      print(f"Data: {res_data}")
      assert r.status_code == 200
      print("[OK] Password reset requested successfully!")
    except Exception as e:
      print(f"[FAIL] Password reset request failed: {e}")
      sys.exit(1)

    # 6. Test Chat Message with Attachment
    print("\n[Test 6] Sending a chat message with the uploaded attachment...")
    try:
      r = requests.post(
          f"{BASE_URL}/chat/test-session-id/send/",
          json={
              "message": "Please read this document.",
              "attachment_path": file_path,
              "attachment_name": file_name
          },
          headers=headers
      )
      print(f"Status: {r.status_code}")
      res_data = r.json()
      print(f"Data: {res_data}")
      assert r.status_code == 200
      assert "bot_message" in res_data
      print("[OK] Chatting with file attachments works!")
    except Exception as e:
      print(f"[FAIL] Multimodal attachment chat failed: {e}")
      sys.exit(1)

    print("\n=============================================")
    print("All Phase 3 REST API verification tests passed successfully!")
    print("=============================================")

if __name__ == "__main__":
    run_tests()
