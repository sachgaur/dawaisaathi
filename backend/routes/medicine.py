import os
import json
import base64
from datetime import datetime, date, time, timedelta
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from extensions import db
from models import User, MedicineEntry, MedicineLog
from routes.auth import get_current_user
import google.generativeai as genai
from PIL import Image
import io
import uuid

medicine_bp = Blueprint("medicine", __name__)

SCAN_PROMPT = """You are an expert Indian prescription and hospital discharge summary OCR agent.

Your task: analyze the image and extract every medicine listed — whether from a printed hospital table, a typed prescription, or a handwritten chit.

For each medicine found, extract ALL of the following fields:
- "name": full medicine name including brand and strength (e.g. "Tab Cetil 500mg", "Cap Pantocid DSR 40mg"). Include the form (Tab / Cap / Inj / Syrup / Drops / Nebulization) in the name if visible.
- "dosage": quantity per dose as written (e.g. "1", "2", "1/2", "2 drops", "10 units"). If timing-specific doses differ (e.g. 1 in morning and 1 at night), summarize as "1-0-1".
- "schedule": list of time slots when the medicine is taken. Use ONLY these values: "morning", "afternoon", "evening", "night". Infer from columns labelled Mrng/Morning, Noon/Afternoon, Evng/Evening, Night/Bedtime. If a cell has a number, a tick, or any mark, that slot is active.
- "days": integer number of days the medicine is prescribed for (from the Days column or text like "for 5 days"). Return null if not found.
- "instructions": administration instructions exactly as written (e.g. "After Food", "Before Breakfast", "S/C", "At Bed Time", "With Water"). Return null if not found.
- "confidence": estimate of OCR certainty based on handwriting legibility/clarity. Use ONLY "high" (for clear printed text/well-written print), "medium" (for average cursive/regular handwriting), or "low" (for scribbles, smudges, or highly ambiguous notes).

Also, extract a list of "unparsed_lines":
- "unparsed_lines": a list of strings containing any other text lines or handwritten scribbles on the prescription that look like drug names, dosage instructions, or other clinical notes but couldn't be fully structured or parsed into the medicines list. Return an empty list if none.

For handwritten prescriptions:
- Read the medicine name even if abbreviated (e.g. "Pan D" = "Pan-D", "PCM" = "Paracetamol").
- Infer schedule from notations like "1-0-1" (morning and night), "1-1-1" (morning, afternoon, night), "OD" (once daily = morning), "BD" (twice = morning + night), "TDS" (three times = morning, afternoon, night), "QDS" (four times = all slots).
- Look for handwritten numbers at the bottom or margins as additional medicines.

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "medicines": [
    {
      "name": "Tab Cetil 500mg",
      "dosage": "1",
      "schedule": ["morning", "night"],
      "days": 5,
      "instructions": "After Food",
      "confidence": "high"
    }
  ],
  "unparsed_lines": [
    "Syp. Combiflam 100ml - SOS",
    "Tab. Limcee - once daily"
  ]
}

If a field cannot be determined, use null. Return ONLY the JSON."""


@medicine_bp.route("/api/medicine/scan", methods=["POST"])
def scan_medicine():
    """Scan a medicine image using Gemini Flash and extract details."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    image_file = request.files["image"]
    image_bytes = image_file.read()

    # Open image, convert to RGB, downscale to max 1000px, and convert to base64
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    max_size = 1000
    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    # Encode to Base64
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=75)
    img_base64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    scan_image_url = f"data:image/jpeg;base64,{img_base64_str}"

    # Call Gemini API
    try:
        api_key = current_app.config["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        response = model.generate_content([SCAN_PROMPT, img])
        raw_text = response.text.strip()

        # Clean up markdown code blocks using robust regex finding
        import re
        json_match = re.search(r'(\{.*\}|\[.*\])', raw_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1).strip()
        else:
            json_str = raw_text

        extracted = json.loads(json_str)
        
        # Normalize: if the API returns a single medicine object instead of a list, wrap it
        if isinstance(extracted, dict):
            if "medicines" not in extracted:
                if "name" in extracted:
                    extracted = {"medicines": [extracted]}
                else:
                    extracted = {"medicines": []}
        elif isinstance(extracted, list):
            extracted = {"medicines": extracted}
        else:
            extracted = {"medicines": []}
    except Exception as e:
        current_app.logger.error(f"Gemini error: {e}")
        extracted = {"medicines": []}

    return jsonify({
        "scan_image_url": scan_image_url,
        "extracted": extracted,
    })


@medicine_bp.route("/api/medicine/add", methods=["POST"])
def add_medicine():
    """Add a medicine entry to the cabinet."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # Handle multipart form (pack image optional)
    name = request.form.get("name")
    dosage = request.form.get("dosage")
    schedule_raw = request.form.get("schedule", "[]")
    scan_image_url = request.form.get("scan_image_url", "")
    target_user_id = request.form.get("target_user_id", type=int)
    if not target_user_id or target_user_id <= 0:
        target_user_id = user.id

    days_raw = request.form.get("days")
    instructions = request.form.get("instructions", "").strip() or None
    target_eye = request.form.get("target_eye", "").strip() or None
    bottle_cap_color = request.form.get("bottle_cap_color", "").strip() or None
    stagger_interval_minutes = request.form.get("stagger_interval_minutes", 10, type=int)
    sequence_order = request.form.get("sequence_order", 1, type=int)

    if not name:
        return jsonify({"error": "Medicine name is required"}), 400

    # Security check: Ensure target user belongs to the same family
    if target_user_id != user.id:
        target = User.query.get(target_user_id)
        if not target or (target.family_id and target.family_id != user.family_id):
            return jsonify({"error": "Forbidden - Target user is not in your family"}), 403

    try:
        schedule = json.loads(schedule_raw)
    except Exception:
        schedule = []

    days = None
    if days_raw is not None and days_raw.strip():
        try:
            days = int(days_raw)
        except (ValueError, TypeError):
            days = None

    pack_image_url = None
    if "pack_image" in request.files:
        pack_file = request.files["pack_image"]
        pack_img = Image.open(pack_file).convert("RGB")
        max_size = 800
        if max(pack_img.size) > max_size:
            pack_img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        buffered = io.BytesIO()
        pack_img.save(buffered, format="JPEG", quality=75)
        pack_img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        pack_image_url = f"data:image/jpeg;base64,{pack_img_base64}"

    entry = MedicineEntry(
        user_id=target_user_id,
        family_id=user.family_id,
        name=name,
        dosage=dosage,
        schedule_json=json.dumps(schedule),
        days=days,
        instructions=instructions,
        target_eye=target_eye,
        bottle_cap_color=bottle_cap_color,
        stagger_interval_minutes=stagger_interval_minutes,
        sequence_order=sequence_order,
        scan_image_url=scan_image_url,
        pack_image_url=pack_image_url,
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({"message": "Medicine added", "medicine": entry.to_dict()}), 201


@medicine_bp.route("/api/medicine/cabinet", methods=["GET"])
def get_cabinet():
    """Get all medicines for a user (optionally another family member)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401

    if current_user.family_id:
        medicines = MedicineEntry.query.filter_by(family_id=current_user.family_id).order_by(
            MedicineEntry.created_at.desc()
        ).all()
    else:
        medicines = MedicineEntry.query.filter_by(user_id=current_user.id).order_by(
            MedicineEntry.created_at.desc()
        ).all()

    # Timezone-aware date calculations
    from datetime import timedelta
    
    tz_offset = request.args.get("tz_offset", 0, type=int) # minutes, e.g. -330 for India
    local_date_str = request.args.get("local_date")
    
    if local_date_str:
        try:
            local_date_obj = datetime.strptime(local_date_str, "%Y-%m-%d").date()
        except ValueError:
            local_date_obj = date.today()
    else:
        local_date_obj = date.today()
        
    local_start = datetime.combine(local_date_obj, datetime.min.time())
    local_end = datetime.combine(local_date_obj, datetime.max.time())
    
    # Client timezone offset is defined as: UTC = Local + offset
    today_start = local_start + timedelta(minutes=tz_offset)
    today_end = local_end + timedelta(minutes=tz_offset)

    medicine_dicts = []
    for med in medicines:
        med_dict = med.to_dict()
        today_logs = MedicineLog.query.filter(
            MedicineLog.entry_id == med.id,
            MedicineLog.logged_at >= today_start,
            MedicineLog.logged_at <= today_end,
        ).all()
        med_dict["today_logs"] = [l.time_slot for l in today_logs]
        medicine_dicts.append(med_dict)

    return jsonify({"medicines": medicine_dicts})


@medicine_bp.route("/api/medicine/log", methods=["POST"])
def log_medicine():
    """Log a medicine dose as taken."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    entry_id = data.get("entry_id")
    time_slot = data.get("time_slot")

    if not entry_id or not time_slot:
        return jsonify({"error": "entry_id and time_slot are required"}), 400

    entry = MedicineEntry.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Medicine not found"}), 404

    # Can log for yourself or family members
    if entry.family_id and entry.family_id != user.family_id and entry.user_id != user.id:
        return jsonify({"error": "Forbidden"}), 403

    # Dose logging window validation (30-min restriction)
    default_times = {
        "morning": (8, 0),
        "afternoon": (13, 0),
        "evening": (18, 0),
        "night": (22, 0),
    }
    
    target_user = User.query.get(entry.user_id)
    custom_times = {}
    if target_user and target_user.notif_times_json:
        try:
            custom_times = json.loads(target_user.notif_times_json)
        except Exception:
            pass
            
    time_str = custom_times.get(time_slot, "")
    if time_str:
        try:
            h, m = map(int, time_str.split(":"))
        except ValueError:
            h, m = default_times.get(time_slot, (8, 0))
    else:
        h, m = default_times.get(time_slot, (8, 0))
        
    tz_offset = user.timezone_offset or 0
    now_utc = datetime.utcnow()
    user_local = now_utc - timedelta(minutes=tz_offset)
    
    scheduled_time = datetime.combine(user_local.date(), time(h, m))
    allowed_start = scheduled_time - timedelta(minutes=30)
    
    if user_local < allowed_start:
        wait_seconds = (allowed_start - user_local).total_seconds()
        wait_minutes = int(wait_seconds / 60) + 1
        return jsonify({
            "error": f"Dose logging opens 30 minutes before the scheduled time. Please try again in {wait_minutes} minutes."
        }), 400

    log = MedicineLog(
        entry_id=entry_id,
        logged_by_user_id=user.id,
        time_slot=time_slot,
        caregiver_notified=True,
    )
    db.session.add(log)
    db.session.commit()

    # Trigger real-time caregiver remote alert
    try:
        from notification_helpers import notify_caregivers_dose_taken
        patient_name = target_user.name if target_user else user.name
        notify_caregivers_dose_taken(
            family_id=user.family_id,
            patient_name=patient_name,
            med_name=entry.name,
            target_eye=entry.target_eye,
            time_slot=time_slot,
            logged_by_id=user.id,
        )
    except Exception as exc:
        current_app.logger.error("Error triggering caregiver alert: %s", exc)

    return jsonify({"message": "Dose logged", "log": log.to_dict()}), 201


@medicine_bp.route("/api/medicine/delete/<int:entry_id>", methods=["DELETE"])
def delete_medicine(entry_id):
    """Permanently delete a medicine entry from the cabinet."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    entry = MedicineEntry.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Medicine not found"}), 404

    # Security check: Can only delete if it belongs to you or your family
    if entry.family_id and entry.family_id != user.family_id and entry.user_id != user.id:
        return jsonify({"error": "Forbidden"}), 403

    # Delete all associated logs first
    MedicineLog.query.filter_by(entry_id=entry_id).delete()
    db.session.delete(entry)
    db.session.commit()

    return jsonify({"message": "Medicine permanently deleted"})


@medicine_bp.route("/api/medicine/update/<int:entry_id>", methods=["POST"])
def update_medicine(entry_id):
    """Update an existing medicine entry."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    entry = MedicineEntry.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Medicine entry not found"}), 404

    # Security: Ensure entry belongs to your family
    if entry.family_id != user.family_id:
        return jsonify({"error": "Forbidden"}), 403

    name = request.form.get("name")
    dosage = request.form.get("dosage")
    schedule_raw = request.form.get("schedule")
    days_raw = request.form.get("days")
    instructions = request.form.get("instructions")
    target_eye = request.form.get("target_eye")
    bottle_cap_color = request.form.get("bottle_cap_color")
    stagger_interval_minutes = request.form.get("stagger_interval_minutes", type=int)
    sequence_order = request.form.get("sequence_order", type=int)

    if name:
        entry.name = name.strip()
    if dosage is not None:
        entry.dosage = dosage.strip() or None
    if instructions is not None:
        entry.instructions = instructions.strip() or None
    if target_eye is not None:
        entry.target_eye = target_eye.strip() or None
    if bottle_cap_color is not None:
        entry.bottle_cap_color = bottle_cap_color.strip() or None
    if stagger_interval_minutes is not None:
        entry.stagger_interval_minutes = stagger_interval_minutes
    if sequence_order is not None:
        entry.sequence_order = sequence_order

    if schedule_raw is not None:
        try:
            schedule = json.loads(schedule_raw)
            entry.schedule_json = json.dumps(schedule)
        except Exception:
            pass

    if days_raw is not None:
        if days_raw.strip():
            try:
                entry.days = int(days_raw)
            except (ValueError, TypeError):
                entry.days = None
        else:
            entry.days = None

    if "pack_image" in request.files:
        pack_file = request.files["pack_image"]
        pack_img = Image.open(pack_file).convert("RGB")
        max_size = 800
        if max(pack_img.size) > max_size:
            pack_img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        buffered = io.BytesIO()
        pack_img.save(buffered, format="JPEG", quality=75)
        pack_img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        entry.pack_image_url = f"data:image/jpeg;base64,{pack_img_base64}"

    db.session.commit()
    return jsonify({"message": "Medicine updated", "medicine": entry.to_dict()})


@medicine_bp.route("/uploads/<filename>")
def serve_upload(filename):
    """Serve uploaded images."""
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    return send_from_directory(upload_dir, filename)
