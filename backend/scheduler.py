"""
scheduler.py
APScheduler background job that fires every minute to check which users
have a medicine dose due right now (in their local timezone) and sends
both Telegram + Web Push notifications.

Key design decisions:
  - Runs inside the Flask process (no extra worker process needed)
  - Each job execution pushes its own app context → safe DB access
  - NotificationLog gives idempotency: one send per (user, date, slot)
  - The `days` field on MedicineEntry prevents sending after the course ends
  - WERKZEUG_RUN_MAIN guard prevents double-start under Flask debug reloader
"""
import json
import logging
from datetime import datetime, timedelta, date

log = logging.getLogger(__name__)

# ── Slot configuration ────────────────────────────────────────────────────────
DEFAULT_SLOT_TIMES: dict[str, tuple[int, int]] = {
    "morning":   (8,  0),
    "afternoon": (13, 0),
    "evening":   (18, 0),
    "night":     (22, 0),
}

SLOT_LABELS: dict[str, str] = {
    "morning":   "Morning",
    "afternoon": "Afternoon",
    "evening":   "Evening",
    "night":     "Night",
}

_scheduler = None  # Singleton


# ── Main job ──────────────────────────────────────────────────────────────────

def send_due_notifications() -> None:
    """Called every minute by APScheduler (inside an app context)."""
    from extensions import db
    from models import User, NotificationLog, PushSubscription

    now_utc = datetime.utcnow()

    # Only query users who have at least one channel configured
    has_push = db.session.query(PushSubscription.user_id).distinct().subquery()
    users = User.query.filter(
        db.or_(
            User.telegram_chat_id.isnot(None),
            User.id.in_(db.session.query(has_push.c.user_id)),
        )
    ).all()

    for user in users:
        try:
            _check_user(user, now_utc, db)
            _check_caregiver_escalations(user, now_utc, db)
        except Exception as exc:
            # Per-user errors must not break the whole job
            log.exception("Notification error for user %s: %s", user.id, exc)


# ── Per-user logic ────────────────────────────────────────────────────────────

def _check_user(user, now_utc: datetime, db) -> None:
    from models import NotificationLog
    from notification_helpers import (
        send_telegram_message,
        send_telegram_photo_message,
        send_push_notification,
    )

    tz_offset = user.timezone_offset or 0
    user_local: datetime = now_utc - timedelta(minutes=tz_offset)
    today: date = user_local.date()

    enabled_slots: list[str] = (
        json.loads(user.notif_slots_json)
        if user.notif_slots_json
        else list(DEFAULT_SLOT_TIMES.keys())
    )
    custom_times: dict[str, str] = (
        json.loads(user.notif_times_json)
        if user.notif_times_json
        else {}
    )

    for slot in enabled_slots:
        if slot not in DEFAULT_SLOT_TIMES:
            continue

        # Resolve slot base time (custom or default)
        time_str = custom_times.get(slot, "")
        if time_str:
            try:
                base_h, base_m = map(int, time_str.split(":"))
            except ValueError:
                base_h, base_m = DEFAULT_SLOT_TIMES[slot]
        else:
            base_h, base_m = DEFAULT_SLOT_TIMES[slot]

        # Gather medicines due for this slot
        medicines = _get_due_medicines(user.id, slot, today)
        if not medicines:
            continue

        # Sort medicines by sequence_order / id
        medicines.sort(key=lambda m: (m.sequence_order or 1, m.id))

        # Compute staggered times for each medicine
        base_dt = datetime.combine(today, datetime.min.time()).replace(hour=base_h, minute=base_m)
        current_offset = 0

        due_this_minute = []
        for idx, med in enumerate(medicines):
            med_time = base_dt + timedelta(minutes=current_offset)
            if user_local.hour == med_time.hour and user_local.minute == med_time.minute:
                due_this_minute.append((med, idx + 1, len(medicines), med_time.strftime("%H:%M")))
            # Accumulate stagger interval for next medicine
            interval = med.stagger_interval_minutes or 10
            current_offset += interval

        if not due_this_minute:
            continue

        slot_label = SLOT_LABELS.get(slot, slot.capitalize())

        for med, step_num, total_steps, time_display in due_this_minute:
            # Idempotency check per medicine / slot / step
            sub_slot_key = f"{slot}_step{step_num}"
            already_sent = NotificationLog.query.filter_by(
                user_id=user.id, date=today, time_slot=sub_slot_key
            ).first()
            if already_sent:
                continue

            # Build rich visual notification text
            eye_str = ""
            if med.target_eye == "right_eye":
                eye_str = " 👁️ Right Eye"
            elif med.target_eye == "left_eye":
                eye_str = " 👁️ Left Eye"
            elif med.target_eye == "both_eyes":
                eye_str = " 👁️ Both Eyes"

            cap_str = ""
            if med.bottle_cap_color:
                cap_str = f" [Cap Color: {med.bottle_cap_color.capitalize()}]"

            med_detail = f"• <b>{med.name}</b>{eye_str}{cap_str}"
            if med.dosage:
                med_detail += f" ({med.dosage})"
            if med.instructions:
                med_detail += f"\n  <i>Instructions: {med.instructions}</i>"

            step_hdr = f"<b>Step {step_num} of {total_steps}</b>" if total_steps > 1 else ""

            tg_text = (
                f"💊 <b>DawaiSathi — {slot_label} Reminder ({time_display})</b>\n"
                + f"{step_hdr}\n\n"
                + f"{med_detail}\n\n"
                + f"<i>Please take this medicine now and tap below:</i>"
            )

            reply_markup = {
                "inline_keyboard": [
                    [{"text": f"✅ Taken ({med.name[:15]})", "callback_data": f"log_{slot}"}]
                ]
            }

            # If photo exists, send photo message
            photo_url = med.pack_image_url or med.scan_image_url
            tg_ok = False
            if user.telegram_chat_id:
                if photo_url:
                    tg_ok = send_telegram_photo_message(
                        user.telegram_chat_id, photo_url, tg_text, reply_markup=reply_markup
                    )
                else:
                    tg_ok = send_telegram_message(user.telegram_chat_id, tg_text, reply_markup=reply_markup)

            # Web Push
            push_ok = False
            subscriptions = user.push_subscriptions.all()
            if subscriptions:
                push_title = f"💊 {slot_label} Step {step_num}: {med.name}"
                push_body = f"{med.name}{eye_str}{cap_str} due at {time_display}"

                for sub in subscriptions:
                    res = send_push_notification(
                        sub.subscription_json,
                        title=push_title,
                        body=push_body,
                        url=f"/cabinet?date={today.isoformat()}&slot={slot}",
                    )
                    if res == "expired":
                        db.session.delete(sub)
                    elif res is True:
                        push_ok = True

            if tg_ok or push_ok:
                channel = "both" if (tg_ok and push_ok) else ("telegram" if tg_ok else "push")
                try:
                    log_entry = NotificationLog(
                        user_id=user.id, date=today, time_slot=sub_slot_key, channel=channel
                    )
                    db.session.add(log_entry)
                    db.session.commit()
                except Exception:
                    db.session.rollback()


def _check_caregiver_escalations(user, now_utc: datetime, db) -> None:
    """Check if any scheduled medicine is >15 minutes past due and unlogged, then alert caregiver."""
    if not user.family_id:
        return

    from models import MedicineLog, CaregiverEscalationLog
    from notification_helpers import send_caregiver_escalation_alert

    tz_offset = user.timezone_offset or 0
    user_local: datetime = now_utc - timedelta(minutes=tz_offset)
    today: date = user_local.date()

    enabled_slots: list[str] = (
        json.loads(user.notif_slots_json)
        if user.notif_slots_json
        else list(DEFAULT_SLOT_TIMES.keys())
    )
    custom_times: dict[str, str] = (
        json.loads(user.notif_times_json) if user.notif_times_json else {}
    )

    for slot in enabled_slots:
        if slot not in DEFAULT_SLOT_TIMES:
            continue

        time_str = custom_times.get(slot, "")
        if time_str:
            try:
                base_h, base_m = map(int, time_str.split(":"))
            except ValueError:
                base_h, base_m = DEFAULT_SLOT_TIMES[slot]
        else:
            base_h, base_m = DEFAULT_SLOT_TIMES[slot]

        medicines = _get_due_medicines(user.id, slot, today)
        if not medicines:
            continue

        base_dt = datetime.combine(today, datetime.min.time()).replace(hour=base_h, minute=base_m)
        current_offset = 0

        for med in sorted(medicines, key=lambda m: (m.sequence_order or 1, m.id)):
            med_due_time = base_dt + timedelta(minutes=current_offset)
            current_offset += med.stagger_interval_minutes or 10

            # If current time is at least 15 minutes past scheduled drop time
            if user_local >= med_due_time + timedelta(minutes=15):
                # Has patient logged this dose today?
                logged = MedicineLog.query.filter(
                    MedicineLog.entry_id == med.id,
                    MedicineLog.time_slot == slot,
                    MedicineLog.logged_at >= datetime.combine(today, datetime.min.time()),
                ).first()

                if not logged:
                    # Has caregiver already been escalated for this entry + date + slot?
                    already_escalated = CaregiverEscalationLog.query.filter_by(
                        entry_id=med.id, date=today, time_slot=slot
                    ).first()

                    if not already_escalated:
                        send_caregiver_escalation_alert(
                            family_id=user.family_id,
                            patient_name=user.name,
                            med_name=med.name,
                            target_eye=med.target_eye,
                            time_slot=slot,
                        )
                        esc_log = CaregiverEscalationLog(
                            entry_id=med.id,
                            patient_user_id=user.id,
                            date=today,
                            time_slot=slot,
                        )
                        db.session.add(esc_log)
                        try:
                            db.session.commit()
                        except Exception:
                            db.session.rollback()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_due_medicines(user_id: int, slot: str, today: date) -> list:
    """Return all active medicines for a user+family+slot, filtering by days field."""
    from models import MedicineEntry, User

    user = User.query.get(user_id)
    if not user:
        return []

    # Include the user's family members so a parent gets reminded about
    # medicines added for a child (or any other family member).
    if user.family_id:
        target_ids = [
            m.id for m in User.query.filter_by(family_id=user.family_id).all()
        ]
    else:
        target_ids = [user_id]

    medicines = MedicineEntry.query.filter(
        MedicineEntry.user_id.in_(target_ids)
    ).all()

    result = []
    for med in medicines:
        if slot not in (med.schedule or []):
            continue
        # Respect the days field: don't notify after the course ends
        if med.days is not None:
            end_date = med.created_at.date() + timedelta(days=med.days)
            if today >= end_date:
                continue
        result.append(med)
    return result


def _format_med_lines(medicines: list) -> list[str]:
    lines = []
    for med in medicines:
        line = f"• {med.name}"
        if med.dosage:
            line += f" ({med.dosage})"
        if med.instructions:
            line += f" — {med.instructions}"
        lines.append(line)
    return lines


# ── Scheduler lifecycle ───────────────────────────────────────────────────────

def init_scheduler(app) -> None:
    """Start the APScheduler background scheduler.
    Safe to call multiple times — uses singleton + replace_existing guard.
    """
    global _scheduler

    if _scheduler and _scheduler.running:
        log.info("Scheduler already running — skipping init")
        return

    from apscheduler.schedulers.background import BackgroundScheduler

    _scheduler = BackgroundScheduler(daemon=True)

    def _job():
        with app.app_context():
            send_due_notifications()

    _scheduler.add_job(
        _job,
        trigger="interval",
        minutes=1,
        id="notification_check",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=30,
    )

    _scheduler.start()
    log.info("✅ Notification scheduler started (fires every minute)")

