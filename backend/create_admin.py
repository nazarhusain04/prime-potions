"""
One-time script to create the first Admin account in a fresh database.
Run this locally - your password never leaves your machine except to
go straight to MongoDB, the same as a normal login would.

Usage:
    python create_admin.py

You'll be prompted for your production MONGO_URL, email, name, and password.
"""
import getpass
import uuid
from datetime import datetime, timezone

import bcrypt
from pymongo import MongoClient


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def main():
    mongo_url = input("MONGO_URL (from Railway, full connection string with real password): ").strip()
    db_name = input("DB_NAME [prime_potions]: ").strip() or "prime_potions"
    email = input("Admin email (must be @primepotions.com): ").strip()
    full_name = input("Full name: ").strip()
    password = getpass.getpass("Password (won't be shown): ").strip()
    confirm = getpass.getpass("Confirm password: ").strip()

    if password != confirm:
        print("Passwords don't match. Aborting.")
        return
    if len(password) < 8:
        print("Password must be at least 8 characters. Aborting.")
        return
    if not email.lower().endswith("@primepotions.com"):
        print("Email must be a @primepotions.com address. Aborting.")
        return

    print("Connecting...")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]

    try:
        client.admin.command("ping")
    except Exception as e:
        print(f"\nCould not reach the database: {e}")
        print("Check: is Network Access in Atlas set to allow 0.0.0.0/0? Is the connection string correct?")
        return
    print("Connected.")

    existing = db.users.find_one({"email": email})
    if existing:
        print(f"A user with email {email} already exists. Aborting.")
        return

    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "full_name": full_name,
        "role": "Admin",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db.users.insert_one(user)
    print(f"\nDone. Admin account created for {email}.")
    print("You can now log in at your deployed frontend URL.")


if __name__ == "__main__":
    main()
