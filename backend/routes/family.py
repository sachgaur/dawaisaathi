from flask import Blueprint, request, jsonify, current_app
from extensions import db
from models import User, Family, FamilyJoinRequest
from routes.auth import get_current_user
import random
import string

family_bp = Blueprint("family", __name__)


def generate_family_code():
    while True:
        code = "".join(random.choices(string.digits, k=6))
        if not Family.query.filter_by(family_code=code).first():
            return code


@family_bp.route("/api/family/members", methods=["GET"])
def get_members():
    """Get all members of the current user's family."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if not user.family_id:
        return jsonify({"members": [], "family": None})

    family = Family.query.get(user.family_id)
    members = User.query.filter_by(family_id=user.family_id).all()
    return jsonify({
        "family": family.to_dict(),
        "members": [m.to_dict() for m in members],
    })


@family_bp.route("/api/family/create", methods=["POST"])
def create_family():
    """Create a new family (for the first user in a group)."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if user.family_id:
        return jsonify({"error": "Already in a family"}), 400

    data = request.get_json()
    family_name = data.get("name", f"{user.name}'s Family")

    family = Family(
        name=family_name,
        family_code=generate_family_code(),
    )
    db.session.add(family)
    db.session.flush()  # get ID

    user.family_id = family.id
    db.session.commit()

    return jsonify({"family": family.to_dict(), "message": "Family created"}), 201


@family_bp.route("/api/family/join-request", methods=["POST"])
def send_join_request():
    """Send a join request by providing an existing family member's email."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if user.family_id:
        return jsonify({"error": "Already in a family"}), 400

    data = request.get_json()
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Find the target user
    target = User.query.filter_by(email=email).first()
    if not target:
        return jsonify({"error": "No user found with that email"}), 404
    if not target.family_id:
        return jsonify({"error": "That user is not part of any family yet"}), 400

    # Check for existing pending request
    existing = FamilyJoinRequest.query.filter_by(
        requester_id=user.id, family_id=target.family_id, status="pending"
    ).first()
    if existing:
        return jsonify({"error": "You already have a pending request for this family"}), 400

    join_req = FamilyJoinRequest(
        requester_id=user.id,
        family_id=target.family_id,
    )
    db.session.add(join_req)
    db.session.commit()

    return jsonify({
        "message": "Join request sent. Waiting for a family member to accept.",
        "request": join_req.to_dict(),
    }), 201


@family_bp.route("/api/family/inbox", methods=["GET"])
def get_inbox():
    """Get all pending join requests for the current user's family."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if not user.family_id:
        return jsonify({"requests": []})

    pending = FamilyJoinRequest.query.filter_by(
        family_id=user.family_id, status="pending"
    ).all()

    return jsonify({"requests": [r.to_dict() for r in pending]})


@family_bp.route("/api/family/respond", methods=["POST"])
def respond_to_request():
    """Accept or reject a family join request."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if not user.family_id:
        return jsonify({"error": "You are not in a family"}), 400

    data = request.get_json()
    request_id = data.get("request_id")
    action = data.get("action")  # "accept" | "reject"

    if action not in ("accept", "reject"):
        return jsonify({"error": "action must be 'accept' or 'reject'"}), 400

    join_req = FamilyJoinRequest.query.get(request_id)
    if not join_req:
        return jsonify({"error": "Request not found"}), 404
    if join_req.family_id != user.family_id:
        return jsonify({"error": "This request is not for your family"}), 403
    if join_req.status != "pending":
        return jsonify({"error": "Request already handled"}), 400

    join_req.status = "accepted" if action == "accept" else "rejected"
    join_req.responder_id = user.id

    if action == "accept":
        requester = User.query.get(join_req.requester_id)
        requester.family_id = join_req.family_id

    db.session.commit()

    return jsonify({
        "message": f"Request {join_req.status}",
        "request": join_req.to_dict(),
    })


@family_bp.route("/api/family/leave", methods=["POST"])
def leave_family():
    """Leave current family."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    user.family_id = None
    db.session.commit()
    return jsonify({"message": "Left family"})
