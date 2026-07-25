import logging
from flask import Blueprint
from routes.notifications import telegram_webhook as notif_webhook

log = logging.getLogger(__name__)
telegram_bp = Blueprint("telegram", __name__)

# Legacy blueprint alias - delegates to unified notifications webhook
@telegram_bp.route("/api/telegram/legacy-webhook", methods=["POST"])
def legacy_webhook():
    return notif_webhook()
