import pytest
from unittest.mock import patch, MagicMock
from Server.RemotesManager import RemotesAPI
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
        (None, True, True, "Local", "/current/directory/"),
    ],
)
def test_init(selected_remote, local, expected_is_local, expected_name, expected_workdir):
    with patch("os.getcwd", return_value="/current/directory/"):
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
    with patch("os.getcwd", return_value="/current/directory/"):
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

        source_path = "/path/to/local/file.txt"
        destination_path = "/remote/path"
        expected_path = "/remote/path/file.txt"

        # Mocking internal transfer function
        mock_remotes_api_local._internalTransferTo = MagicMock()

        # Call the method
        result = mock_remotes_api_local.transferTo(source_path, destination_path)

        # Assertions
        assert result == expected_path
        mock_remotes_api_local._internalTransferTo.assert_not_called()

        # Assert that subprocess.run was called with the correct arguments
        mock_run.assert_called_once_with(
            ["cp", "-r", "/path/to/local/file.txt", "/remote/path"], check=True
        )


def test_transfer_from_local(mock_remotes_api_local):
    source_path = "/path/to/local/file.txt"
    destination_path = "/remote/path"
    expected_path = "/remote/path/file.txt"

    with patch("subprocess.run", return_value=MagicMock(returncode=0)) as mock_run:

        # Mocking internal transfer function
        mock_remotes_api_local._internalTransferFrom = MagicMock()

        # Call the method
        result = mock_remotes_api_local.transferFrom(source_path, destination_path)

        # Assertions
        assert result == expected_path
        mock_remotes_api_local._internalTransferFrom.assert_not_called()

        # Assert that subprocess.run was called with the correct arguments
        mock_run.assert_called_once_with(
            ["cp", "-r", "/path/to/local/file.txt", "/remote/path"], check=True
        )


@pytest.fixture
def mock_remotes_api_remote():
    with patch("os.getcwd", return_value="/current/directory/"):
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
    destination_path = "/local/path"
    expected_destination = "/local/path"

    # Mocking internal transfer function
    mock_remotes_api_remote._internalTransferFrom = MagicMock()

    # Call the method
    result = mock_remotes_api_remote.transferFrom(source_path, destination_path)

    # Assertions
    assert os.path.dirname(os.path.dirname(result)) == expected_destination
    mock_remotes_api_remote._internalTransferFrom.assert_called_once()
