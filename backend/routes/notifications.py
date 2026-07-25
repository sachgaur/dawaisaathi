"""
routes/notifications.py
All API endpoints for the notification system:
  - Timezone sync
  - Notification settings (slots + custom times)
  - Telegram linking flow (code generation + webhook + status poll)
  - Web Push subscription management + test send
  - Utility: manually re-register Telegram webhook URL
"""
import json
import random
import logging
import requests
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, current_app
from extensions import db
from models import User, TelegramLinkCode, PushSubscription
from routes.auth import get_current_user

log = logging.getLogger(__name__)
notifications_bp = Blueprint("notifications", __name__)

VALID_SLOTS = {"morning", "afternoon", "evening", "night"}
DEFAULT_TIMES = {
    "morning":   "08:00",
    "afternoon": "13:00",
    "evening":   "18:00",
    "night":     "22:00",
}


# ── Timezone Sync ──────────────────────────────────────────────────────────────

@notifications_bp.route("/api/notifications/timezone", methods=["POST"])
def sync_timezone():
    """Called automatically on app load to keep the user's timezone current."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    try:
        offset = int(data.get("tz_offset", 0))
    except (TypeError, ValueError):
        offset = 0
    user.timezone_offset = offset
    db.session.commit()
    return jsonify({"ok": True})


# ── Settings ───────────────────────────────────────────────────────────────────

@notifications_bp.route("/api/notifications/settings", methods=["GET"])
def get_settings():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    endpoint = request.args.get("endpoint", "")

    slots = json.loads(user.notif_slots_json) if user.notif_slots_json else list(DEFAULT_TIMES.keys())
    times = json.loads(user.notif_times_json) if user.notif_times_json else DEFAULT_TIMES

    subs = PushSubscription.query.filter_by(user_id=user.id).all()
    current_device_enabled = any(s.endpoint == endpoint for s in subs) if endpoint else False

    return jsonify({
        "telegram_linked": user.telegram_chat_id is not None,
        "push_enabled": len(subs) > 0,
        "push_enabled_current_device": current_device_enabled,
        "push_device_count": len(subs),
        "push_devices": [
            {"endpoint": s.endpoint[-40:], "current_device": s.endpoint == endpoint}
            for s in subs
        ],
        "slots": slots,
        "times": times,
    })


@notifications_bp.route("/api/notifications/settings", methods=["POST"])
def update_settings():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}

    if "slots" in data:
        cleaned = [s for s in data["slots"] if s in VALID_SLOTS]
        user.notif_slots_json = json.dumps(cleaned)

    if "times" in data:
        times: dict[str, str] = {}
        for slot, val in data["times"].items():
            if slot not in VALID_SLOTS:
                continue
            try:
                h, m = map(int, str(val).split(":"))
                if 0 <= h <= 23 and 0 <= m <= 59:
                    times[slot] = f"{h:02d}:{m:02d}"
            except Exception:
                pass
        user.notif_times_json = json.dumps(times)

    db.session.commit()
    return jsonify({"ok": True})


# ── Telegram: generate link code ───────────────────────────────────────────────

@notifications_bp.route("/api/notifications/telegram/code", methods=["GET"])
def get_telegram_code():
    """Generate a 6-digit code the user will send to the bot to link their account."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # Expire/remove old unused codes for this user
    TelegramLinkCode.query.filter_by(user_id=user.id, used=False).delete()
    db.session.flush()

    # Generate a unique 6-digit code
    for _ in range(10):
        code = "".join(str(random.randint(0, 9)) for _ in range(6))
        if not TelegramLinkCode.query.filter_by(code=code).first():
            break

    link = TelegramLinkCode(
        code=code,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.session.add(link)
    db.session.commit()

    # Try to resolve the bot's username for the deep link
    token = current_app.config.get("TELEGRAM_BOT_TOKEN", "")
    bot_username = "DawaiSathiBot"  # fallback
    if token:
        try:
            resp = requests.get(
                f"https://api.telegram.org/bot{token}/getMe", timeout=5
            )
            if resp.ok:
                bot_username = resp.json().get("result", {}).get("username", bot_username)
        except Exception:
            pass

    return jsonify({
        "code": code,
        "bot_username": bot_username,
        "expires_in_minutes": 10,
    })


@notifications_bp.route("/api/notifications/telegram/status", methods=["GET"])
def telegram_status():
    """Polling endpoint: frontend polls this to detect when linking succeeds."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"linked": user.telegram_chat_id is not None})


@notifications_bp.route("/api/notifications/telegram/unlink", methods=["POST"])
def unlink_telegram():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    user.telegram_chat_id = None
    db.session.commit()
    return jsonify({"ok": True})


# ── Telegram: bot webhook ─────────────────────────────────────────────────────

def process_telegram_update(data: dict) -> None:
    """Core logic to process incoming Telegram update payload (message or callback query)."""
    token = current_app.config.get("TELEGRAM_BOT_TOKEN", "")
    if not token or "your-telegram-bot-token" in token:
        return

    # ── 1. Handle Callback Queries (Inline Button clicks) ──────────────────────
    if "callback_query" in data:
        callback_query = data["callback_query"]
        callback_data = callback_query.get("data", "")
        chat_id = str(callback_query.get("message", {}).get("chat", {}).get("id", ""))
        callback_id = callback_query.get("id")

        if callback_data and callback_data.startswith("log_"):
            time_slot = callback_data.split("_")[1]
            user = User.query.filter_by(telegram_chat_id=chat_id).first()

            if user:
                from models import MedicineEntry, MedicineLog
                from notification_helpers import notify_caregivers_dose_taken

                target_ids = (
                    [m.id for m in User.query.filter_by(family_id=user.family_id).all()]
                    if user.family_id
                    else [user.id]
                )
                medicines = MedicineEntry.query.filter(MedicineEntry.user_id.in_(target_ids)).all()

                logged_count = 0
                for med in medicines:
                    if time_slot in (med.schedule or []):
                        log_entry = MedicineLog(
                            entry_id=med.id,
                            logged_by_user_id=user.id,
                            time_slot=time_slot,
                            caregiver_notified=True,
                        )
                        db.session.add(log_entry)
                        logged_count += 1
                        try:
                            notify_caregivers_dose_taken(
                                family_id=user.family_id,
                                patient_name=user.name,
                                med_name=med.name,
                                target_eye=med.target_eye,
                                time_slot=time_slot,
                                logged_by_id=user.id,
                            )
                        except Exception:
                            pass

                db.session.commit()

                if token:
                    try:
                        requests.post(
                            f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                            json={
                                "callback_query_id": callback_id,
                                "text": f"✅ Dose logged for {time_slot}!",
                            },
                            timeout=5,
                        )
                        message_id = callback_query.get("message", {}).get("message_id")
                        requests.post(
                            f"https://api.telegram.org/bot{token}/editMessageReplyMarkup",
                            json={
                                "chat_id": chat_id,
                                "message_id": message_id,
                                "reply_markup": {"inline_keyboard": []},
                            },
                            timeout=5,
                        )
                    except Exception:
                        pass
        return

    # ── 2. Handle Text Messages ────────────────────────────────────────────────
    message = data.get("message", {})
    if not message:
        return

    chat_id = str(message.get("chat", {}).get("id", ""))
    text = message.get("text", "").strip()

    if not chat_id:
        return

    def _reply(msg: str) -> None:
        if not token:
            return
        try:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"},
                timeout=10,
            )
        except Exception:
            pass

    # Support deep-link /start 123456 vs plain /start vs 6-digit code
    code_match = text
    if text.startswith("/start "):
        code_match = text.split(" ", 1)[1].strip()

    if code_match.isdigit() and len(code_match) == 6:
        link_code = TelegramLinkCode.query.filter_by(code=code_match, used=False).first()

        if not link_code:
            _reply("❌ Invalid or expired code. Please generate a new one from the DawaiSathi app.")
            return

        if datetime.utcnow() > link_code.expires_at:
            link_code.used = True
            db.session.commit()
            _reply("⏰ This code has expired. Please generate a fresh one from the app.")
            return

        target_user = User.query.get(link_code.user_id)
        if target_user:
            target_user.telegram_chat_id = chat_id
            link_code.used = True
            db.session.commit()
            _reply(
                f"✅ <b>Linked successfully!</b>\n\n"
                f"Hi {target_user.name}! 👋\n"
                f"You will now receive eye-drop & medicine reminders here with bottle photos and 1-tap confirmation.\n\n"
                f"Send /stop anytime to unlink."
            )
        else:
            _reply("❌ Something went wrong. Please try again.")
        return

    # Plain /start command without code
    if text == "/start":
        _reply(
            "👋 Welcome to <b>DawaiSathi</b>!\n\n"
            "To receive medicine & eye drop reminders here:\n"
            "1. Open the DawaiSathi app\n"
            "2. Go to <b>Notifications</b> (✈️ Link Telegram Bot)\n"
            "3. Tap <b>Link Telegram</b>\n"
            "4. Send me the 6-digit code shown there\n\n"
            "💊 <i>Stay healthy!</i>"
        )
        return

    # Handle direct text reply: "taken", "done", "yes", "i took it", etc.
    if text.lower() in ("taken", "done", "yes", "y", "took", "i took it", "logged", "done!"):
        user = User.query.filter_by(telegram_chat_id=chat_id).first()
        if user:
            from models import MedicineEntry, MedicineLog
            from notification_helpers import notify_caregivers_dose_taken

            tz_offset = user.timezone_offset or 0
            user_local = datetime.utcnow() - timedelta(minutes=tz_offset)
            hour = user_local.hour
            slot = "morning"
            if 12 <= hour < 17:
                slot = "afternoon"
            elif 17 <= hour < 21:
                slot = "evening"
            elif hour >= 21 or hour < 5:
                slot = "night"

            target_ids = (
                [m.id for m in User.query.filter_by(family_id=user.family_id).all()]
                if user.family_id
                else [user.id]
            )
            medicines = MedicineEntry.query.filter(MedicineEntry.user_id.in_(target_ids)).all()

            logged_count = 0
            for med in medicines:
                if slot in (med.schedule or []):
                    log_entry = MedicineLog(
                        entry_id=med.id,
                        logged_by_user_id=user.id,
                        time_slot=slot,
                        caregiver_notified=True,
                    )
                    db.session.add(log_entry)
                    logged_count += 1
                    try:
                        notify_caregivers_dose_taken(
                            family_id=user.family_id,
                            patient_name=user.name,
                            med_name=med.name,
                            target_eye=med.target_eye,
                            time_slot=slot,
                            logged_by_id=user.id,
                        )
                    except Exception:
                        pass

            db.session.commit()
            _reply(f"✅ <b>Dose Logged!</b>\n\nRecorded {logged_count} medicine(s) for the {slot.capitalize()} slot.\nYour caregiver has been notified.")
        else:
            _reply("Please link your account first by sending your 6-digit code.")
        return

    # /stop command — unlink
    if text.lower() in ("/stop", "/unlink"):
        user_to_unlink = User.query.filter_by(telegram_chat_id=chat_id).first()
        if user_to_unlink:
            user_to_unlink.telegram_chat_id = None
            db.session.commit()
            _reply("✅ Unlinked. You won't receive reminders here anymore.\nSend /start to re-link.")
        else:
            _reply("You're not currently linked to any account.")
        return

    # Default reply for unknown text
    _reply("Send /start for instructions or a 6-digit code from the DawaiSathi app to link your account.")


@notifications_bp.route("/api/telegram/webhook", methods=["POST"])
def telegram_webhook():
    """
    Receives all inbound messages/updates from Telegram servers.
    """
    data = request.get_json(silent=True) or {}
    process_telegram_update(data)
    return jsonify({"ok": True})


# ── Web Push ───────────────────────────────────────────────────────────────────

@notifications_bp.route("/api/notifications/push/vapid-key", methods=["GET"])
def vapid_public_key():
    """Returns the VAPID public key so the frontend can subscribe."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    pub = current_app.config.get("VAPID_PUBLIC_KEY", "")
    priv = current_app.config.get("VAPID_PRIVATE_KEY", "")
    if not pub or not priv:
        return jsonify({"error": "VAPID keys not configured on server. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment.", "public_key": ""}), 500
    return jsonify({"public_key": pub})


@notifications_bp.route("/api/notifications/push/subscribe", methods=["POST"])
def push_subscribe():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    subscription = data.get("subscription")
    if not subscription:
        return jsonify({"error": "No subscription object provided"}), 400
    endpoint = subscription.get("endpoint", "")
    if not endpoint:
        return jsonify({"error": "No endpoint in subscription"}), 400

    existing = PushSubscription.query.filter_by(endpoint=endpoint).first()
    if existing:
        existing.user_id = user.id
        existing.subscription_json = json.dumps(subscription)
    else:
        db.session.add(PushSubscription(
            user_id=user.id,
            endpoint=endpoint,
            subscription_json=json.dumps(subscription),
        ))
    db.session.commit()
    return jsonify({"ok": True})


@notifications_bp.route("/api/notifications/push/unsubscribe", methods=["POST"])
def push_unsubscribe():
    """Remove the subscription for this specific device (identified by endpoint)."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    endpoint = data.get("endpoint")

    if not endpoint:
        return jsonify({"error": "No endpoint provided — use subscribe endpoint instead"}), 400

    deleted = PushSubscription.query.filter_by(user_id=user.id, endpoint=endpoint).delete()
    db.session.commit()
    return jsonify({"ok": True, "deleted": deleted})


@notifications_bp.route("/api/notifications/push/test", methods=["POST"])
def push_test():
    """Sends a test push to the requesting device."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # Pre-check VAPID config before touching the DB
    priv = current_app.config.get("VAPID_PRIVATE_KEY", "")
    pub = current_app.config.get("VAPID_PUBLIC_KEY", "")
    if not priv or not pub:
        return jsonify({"error": "Push not configured on server (VAPID keys missing). Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to environment variables on Render."}), 500

    from notification_helpers import send_push_notification

    data = request.get_json(silent=True) or {}
    endpoint = data.get("endpoint")

    if not endpoint:
        return jsonify({"error": "This device has no push subscription. Enable push notifications on this device first."}), 400

    subs = PushSubscription.query.filter_by(user_id=user.id, endpoint=endpoint).all()

    if not subs:
        return jsonify({"error": "No push subscription found for this device. Please enable push notifications on this device first."}), 400

    results = []
    expired = []
    for sub in subs:
        result = send_push_notification(
            sub.subscription_json,
            title="💊 DawaiSathi — Test Notification",
            body="Push notifications are working correctly! ✓",
            url="/cabinet",
        )
        if result is True:
            results.append("ok")
        elif result == "expired":
            expired.append(sub)
            results.append("expired")
        else:
            results.append(str(result))

    for sub in expired:
        db.session.delete(sub)
    if expired:
        db.session.commit()

    if all(r == "ok" for r in results):
        return jsonify({"ok": True})
    if any(r == "ok" for r in results):
        errors = [r for r in results if r != "ok"]
        return jsonify({"warning": "Partial success", "errors": errors}), 200

    error_msg = results[0] if results else "unknown error"
    if error_msg == "False":
        return jsonify({"error": "Push notification failed — VAPID keys may be missing or pywebpush not installed on the server. Check server logs."}), 500
    if error_msg.startswith("push_service_error_"):
        status = error_msg.replace("push_service_error_", "")
        return jsonify({"error": f"Push service rejected the subscription (HTTP {status}). Try disabling and re-enabling notifications on this device."}), 500
    if error_msg.startswith("push_error_"):
        kind = error_msg.replace("push_error_", "")
        return jsonify({"error": f"Push service error: {kind}. Check server logs for details."}), 500
    return jsonify({"error": f"Push failed: {error_msg}"}), 500


# ── Utility: re-register Telegram webhook ────────────────────────────────────

@notifications_bp.route("/api/telegram/set-webhook", methods=["POST"])
def set_telegram_webhook():
    """
    Re-registers the Telegram webhook with the current TELEGRAM_WEBHOOK_URL.
    Call this after changing your VS Code tunnel URL.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    token = current_app.config.get("TELEGRAM_BOT_TOKEN", "")
    base_url = current_app.config.get("TELEGRAM_WEBHOOK_URL", "").rstrip("/")

    if not token:
        return jsonify({"error": "TELEGRAM_BOT_TOKEN not set in .env"}), 500
    if not base_url:
        return jsonify({"error": "TELEGRAM_WEBHOOK_URL not set in .env"}), 500

    webhook_url = f"{base_url}/api/telegram/webhook"
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/setWebhook",
            json={"url": webhook_url},
            timeout=10,
        )
        if resp.ok:
            return jsonify({"ok": True, "webhook_url": webhook_url})
        return jsonify({"error": resp.json()}), 500
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Utility: external trigger for cron jobs ──────────────────────────────────

@notifications_bp.route("/api/notifications/trigger-check", methods=["GET", "POST"])
def trigger_check():
    """Webhook for external cron services (like cron-job.org) to trigger the notification run."""
    from scheduler import send_due_notifications
    try:
        send_due_notifications()
        return jsonify({"ok": True, "message": "Notification check executed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Utility: sync offline notification logs ───────────────────────────────────

@notifications_bp.route("/api/notifications/sync", methods=["POST"])
def sync_notification_logs():
    """Two-way sync of notification logs between IndexedDB and PostgreSQL/SQLite."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    local_logs = data.get("logs", [])
    
    from models import NotificationLog
    from datetime import date
    
    synced_count = 0
    for log_item in local_logs:
        try:
            log_date = datetime.strptime(log_item["date"], "%Y-%m-%d").date()
            time_slot = log_item["slot"]
            channel = log_item.get("channel", "local")
            
            already = NotificationLog.query.filter_by(
                user_id=user.id,
                date=log_date,
                time_slot=time_slot
            ).first()
            
            if not already:
                db.session.add(NotificationLog(
                    user_id=user.id,
                    date=log_date,
                    time_slot=time_slot,
                    channel=channel,
                    sent_at=datetime.utcnow()
                ))
                synced_count += 1
        except Exception as ex:
            log.error("Failed to parse/sync log item %s: %s", log_item, ex)
            
    if synced_count > 0:
        db.session.commit()
        
    seven_days_ago = date.today() - timedelta(days=7)
    recent_logs = NotificationLog.query.filter(
        NotificationLog.user_id == user.id,
        NotificationLog.date >= seven_days_ago
    ).all()
    
    return jsonify({
        "ok": True,
        "synced": synced_count,
        "recent_logs": [
            {
                "date": rl.date.isoformat(),
                "slot": rl.time_slot,
                "channel": rl.channel
            }
            for rl in recent_logs
        ]
    })

