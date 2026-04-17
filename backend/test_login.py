"""
Test login endpoint directly
"""
from database import SessionLocal
from models import User
from auth import create_access_token, verify_password
from schemas import UserLogin
import json

print("=" * 50)
print("LOGIN ENDPOINT TEST")
print("=" * 50)

# Simulate login request
email = "alice@example.com"
password = "password123"

print(f"\nSimulating login with:")
print(f"  Email: {email}")
print(f"  Password: {password}")

# Create session
db = SessionLocal()

# Step 1: Query user
print("\n1. Querying user by email...")
user = db.query(User).filter(User.email == email).first()
print(f"   User found: {user is not None}")

if user:
    print(f"   User ID: {user.id}")
    print(f"   User email: {user.email}")
    print(f"   User name: {user.name}")

    # Step 2: Verify password
    print("\n2. Verifying password...")
    pwd_hash = user.password_hash
    print(f"   Hash from DB: {pwd_hash[:50]}...")

    is_valid = verify_password(password, pwd_hash)
    print(f"   Password valid: {is_valid}")

    # Step 3: Check condition
    print("\n3. Checking login condition...")
    condition = not user or not verify_password(password, user.password_hash)
    print(f"   'not user': {not user}")
    print(
        f"   'not verify_password(...)': {not verify_password(password, user.password_hash)}")
    print(f"   Overall condition (should be False): {condition}")

    if not condition:
        print("\n✅ LOGIN WOULD SUCCEED!")
        # Create token
        access_token = create_access_token(data={"sub": str(user.id)})
        print(f"\n4. Generated token:")
        print(f"   Token: {access_token}")
    else:
        print("\n❌ LOGIN WOULD FAIL!")
else:
    print("\n❌ User not found!")

db.close()
print("\n" + "=" * 50)
