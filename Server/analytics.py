"""
Server-side analytics (GA4 Measurement Protocol).

Fires product events for things that can happen without a browser attached
(headless/CLI flow runs, remote/Slurm runs, runs that outlive the webview).
Mirrors the consent gate used by the frontend (Views/Utils/analytics.tsx):
if the user has not opted in, nothing is ever sent.
"""

import json
import logging
import os
import threading
import typing
import uuid

import requests

MEASUREMENT_ID = "G-D9DT7B1QHG"
_COLLECT_URL = "https://www.google-analytics.com/mp/collect"
_TIMEOUT_S = 3


def _apiSecret() -> typing.Optional[str]:
    return os.getenv("HORUS_GA_API_SECRET")


def getInstallID(appSupportDir: str) -> str:
    """
    Loads the analytics install id (GA4 client_id) persisted under appSupportDir,
    creating one if it does not exist yet. Shared by the server and by the standalone
    flow-run subprocess so both agree on the same id for a given app support directory.
    """

    idPath = os.path.join(appSupportDir, "analytics_id.json")

    try:
        with open(idPath, "r", encoding="utf-8") as f:
            return json.load(f)["installID"]
    except (OSError, json.JSONDecodeError, KeyError):
        pass

    installID = str(uuid.uuid4())
    try:
        with open(idPath, "w", encoding="utf-8") as f:
            json.dump({"installID": installID}, f)
    except OSError as exc:
        logging.getLogger("Horus").warning("Could not persist analytics id: %s", exc)

    return installID


def track(
    clientID: str,
    name: str,
    params: typing.Optional[typing.Dict[str, typing.Any]] = None,
    userID: typing.Optional[str] = None,
    consentGiven: bool = False,
) -> None:
    """
    Fire-and-forget a GA4 event. No-ops silently if consent was not given or
    the API secret is not configured. Never raises into the caller.

    :param clientID: stable per-install id (GA4 client_id)
    :param name: GA4 event name
    :param params: event params (counts/status only, never PII)
    :param userID: hashed user id, if known
    :param consentGiven: the user's current analytics consent
    """

    if not consentGiven:
        return

    apiSecret = _apiSecret()
    if not apiSecret:
        return

    payload: typing.Dict[str, typing.Any] = {
        "client_id": clientID,
        "events": [{"name": name, "params": {**(params or {}), "source": "server"}}],
    }

    if userID:
        payload["user_id"] = userID

    def _send():
        try:
            requests.post(
                _COLLECT_URL,
                params={"measurement_id": MEASUREMENT_ID, "api_secret": apiSecret},
                json=payload,
                timeout=_TIMEOUT_S,
            )
        except requests.RequestException as exc:
            logging.getLogger("Horus").debug("Analytics event %s failed: %s", name, exc)

    threading.Thread(target=_send, daemon=True).start()
