"""
Focused regression checks for Server/analytics.py: the consent gate must never
leak requests, and a broken network must never raise into the caller (flow
execution / API requests should not fail because analytics is down).
"""

import os

import pytest
import requests

from Server import analytics


def test_track_noop_without_consent(mocker):
    post = mocker.patch("requests.post")

    analytics.track("client-1", "app_launch", consentGiven=False)

    post.assert_not_called()


def test_track_noop_without_api_secret(mocker, monkeypatch):
    monkeypatch.delenv("HORUS_GA_API_SECRET", raising=False)
    post = mocker.patch("requests.post")

    analytics.track("client-1", "app_launch", consentGiven=True)

    post.assert_not_called()


def test_track_never_raises_on_network_failure(mocker, monkeypatch):
    monkeypatch.setenv("HORUS_GA_API_SECRET", "test-secret")
    mocker.patch("requests.post", side_effect=requests.RequestException("boom"))

    # Should not raise, even though the background thread's request fails
    analytics.track("client-1", "app_launch", consentGiven=True)


def test_get_install_id_persists(tmp_path):
    first = analytics.getInstallID(str(tmp_path))
    second = analytics.getInstallID(str(tmp_path))

    assert first == second
    assert os.path.exists(os.path.join(str(tmp_path), "analytics_id.json"))
