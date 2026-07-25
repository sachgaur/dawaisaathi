import os
import jwt
import requests
from datetime import datetime, timedelta
from flask import Blueprint, redirect, request, jsonify, current_app
from extensions import db
from models import User, Family
import random
import string

auth_bp = Blueprint("auth", __name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def generate_family_code():
    return "".join(random.choices(string.digits, k=6))


def create_jwt(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def get_current_user():
    """Extract user from Authorization header JWT."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
        )
        return User.query.get(payload["user_id"])
    except Exception:
        return None


@auth_bp.route("/api/auth/google")
def google_login():
    """Redirect user to Google OAuth2."""
    client_id = current_app.config["GOOGLE_CLIENT_ID"]
    redirect_uri = current_app.config["GOOGLE_REDIRECT_URI"]
    scope = "openid email profile"
    params = (
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return redirect(GOOGLE_AUTH_URL + params)


@auth_bp.route("/api/auth/dev-login")
def dev_login():
    """Bypass Google SSO for local development."""
    user = User.query.filter_by(email="dev@example.com").first()
    is_new = False
    if not user:
        is_new = True
        user = User(
            google_id="dev-google-id",
            name="Developer",
            email="dev@example.com",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Developer",
        )
        db.session.add(user)
        db.session.commit()
    
    token = create_jwt(user.id)
    frontend_url = current_app.config["FRONTEND_URL"]
    return redirect(f"{frontend_url}/auth/success?token={token}&new={str(is_new).lower()}")


@auth_bp.route("/api/auth/callback")
def google_callback():
    """Handle Google OAuth2 callback."""
    code = request.args.get("code")
    if not code:
        return redirect(current_app.config["FRONTEND_URL"] + "/?error=no_code")

    # Exchange code for tokens
    token_data = {
        "code": code,
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": current_app.config["GOOGLE_REDIRECT_URI"],
        "grant_type": "authorization_code",
    }
    token_resp = requests.post(GOOGLE_TOKEN_URL, data=token_data)
    if not token_resp.ok:
        return redirect(current_app.config["FRONTEND_URL"] + "/?error=token_failed")

    access_token = token_resp.json().get("access_token")

    # Fetch user info from Google
    userinfo_resp = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if not userinfo_resp.ok:
        return redirect(current_app.config["FRONTEND_URL"] + "/?error=userinfo_failed")

    info = userinfo_resp.json()
    google_id = info["sub"]
    name = info.get("name", "")
    email = info.get("email", "")
    avatar_url = info.get("picture", "")

    # Find or create user
    user = User.query.filter_by(google_id=google_id).first()
    is_new = False
    if not user:
        is_new = True
        user = User(
            google_id=google_id,
            name=name,
            email=email,
            avatar_url=avatar_url,
        )
        db.session.add(user)
        db.session.commit()

    token = create_jwt(user.id)
    frontend_url = current_app.config["FRONTEND_URL"]
    return redirect(f"{frontend_url}/auth/success?token={token}&new={str(is_new).lower()}")


@auth_bp.route("/api/auth/me")
def me():
    """Return current user info."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(user.to_dict())


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    """Client-side logout — just tell client to discard token."""
    return jsonify({"message": "Logged out"})
