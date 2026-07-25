"""
notification_helpers.py
Core send functions for Telegram and Web Push.
Both are called from scheduler.py with an active Flask app context.
"""
import json
import logging
import requests
from flask import current_app

log = logging.getLogger(__name__)


def send_telegram_message(chat_id: str, text: str, reply_markup: dict | None = None) -> bool:
    """Send a plain HTML message to a Telegram user.
    Returns True on success, False on any error.
    """
    token = current_app.config.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        log.warning("TELEGRAM_BOT_TOKEN not configured — skipping Telegram send")
        return False
    try:
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        if reply_markup:
            payload["reply_markup"] = reply_markup
            
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json=payload,
            timeout=10,
        )
        if not resp.ok:
            log.error("Telegram API error %s: %s", resp.status_code, resp.text)
        return resp.ok
    except Exception as exc:
        log.error("Telegram send exception: %s", exc)
        return False


def send_telegram_photo_message(
    chat_id: str, photo_url: str, caption: str, reply_markup: dict | None = None
) -> bool:
    """Send a photo with HTML caption to a Telegram user.
    Handles HTTP/HTTPS URLs and base64 data URIs.
    Falls back to text message if photo delivery fails or URL is invalid.
    """
    token = current_app.config.get("TELEGRAM_BOT_TOKEN", "")
    if not token or not photo_url:
        return send_telegram_message(chat_id, caption, reply_markup=reply_markup)

    try:
        # If it's a base64 data URL, upload image bytes directly to Telegram via multipart form
        if photo_url.startswith("data:"):
            import base64
            try:
                _, base64_data = photo_url.split(",", 1)
                img_bytes = base64.b64decode(base64_data)

                payload = {
                    "chat_id": chat_id,
                    "caption": caption,
                    "parse_mode": "HTML",
                }
                if reply_markup:
                    payload["reply_markup"] = json.dumps(reply_markup)

                files = {"photo": ("medicine.jpg", img_bytes, "image/jpeg")}

                resp = requests.post(
                    f"https://api.telegram.org/bot{token}/sendPhoto",
                    data=payload,
                    files=files,
                    timeout=15,
                )
                if not resp.ok:
                    log.warning("Telegram sendPhoto with file upload failed (%s): %s, falling back to text", resp.status_code, resp.text)
                    return send_telegram_message(chat_id, caption, reply_markup=reply_markup)
                return True
            except Exception as exc:
                log.error("Telegram base64 photo send exception: %s", exc)
                return send_telegram_message(chat_id, caption, reply_markup=reply_markup)

        payload = {
            "chat_id": chat_id,
            "photo": photo_url,
            "caption": caption,
            "parse_mode": "HTML",
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendPhoto",
            json=payload,
            timeout=10,
        )
        if not resp.ok:
            log.warning("Telegram sendPhoto failed (%s), falling back to text", resp.status_code)
            return send_telegram_message(chat_id, caption, reply_markup=reply_markup)
        return True
    except Exception as exc:
        log.error("Telegram photo send exception: %s", exc)
        return send_telegram_message(chat_id, caption, reply_markup=reply_markup)



def send_push_notification(
    subscription_json: str,
    title: str,
    body: str,
    url: str = "/cabinet",
) -> bool | str:
    """Send a Web Push notification via VAPID.
    Returns:
        True      — sent successfully
        False     — transient error (retry later)
        "expired" — subscription is gone (400/403/404/410), caller should clear it
    """
    private_key = current_app.config.get("VAPID_PRIVATE_KEY", "")
    claims_email = current_app.config.get("VAPID_CLAIMS_EMAIL", "admin@dawaisathi.com")

    if not private_key:
        log.warning("VAPID_PRIVATE_KEY not configured — skipping push send")
        return False

    try:
        from pywebpush import webpush, WebPushException

        subscription = json.loads(subscription_json)
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": {"url": url},
        })

        # Microsoft WNS (Edge on Windows) requires X-WNS-Type header
        extra_headers = {}
        endpoint = subscription.get("endpoint", "")
        if "notify.windows.com" in endpoint:
            extra_headers["X-WNS-Type"] = "wns/raw"

        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": f"mailto:{claims_email}"},
            headers=extra_headers,
        )
        return True

    except Exception as exc:
        # Check for WebPushException specifically
        if hasattr(exc, "response") and exc.response is not None:
            status = exc.response.status_code
            body = ""
            try:
                body = exc.response.text
            except Exception:
                pass
            log.error("Push send error (HTTP %s): %s | body: %s", status, exc, body)
            if status in (404, 410):
                return "expired"
            return f"push_service_error_{status}"
        log.error("Push send error: %s", exc)
        return f"push_error_{type(exc).__name__}"


def notify_caregivers_dose_taken(family_id: int | None, patient_name: str, med_name: str, target_eye: str | None, time_slot: str, logged_by_id: int) -> int:
    """Notify all other family members/caregivers that patient took their medicine."""
    if not family_id:
        return 0

    from models import User
    caregivers = User.query.filter(
        User.family_id == family_id,
        User.id != logged_by_id
    ).all()

    if not caregivers:
        return 0

    eye_label = ""
    if target_eye == "right_eye":
        eye_label = " (👁️ Right Eye)"
    elif target_eye == "left_eye":
        eye_label = " (👁️ Left Eye)"
    elif target_eye == "both_eyes":
        eye_label = " (👁️ Both Eyes)"

    slot_label = time_slot.capitalize() if time_slot else "Scheduled"
    text = (
        f"✅ <b>DawaiSathi — Caregiver Alert</b>\n\n"
        f"<b>{patient_name}</b> has taken <b>{med_name}</b>{eye_label} for the {slot_label} dose."
    )

    sent_count = 0
    for caregiver in caregivers:
        if caregiver.telegram_chat_id:
            if send_telegram_message(caregiver.telegram_chat_id, text):
                sent_count += 1

        for sub in caregiver.push_subscriptions.all():
            send_push_notification(
                sub.subscription_json,
                title=f"✅ {patient_name} Took Medicine",
                body=f"{med_name}{eye_label} logged for {slot_label}",
                url="/family-inbox",
            )
            sent_count += 1

    return sent_count


def send_caregiver_escalation_alert(family_id: int | None, patient_name: str, med_name: str, target_eye: str | None, time_slot: str) -> int:
    """Alert caregivers when a patient hasn't logged a dose 15 minutes after scheduled time."""
    if not family_id:
        return 0

    from models import User
    caregivers = User.query.filter(User.family_id == family_id).all()
    if not caregivers:
        return 0

    eye_label = ""
    if target_eye == "right_eye":
        eye_label = " (👁️ Right Eye)"
    elif target_eye == "left_eye":
        eye_label = " (👁️ Left Eye)"
    elif target_eye == "both_eyes":
        eye_label = " (👁️ Both Eyes)"

    slot_label = time_slot.capitalize() if time_slot else "Scheduled"
    text = (
        f"⚠️ <b>DawaiSathi — Caregiver Escalation Alert!</b>\n\n"
        f"<b>{patient_name}</b> has NOT logged <b>{med_name}</b>{eye_label} for the {slot_label} dose (15+ mins past scheduled time).\n\n"
        f"<i>Please check in with them to ensure adherence.</i>"
    )

    sent_count = 0
    for caregiver in caregivers:
        if caregiver.telegram_chat_id:
            if send_telegram_message(caregiver.telegram_chat_id, text):
                sent_count += 1

        for sub in caregiver.push_subscriptions.all():
            send_push_notification(
                sub.subscription_json,
                title=f"⚠️ Dose Escalation: {patient_name}",
                body=f"{med_name}{eye_label} for {slot_label} is unacknowledged!",
                url="/family-inbox",
            )
            sent_count += 1

    return sent_count

