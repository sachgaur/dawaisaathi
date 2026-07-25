"""
Run this ONCE to generate VAPID keys for Web Push notifications.

Usage:
    cd backend
    python generate_vapid.py

Copy the two printed lines into your .env file.
"""
import base64
from cryptography.hazmat.primitives.asymmetric.ec import generate_private_key, SECP256R1
from cryptography.hazmat.primitives.serialization import (
    Encoding, PrivateFormat, PublicFormat, NoEncryption
)

key = generate_private_key(SECP256R1())

private_der = key.private_bytes(
    encoding=Encoding.DER,
    format=PrivateFormat.PKCS8,
    encryption_algorithm=NoEncryption(),
)
public_uncompressed = key.public_key().public_bytes(
    encoding=Encoding.X962,
    format=PublicFormat.UncompressedPoint,
)

priv_b64 = base64.urlsafe_b64encode(private_der).decode().rstrip("=")
pub_b64  = base64.urlsafe_b64encode(public_uncompressed).decode().rstrip("=")

print("\n✅  VAPID keys generated — add these to your .env file:\n")
print(f"VAPID_PRIVATE_KEY={priv_b64}")
print(f"VAPID_PUBLIC_KEY={pub_b64}")
print(f'VAPID_CLAIMS_EMAIL=admin@dawaisathi.com')
print("\n⚠️  Keep VAPID_PRIVATE_KEY secret. VAPID_PUBLIC_KEY is safe to expose to the frontend.\n")
