import json
import pytest
from unittest.mock import patch, MagicMock
from Server.RemotesManager import RemotesAPI, RemotesManager
from App import AppDelegate
import os


@pytest.mark.parametrize(
    "selected_remote, local, expected_is_local, expected_name, expected_workdir",
    [
        (
            {
                "name": "Test",
                "host": "example.com",
                "port": 22,
                "username": "testuser",
                "password": "testpass",
                "keyPath": "/path/to/key",
            },
            False,
            False,
            "Test",
            "~/.horus/",
        ),
        (None, True, True, "Local", "/tmp/current/directory/"),
    ],
)
def test_init(selected_remote, local, expected_is_local, expected_name, expected_workdir):
    with patch("os.getcwd", return_value="/tmp/current/directory/"):
        with patch("fabric.Connection") as mock_conn:
            with patch("Server.RemotesManager.RemotesAPI.command") as mock_command:
                mock_connection_instance = MagicMock(spec=["open", "is_connected", "close"])
                mock_conn.return_value = mock_connection_instance
                mock_command.return_value = "~"
                instance = RemotesAPI(selected_remote, local)
                instance.connect()
                assert instance.isLocal == expected_is_local
                assert instance.name == expected_name
                assert instance.workDir == expected_workdir
                if not local:
                    assert instance.host == selected_remote.get("host", None)
                    assert instance.port == selected_remote.get("port", 22)
                    assert instance.username == selected_remote.get("username", None)
                    assert instance.password == selected_remote.get("password", None)
                    assert instance.key == selected_remote.get("keyPath", None)
                    assert instance.proxyCommand == selected_remote.get("proxyCommand", None)
                mock_connection_instance.assert_not_called()


@pytest.fixture
def mock_remotes_api_local():
    with patch("os.getcwd", return_value="/tmp/current/directory/"):
        with patch("fabric.Connection") as mock_conn:
            mock_connection_instance = MagicMock(spec=["open", "is_connected", "close"])
            mock_conn.return_value = mock_connection_instance
            instance = RemotesAPI(None, True)
            instance.workDir = "."
            instance.connect()
            yield instance
            instance.disconnect()


def test_transfer_to_local(mock_remotes_api_local):

    # Mock the subprocess.run function
    with patch("subprocess.run", return_value=MagicMock(returncode=0)) as mock_run:

        source_path = "/tmp/path/to/local/file.txt"

        # Create the source path
        os.makedirs(os.path.dirname(source_path), exist_ok=True)
        with open(source_path, "w") as f:
            f.write("Test content")

        destination_path = "/tmp/remote/file.txt"

        # Mocking internal transfer function
        mock_remotes_api_local._internalTransferTo = MagicMock()

        # Call the method
        result = mock_remotes_api_local.transferTo(source_path, destination_path)

        # Assertions
        assert result == destination_path
        mock_remotes_api_local._internalTransferTo.assert_not_called()

        # Assert that subprocess.run was called with the correct arguments
        mock_run.assert_any_call(
            f"cp -r {source_path} {destination_path}",
            shell=True,
            stdout=-1,
            stderr=-1,
            stdin=-3,
            timeout=None,
            text=True,
            check=False,
            env=None,
        )


def test_transfer_from_local(mock_remotes_api_local):
    source_path = "/tmp/path/to/local/file.txt"
    destination_path = "/tmp/remote/path/file.txt"

    # Create the source path
    os.makedirs(os.path.dirname(source_path), exist_ok=True)
    with open(source_path, "w") as f:
        f.write("Test content")

    with patch("subprocess.run", return_value=MagicMock(returncode=0)) as mock_run:

        # Mocking internal transfer function
        mock_remotes_api_local._internalTransferFrom = MagicMock()

        # Call the method
        result = mock_remotes_api_local.transferFrom(source_path, destination_path)

        # Assertions
        assert result == destination_path
        mock_remotes_api_local._internalTransferFrom.assert_not_called()

        # Assert that subprocess.run was called with the correct arguments
        mock_run.assert_any_call(
            f"cp -r {source_path} {destination_path}",
            shell=True,
            stdout=-1,
            stderr=-1,
            stdin=-3,
            timeout=None,
            text=True,
            check=False,
            env=None,
        )


@pytest.fixture
def mock_remotes_api_remote():
    with patch("os.getcwd", return_value="/tmp/current/directory/"):
        with patch("fabric.Connection") as mock_conn:
            mock_connection_instance = MagicMock(
                spec=["open", "is_connected", "close", "get", "run"]
            )
            # Mocking the run method to return a MagicMock with failed property set to False
            mock_run_output = MagicMock()
            setattr(mock_run_output, "failed", False)
            mock_connection_instance.run.return_value = mock_run_output
            mock_conn.return_value = mock_connection_instance

            instance = RemotesAPI(
                {
                    "name": "Test",
                    "host": "example.com",
                    "port": 22,
                    "username": "testuser",
                    "password": "testpass",
                    "keyPath": "/path/to/key",
                }
            )
            instance.workDir = "."
            instance.connect()
            yield instance
            instance.disconnect()


def test_transfer_to_remote(mock_remotes_api_remote):
    source_path = "/path/to/local/file.txt"
    destination_path = "/remote/path/"
    expected_destination = "/remote/path/file.txt"

    # Mocking internal transfer function
    mock_remotes_api_remote._internalTransferTo = MagicMock()

    # Call the method
    result = mock_remotes_api_remote.transferTo(source_path, destination_path)

    # Assertions
    assert result == expected_destination
    mock_remotes_api_remote._internalTransferTo.assert_called_once_with(
        source_path, destination_path
    )


def test_transfer_from_remote(mock_remotes_api_remote):
    source_path = "/path/to/remote/file.txt"
    destination_path = "/tmp/local/path"
    expected_destination = "/tmp/local/path"

    # Mocking internal transfer function
    mock_remotes_api_remote._internalTransferFrom = MagicMock()

    # Call the method
    result = mock_remotes_api_remote.transferFrom(source_path, destination_path)

    # Assertions
    assert os.path.dirname(os.path.dirname(result)) == expected_destination
    mock_remotes_api_remote._internalTransferFrom.assert_called_once()


def test_local_command_uses_su_when_credentials_are_configured():
    local_config = {
        "name": "Local",
        "type": "local",
        "username": "targetuser",
        "password": "targetpass",
    }
    instance = RemotesAPI(local_config)

    with patch(
        "subprocess.run", return_value=MagicMock(returncode=0, stdout="ok", stderr="")
    ) as mock_run:
        out = instance.command("whoami", env={"TEST_VAR": "1"})

    assert out == "ok\n"
    called_command = mock_run.call_args[0][0]
    assert "su targetuser -c" in called_command
    assert "whoami" in called_command
    assert "export TEST_VAR=1;" in called_command
    assert mock_run.call_args.kwargs["stdin"] == -1
    assert mock_run.call_args.kwargs["input"] == "targetpass\n"
    assert mock_run.call_args.kwargs["env"] is None


def test_connect_remote_local_reads_local_config(tmp_path):
    remotes_config = {
        "Local": {
            "name": "Local",
            "type": "local",
            "username": "configured_user",
            "password": "configured_password",
        }
    }
    with open(tmp_path / "remotes.json", "w", encoding="utf-8") as handle:
        json.dump(remotes_config, handle)

    manager = RemotesManager(str(tmp_path))

    with patch("Server.RemotesManager.remotes_manager.RemotesAPI") as mock_api:
        remote_instance = MagicMock()
        remote_instance.isConnected = True
        remote_instance.name = "Local"
        mock_api.return_value = remote_instance

        manager.connectRemote("Local")

    mock_api.assert_called_once_with(
        remotes_config["Local"], local=False, requireLocalCredentials=False
    )


def test_get_remote_api_local_requires_config_in_webapp_mode(tmp_path):
    manager = RemotesManager(str(tmp_path), requireLocalConfig=True)

    with pytest.raises(Exception, match="requires a configured 'Local' remote"):
        manager.getRemoteAPI("Local")
