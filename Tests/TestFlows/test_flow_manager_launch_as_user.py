import types
from unittest.mock import patch

import pytest

from Server.FlowManager.flow_manager import FlowManager
from Server.RemotesManager import RemotesManager


def _settings_mock(values: dict[str, object]):
    def _get_setting(key: str):
        if key not in values:
            raise Exception(f"Missing mocked setting: {key}")
        return types.SimpleNamespace(value=values[key])

    return types.SimpleNamespace(getSetting=_get_setting)


def test_build_impersonated_command_disabled(tmp_path):
    manager = FlowManager(str(tmp_path))
    command = ["python", "Horus.py", "--flow", "test.flow"]
    settings = _settings_mock(
        {
            "runFlowsAsLocalRemoteUser": False,
            "localFlowLaunchMethod": "sudo",
        }
    )

    wrapped = manager._buildImpersonatedFlowLaunchCommand(command, settings)

    assert wrapped == command


def test_build_impersonated_command_sudo(tmp_path):
    manager = FlowManager(str(tmp_path))
    command = ["python", "Horus.py", "--flow", "test.flow"]
    settings = _settings_mock(
        {
            "runFlowsAsLocalRemoteUser": True,
            "localFlowLaunchMethod": "sudo",
        }
    )

    with patch(
        "Server.FlowManager.flow_manager.RemotesManager._remoteConfig",
        return_value={
            RemotesManager.LOCAL_REMOTE_NAME: {
                "name": RemotesManager.LOCAL_REMOTE_NAME,
                "username": "alice",
            }
        },
    ):
        wrapped = manager._buildImpersonatedFlowLaunchCommand(command, settings)

    assert wrapped == ["sudo", "-n", "-u", "alice", "--", *command]


def test_build_impersonated_command_su(tmp_path):
    manager = FlowManager(str(tmp_path))
    command = ["python", "Horus.py", "--flow", "my flow.flow"]
    settings = _settings_mock(
        {
            "runFlowsAsLocalRemoteUser": True,
            "localFlowLaunchMethod": "su",
        }
    )

    with patch(
        "Server.FlowManager.flow_manager.RemotesManager._remoteConfig",
        return_value={
            RemotesManager.LOCAL_REMOTE_NAME: {
                "name": RemotesManager.LOCAL_REMOTE_NAME,
                "username": "alice",
            }
        },
    ):
        wrapped = manager._buildImpersonatedFlowLaunchCommand(command, settings)

    assert wrapped[0:3] == ["su", "-", "alice"]
    assert wrapped[3] == "-c"
    assert "my flow.flow" not in wrapped[4]


def test_build_impersonated_command_requires_local_username(tmp_path):
    manager = FlowManager(str(tmp_path))
    command = ["python", "Horus.py", "--flow", "test.flow"]
    settings = _settings_mock(
        {
            "runFlowsAsLocalRemoteUser": True,
            "localFlowLaunchMethod": "sudo",
        }
    )

    with patch(
        "Server.FlowManager.flow_manager.RemotesManager._remoteConfig",
        return_value={
            RemotesManager.LOCAL_REMOTE_NAME: {
                "name": RemotesManager.LOCAL_REMOTE_NAME,
                "username": None,
            }
        },
    ):
        with pytest.raises(Exception, match="Local remote username is missing"):
            manager._buildImpersonatedFlowLaunchCommand(command, settings)
