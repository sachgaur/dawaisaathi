import os
import json
from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db
from routes.auth import auth_bp
from routes.family import family_bp
from routes.medicine import medicine_bp
from routes.notifications import notifications_bp
from routes.telegram import telegram_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    CORS(
        app,
        origins=[app.config["FRONTEND_URL"]],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(family_bp)
    app.register_blueprint(medicine_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(telegram_bp)

    # Create DB tables & uploads folder
    with app.app_context():
        db.create_all()
        os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

        # Auto-migrate SQLite schema for newly added columns if DB already exists
        try:
            from sqlalchemy import text, inspect
            inspector = inspect(db.engine)
            if "medicine_entries" in inspector.get_table_names():
                columns = [c["name"] for c in inspector.get_columns("medicine_entries")]
                if "target_eye" not in columns:
                    db.session.execute(text("ALTER TABLE medicine_entries ADD COLUMN target_eye VARCHAR(32)"))
                if "bottle_cap_color" not in columns:
                    db.session.execute(text("ALTER TABLE medicine_entries ADD COLUMN bottle_cap_color VARCHAR(32)"))
                if "stagger_interval_minutes" not in columns:
                    db.session.execute(text("ALTER TABLE medicine_entries ADD COLUMN stagger_interval_minutes INTEGER DEFAULT 10"))
                if "sequence_order" not in columns:
                    db.session.execute(text("ALTER TABLE medicine_entries ADD COLUMN sequence_order INTEGER DEFAULT 1"))
                db.session.commit()

            if "medicine_logs" in inspector.get_table_names():
                columns = [c["name"] for c in inspector.get_columns("medicine_logs")]
                if "caregiver_notified" not in columns:
                    db.session.execute(text("ALTER TABLE medicine_logs ADD COLUMN caregiver_notified BOOLEAN DEFAULT 0"))
                db.session.commit()
        except Exception as exc:
            app.logger.warning("DB auto-migration note: %s", exc)

        # Migrate old push subscriptions to the new table (if not already there)
        from models import User, PushSubscription
        legacy_users = User.query.filter(
            User.push_subscription_json.isnot(None)
        ).all()
        migrated = 0
        for user in legacy_users:
            if not user.push_subscription_json:
                continue
            endpoint = ""
            try:
                sub_data = json.loads(user.push_subscription_json)
                endpoint = sub_data.get("endpoint", "")
            except Exception:
                pass
            if not endpoint:
                continue
            already = PushSubscription.query.filter_by(endpoint=endpoint).first()
            if not already:
                db.session.add(PushSubscription(
                    user_id=user.id,
                    endpoint=endpoint,
                    subscription_json=user.push_subscription_json,
                ))
                migrated += 1
        if migrated:
            db.session.commit()

    # Health check route for UptimeRobot
    @app.route("/")
    def health_check():
        return {"status": "healthy", "service": "DawaiSathi API"}, 200

    # Start notification scheduler.
    # WERKZEUG_RUN_MAIN guard: under Flask's debug reloader the parent
    # process is only a file-watcher; the child (WERKZEUG_RUN_MAIN="true")
    # runs the real app. Under gunicorn there is no reloader so we always
    # start the scheduler when app.debug is False OR when Werkzeug confirms
    # we are in the child process. Render also sets RENDER=true automatically.
    werkzeug_main = os.environ.get("WERKZEUG_RUN_MAIN")
    if not app.debug or werkzeug_main == "true" or os.environ.get("RENDER") == "true":
        from scheduler import init_scheduler
        init_scheduler(app)

        # Automatically register Telegram webhook OR start long-polling for localhost
        token = app.config.get("TELEGRAM_BOT_TOKEN", "")
        base_url = app.config.get("TELEGRAM_WEBHOOK_URL", "").rstrip("/")
        if token and base_url and "https://" in base_url and "your-tunnel-url" not in base_url:
            import requests
            webhook_url = f"{base_url}/api/telegram/webhook"
            try:
                resp = requests.post(
                    f"https://api.telegram.org/bot{token}/setWebhook",
                    json={"url": webhook_url},
                    timeout=10,
                )
                if resp.ok:
                    app.logger.info(f"Telegram webhook auto-set to: {webhook_url}")
                else:
                    app.logger.error(f"Failed to auto-set Telegram webhook: {resp.json()}")
            except Exception as exc:
                app.logger.error(f"Error setting Telegram webhook on startup: {exc}")
        elif token and "your-telegram-bot-token" not in token:
            # Start local long-polling thread so localhost works without ngrok / public URL!
            import threading, time, requests

            def _telegram_polling_worker():
                time.sleep(2)
                with app.app_context():
                    try:
                        requests.post(
                            f"https://api.telegram.org/bot{token}/deleteWebhook",
                            json={"drop_pending_updates": False},
                            timeout=5,
                        )
                        app.logger.info("Cleared Telegram webhook for local long-polling")
                    except Exception:
                        pass

                    from routes.notifications import process_telegram_update

                    offset = 0
                    app.logger.info("🤖 Telegram Bot long-polling active for localhost!")
                    while True:
                        try:
                            resp = requests.get(
                                f"https://api.telegram.org/bot{token}/getUpdates",
                                params={"offset": offset, "timeout": 10},
                                timeout=15,
                            )
                            if resp.ok:
                                updates = resp.json().get("result", [])
                                for update in updates:
                                    offset = max(offset, update["update_id"] + 1)
                                    with app.app_context():
                                        process_telegram_update(update)
                            else:
                                time.sleep(3)
                        except Exception:
                            time.sleep(3)

            t = threading.Thread(target=_telegram_polling_worker, daemon=True)
            t.start()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
