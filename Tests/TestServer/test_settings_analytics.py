"""
Analytics consent is opt-out: a fresh install starts enabled, an install that
never answered the old consent banner (value null) is migrated to the default,
and an explicit user choice is never overwritten.
"""

import json
import os

from Server.SettingsManager import SettingsManager


def _writeUserSettings(appSupportDir, analyticsValue):
    """
    Writes a settings file holding an existing analytics entry. The metadata is copied
    from the defaults so the manager treats it as an unchanged setting and only the
    value is under test.
    """

    with open(os.path.join("App", "default_settings.json"), "r", encoding="utf-8") as f:
        analytics = dict(json.load(f)["analytics"])

    analytics["value"] = analyticsValue

    with open(os.path.join(appSupportDir, "settings.json"), "w", encoding="utf-8") as f:
        json.dump({"analytics": analytics}, f)


def test_fresh_install_enables_analytics(tmp_path):
    manager = SettingsManager(str(tmp_path))

    assert manager.getSetting("analytics").value is True


def test_undecided_install_is_migrated_to_the_default(tmp_path):
    _writeUserSettings(str(tmp_path), None)

    manager = SettingsManager(str(tmp_path))

    assert manager.getSetting("analytics").value is True

    # And the migration is persisted, not re-applied on every launch
    with open(os.path.join(str(tmp_path), "settings.json"), "r", encoding="utf-8") as f:
        assert json.load(f)["analytics"]["value"] is True


def test_explicit_optout_is_never_overwritten(tmp_path):
    _writeUserSettings(str(tmp_path), False)

    manager = SettingsManager(str(tmp_path))

    assert manager.getSetting("analytics").value is False
