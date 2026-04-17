# pylint: disable=invalid-name
"""
This module contains the RemotesAPI class, which is used to manage the
remote connections to the run Slurm blocks.
"""

# Standard library imports
import contextlib
import json
import logging
import os
import re
import secrets
import shlex
import subprocess
import tarfile

# Types
import typing as t

# Third party imports
import fabric
from cryptography.fernet import Fernet

LOCAL_REMOTE_NAME = "Local"

_VALID_ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

_ENC_PREFIX = "enc$"


class _PasswordCrypto:
    """
    Fernet-based password encryption tied to a per-installation key file.
    """

    def __init__(self, key_path: str) -> None:
        self._key_path = key_path
        self._fernet = Fernet(self._load_or_create_key())

    def _load_or_create_key(self) -> bytes:
        if os.path.exists(self._key_path):
            with open(self._key_path, "rb") as f:
                return f.read().strip()
        key = Fernet.generate_key()
        with open(self._key_path, "wb") as f:
            f.write(key)
        os.chmod(self._key_path, 0o600)
        return key

    def encrypt(self, plaintext: str) -> str:
        """
        Return a prefixed ciphertext string safe to store in JSON.
        """
        token = self._fernet.encrypt(plaintext.encode()).decode()
        return f"{_ENC_PREFIX}{token}"

    def decrypt(self, value: str) -> str:
        """
        Decrypt a value produced by encrypt(). Plain-text values are returned as-is.
        """
        if not value.startswith(_ENC_PREFIX):
            return value
        token = value[len(_ENC_PREFIX):]
        return self._fernet.decrypt(token.encode()).decode()


def _validate_env(env: dict) -> None:
    """Raise ValueError if any env key is not a safe shell identifier."""
    for key in env:
        if not _VALID_ENV_KEY_RE.match(key):
            raise ValueError(
                f"Invalid environment variable name: {key!r}. "
                "Only letters, digits, and underscores are allowed."
            )


class CommandFailed(Exception):
    cmd: str
    stdout: str
    stderr: str

    def __init__(self, message: str, cmd: str, stdout: str, stderr: str) -> None:
        super().__init__(message)

        self.cmd = cmd
        self.stdout = stdout
        self.stderr = stderr


class ConnectionFailed(Exception):
    """
    Exception raised when a remote cannot be connected
    """


class RemotesAPI:
    """
    This class manages the connnections to the remote clusters.
    - Send/Receive files
    - Perform commands...
    """

    conn: fabric.Connection
    """
    The connection to the remote cluster.
    """

    host: str
    """
    The hostname of the remote cluster.
    """

    port: int = 22
    """
    The port to connect to the remote cluster on.
    """

    username: t.Optional[str] = None
    """
    The username to connect to the remote cluster with.
    """

    password: t.Optional[str] = None
    """
    The password to connect to the remote cluster with.
    """

    key: t.Optional[str] = None
    """
    The key to connect to the remote cluster with.
    """

    proxyCommand: t.Optional[str] = None
    """
    The proxy command to connect to the remote cluster with.
    """

    workDir: str = "~/.horus/"
    """
    The path to the working dir folder on the remote.
    """

    isLocal: bool = False
    """
    Whether the remote is local or not.
    """

    name: str = LOCAL_REMOTE_NAME
    """
    The selected remote name.
    """

    loadProfile: bool = False
    """
    Whether to load the user profile when logging in ina remote shell.
    This can slow down command executions.
    """

    _local_ssh_verified: bool = False
    """
    Whether the local SSH connectivity check has already succeeded.
    Set once on the first successful check; avoids a round-trip per command.
    """

    def __init__(
        self,
        selectedRemote: t.Dict[str, t.Any],
    ):
        """
        Create a new ClusterAPI object.

        :param selectedRemote: The remote to connect to.
        """
        name = selectedRemote.get("name")

        if name is None:
            raise ValueError("Remote configuration must include a 'name' field.")

        workDir = selectedRemote.get("workDir") or self.workDir
        if name == RemotesManager.LOCAL_REMOTE_NAME:
            self.username = selectedRemote.get("username") or None
            self.password = selectedRemote.get("password") or None
            self.isLocal = True

            # For local, set the workDir as the current directory
            self.workDir = os.getcwd()

            return

        # Set the remote details
        self.name = selectedRemote.get("name") or "Unnamed Remote"
        host = selectedRemote.get("host")

        if not host:
            raise ValueError(f"Invalid host for remote {selectedRemote}")

        self.host = host
        self.port = selectedRemote.get("port") or 22
        self.username = selectedRemote.get("username") or None
        self.password = selectedRemote.get("password") or None
        self.key = selectedRemote.get("keyPath") or None
        self.proxyCommand = selectedRemote.get("proxyCommand") or None
        self.remoteName = selectedRemote.get("name") or "Unnamed Remote"
        self.workDir = workDir
        self.loadProfile = selectedRemote.get("loadProfile") or self.loadProfile

    def connect(self):
        """
        Connect to the remote.
        """

        if self.isLocal:
            return

        # Check if connection details are provided
        if self.host is None:
            raise ConnectionFailed("No hostname provided.")
        if self.port is None:
            raise ConnectionFailed("No port provided.")
        if self.username is None:
            raise ConnectionFailed("No username provided.")
        if self.password is None and self.key is None:
            raise ConnectionFailed("No password or key provided.")

        # Set kwargs for connection
        connect_kwargs = {}  # pylint: disable=invalid-name

        if self.password is not None:
            connect_kwargs["password"] = self.password

        if self.key is not None:
            connect_kwargs["key_filename"] = self.key

        # Connect
        if self.password is not None or self.key is not None:
            try:
                self.conn = fabric.Connection(
                    host=self.host,
                    port=self.port,
                    user=self.username,
                    connect_kwargs={
                        **connect_kwargs,
                    },
                    gateway=self.proxyCommand or None,
                    connect_timeout=8,
                )
                self.conn.open()
            except Exception as exc:
                logging.getLogger("Horus").error(
                    "Could not connect to the remote %s: %s", self.host, str(exc)
                )
                raise ConnectionFailed(
                    f"Could not connect to the remote {self.host}: {exc}"
                ) from exc
        else:
            raise ConnectionFailed("No connection method provided.")

        if "~" in self.workDir:
            # Replace the ~ with the user home directory for compatibility
            # with the fabric library
            self.workDir = self.workDir.replace("~", self.userHome)

        # Create the horus folder in the remote home directory if it does not exist
        try:
            self.command(f"test -d {self.workDir}")
        except Exception:
            self.command(f"mkdir -p {self.workDir}")

    @property
    def userHome(self):
        """
        Get the path to the remote home directory.

        :return: The path to the remote home directory.
        """
        return self.command("echo $HOME")

    def command(  # pylint: disable=method-hidden
        self,
        command: str,
        timeout: t.Optional[int] = None,
        forceLocal: bool = False,
        mergeStdErr: bool = True,
        env: t.Optional[dict[str, str]] = None,
    ) -> str:  # pylint: disable=method-hidden
        """
        Runs a command on the remote (or locally).

        :param command: The command to run.
        :param timeout: The timeout in seconds.
        :param forceLocal: If True, the command will be
        executed locally even if the block has a remote selected.
        :param mergeStdErr: If True (default) will append the stdErr of the command to the output.

        :return: The output of the command.
        """

        if self.isLocal or forceLocal:
            # Run command locally
            logging.getLogger("Horus").info(
                "Running command: '%s' on local machine,", command
            )
            failed = False
            out = ""
            err = ""
            try:
                if os.environ.get("HORUS_REQUIRES_COMMAND_CREDENTIALS") == "yes":
                    if not self.username or not self.password:
                        raise CommandFailed(
                            "You need to configure local remote credentials in the Remotes panel.",
                            cmd=command,
                            stdout="",
                            stderr="",
                        )

                effectiveCommand = command
                stdIn = subprocess.DEVNULL
                runEnv = env

                # If local credentials are configured, impersonate via ssh to localhost.
                if self.isLocal and self.username:
                    # Build the sshpass prefix when a password is provided.
                    if self.password:
                        ssh_prefix = ["sshpass", "-p", self.password]
                        ssh_opts = [
                            "-o",
                            "StrictHostKeyChecking=no",
                            "-o",
                            "ConnectTimeout=3",
                        ]
                    else:
                        ssh_prefix = []
                        ssh_opts = [
                            "-o",
                            "BatchMode=yes",
                            "-o",
                            "StrictHostKeyChecking=no",
                            "-o",
                            "ConnectTimeout=3",
                        ]

                    cmd_check_error = CommandFailed(
                        "You have configured local credentials, but this only works if the "
                        "local machine has an active SSH server on localhost and the user "
                        f"'{self.username}' can authenticate either with a key or with sshpass. If this was a mistake, "
                        "please remove the local credentials configuration in the Remotes panel.",
                        cmd=command,
                        stdout="",
                        stderr="",
                    )
                    if not self._local_ssh_verified:
                        try:
                            ssh_check = subprocess.run(
                                [
                                    *ssh_prefix,
                                    "ssh",
                                    *ssh_opts,
                                    f"{self.username}@localhost",
                                    "exit",
                                ],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL,
                                check=False,
                            )
                        except FileNotFoundError as exc:
                            logging.getLogger("Horus").error(
                                "sshpass is required for local remote with password, but it is not installed: %s",
                                str(exc),
                            )
                            raise cmd_check_error

                        if ssh_check.returncode != 0:
                            raise cmd_check_error

                        self._local_ssh_verified = True

                    # Preserve the caller's working directory inside the SSH session.
                    # If the cd() context manager is active, `command` already starts
                    # with "cd /specific/path && …", so the prepended cd is harmlessly
                    # overridden by that second cd, no interference.
                    cwd = shlex.quote(os.getcwd())
                    cwd_prefix = f"cd {cwd} && "

                    if env:
                        _validate_env(env)
                        env_vars = " ".join(
                            f"export {key}={shlex.quote(value)};"
                            for key, value in env.items()
                        )
                        inner_command = f"{env_vars} {cwd_prefix}{command}".strip()
                    else:
                        inner_command = f"{cwd_prefix}{command}"

                    ssh_opts_str = " ".join(ssh_opts)
                    if self.password:
                        effectiveCommand = (
                            f"sshpass -p {shlex.quote(self.password)} "
                            f"ssh {ssh_opts_str} "
                            f"{shlex.quote(self.username)}@localhost {shlex.quote(inner_command)}"
                        )
                    else:
                        effectiveCommand = (
                            f"ssh {ssh_opts_str} "
                            f"{shlex.quote(self.username)}@localhost {shlex.quote(inner_command)}"
                        )
                    runEnv = None

                processKwargs: dict[str, t.Any] = dict(
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    stdin=stdIn,
                    timeout=timeout,
                    text=True,
                    check=False,
                    env=runEnv,
                )

                process = subprocess.run(
                    effectiveCommand,
                    **processKwargs,
                )

                def logCommandOutput(o: str):
                    if len(o) > 250:
                        logging.getLogger("Horus").debug(
                            "Local command output (truncated): %s",
                            o[:250],
                        )
                    else:
                        logging.getLogger("Horus").debug("Local command output: %s", o)

                # STDOUT
                out = process.stdout.strip() if process.stdout else ""
                logCommandOutput(out)

                # STDERR
                err = process.stderr.strip() if process.stderr else ""
                logCommandOutput(err)

                # If the command failed, raise an exception
                if process.returncode != 0:
                    raise CommandFailed(err, cmd=command, stdout=out, stderr=err)

            except subprocess.TimeoutExpired:
                failed = True

            if failed:
                logging.getLogger("Horus").error("Command timed out: %s", command)
                raise CommandFailed(
                    "Command timed out.", cmd=command, stdout=out, stderr=err
                )

            # Return the stdout and stderr as a string
            return out + "\n" + err if mergeStdErr else out

        # Run command on remote
        # Hide is needed to avoid the output to be printed on the console
        # in_stream is needed to avoid fabric raising OSError (fabric
        # tries to acces sys.stdin which is not available because is mocked
        # with PrintCapturer)
        logging.getLogger("Horus").info(
            "Running command: '%s' on remote '%s'.", command, self.name
        )
        channel = None
        try:
            if not hasattr(self.conn, "transport") or not self.loadProfile:
                # Execute the command the old way
                return self._oldCommand(command, timeout, env)

            if not self.conn.transport:
                raise Exception("Connection is not open.")

            # Get a new channel from the SSH connection
            channel = self.conn.transport.open_session()

            # Set timeout if specified
            if timeout is not None:
                channel.settimeout(timeout)

            # Construct command to source bashrc and execute the actual command
            bash_command = f'bash -l -c "source ~/.bashrc 2>/dev/null || source /etc/bash.bashrc 2>/dev/null; {command}"'

            if env:
                _validate_env(env)
                # Add environment variables to the command
                env_vars = " ".join(
                    f"export {key}={shlex.quote(value)}" for key, value in env.items()
                )
                bash_command = f'bash -l -c "{env_vars}; {bash_command}"'

            # Add timeout if specified for the command itself
            if timeout is not None:
                bash_command = f"timeout {timeout} {bash_command}"

            # Request a pseudo-terminal
            channel.get_pty()

            # Execute the command
            channel.exec_command(bash_command)

            # Read output
            stdout = channel.makefile("r", -1)
            stderr = channel.makefile_stderr("r", -1)

            # Wait for command to complete
            exit_status = channel.recv_exit_status()

            # Get output
            stdout_str = stdout.read().strip()
            stderr_str = stderr.read().strip()

            # Close file objects
            stdout.close()
            stderr.close()

            out = stdout_str.decode("utf-8")
            logging.getLogger("Horus").debug("Remote command output: %s", out)

            if exit_status != 0:
                logging.getLogger("Horus").error(
                    "Command '%s' failed on remote %s with status %d: %s",
                    bash_command,
                    self.name,
                    exit_status,
                    stderr_str,
                )
                raise CommandFailed(out, cmd=command, stdout=out, stderr=out)

            return out

        except Exception as exc:
            logging.getLogger("Horus").debug(
                "Error running command %s on remote %s: %s",
                command,
                self.name,
                str(exc),
            )
            raise exc

        finally:
            # Ensure channel is properly closed
            if channel is not None:
                try:
                    channel.close()
                except:
                    pass

    def _oldCommand(
        self,
        command: str,
        timeout: t.Optional[int] = None,
        env: t.Optional[dict] = None,
    ) -> str:
        # Run command on remote
        # Hide is needed to avoid the output to be printed on the console
        # in_stream is needed to avoid fabric raising OSError (fabric
        # tries to acces sys.stdin which is not available because is mocked
        # with PrintCapturer)
        try:
            # Update the command with the timeout
            if timeout:
                command = "timeout {timeout} {command}".format(
                    timeout=timeout, command=command
                )

            out_cmd = self.conn.run(
                command,
                hide=True,
                in_stream=False,
                env=env,
            )
            out = str(out_cmd.stdout.strip())
            err = str(out_cmd.stderr.strip())

            # If the command failed, raise an exception
            if out_cmd.failed:
                raise CommandFailed(err, cmd=command, stdout=out, stderr=err)

            logging.getLogger("Horus").debug("Remote command output: %s", out)

            # Return the stdout and stderr as a string
            return out
        except Exception as exc:
            logging.getLogger("Horus").debug(
                "Error running command %s on remote %s: %s",
                command,
                self.name,
                str(exc),
            )
            raise exc

    @contextlib.contextmanager
    def cd(self, path: str):
        """
        Context manager to change directory on the remote.

        Works with the command, submitJob and send/get data functions.
        """

        # Save the old command
        oldCommand = self.command

        def commandHook(command: str, *args, **kwargs):
            """
            Hook for the command function.
            """

            newCommand = f"cd {path} && {command}"

            return oldCommand(newCommand, *args, **kwargs)

        # Hook the command function
        self.command = commandHook

        try:
            yield
        finally:
            # Restore the old command
            self.command = oldCommand

    def _internalTransferFrom(self, source: str, destination: str):
        try:
            self.conn.get(source, destination)
        except Exception as exc:
            logging.getLogger("Horus").error(
                "Error getting data from %s to %s: %s", source, destination, str(exc)
            )
            raise Exception(
                f"Error transferring data from {self.remoteName}: {exc}"
            ) from exc

    def _internalTransferTo(self, source: str, destination: str):
        try:
            self.conn.put(source, destination)
        except BaseException as exc:
            logging.getLogger("Horus").error(
                "Error transferring data from %s to %s: %s",
                source,
                destination,
                str(exc),
            )
            raise Exception(
                f"Error transferring data to {self.remoteName}: {exc}"
            ) from exc

    def transferTo(self, source: str, destination: str) -> str:
        """
        Transfer a file from the local machine to the remote.

        If the remote machine is the local one, no file will be moved nor transferred, and the
        source path will be returned.

        :param source: The path to the file on the local machine.
        :param destination: The path to the file on the remote.

        :return: The final path to the file/folder.
        """

        logging.getLogger("Horus").info(
            "Transferring data from %s to %s", source, destination
        )

        if destination is None or destination == "":
            destination = self.workDir

        # If there are spaces in the path, cancel the transfer
        if " " in source:
            raise Exception(f"The source path cannot contain spaces: {source}")

        if " " in destination:
            raise Exception(
                f"The destination path cannot contain spaces: {destination}"
            )

        # Create the destination container folder
        if os.path.isdir(source):
            containerFolder = destination
        else:
            containerFolder = os.path.dirname(destination)

        self.command(f"mkdir -p {containerFolder}")

        if self.isLocal:
            self.command(f"cp -r {source} {destination}")
            return destination

        # Check if the source is a folder
        source = os.path.abspath(source)
        if os.path.isdir(source):
            # Then zip the folder
            logging.getLogger("Horus").info("Zipping local folder %s", source)

            # Get the folder name
            folderName = os.path.basename(source)

            with tarfile.open(f"{source}.tar.gz", "w:gz") as tar:
                tar.add(source, arcname=os.path.basename(source))

            source = os.path.join(os.getcwd(), f"{source}.tar.gz")
            fileName = os.path.basename(source)

            # Send the data to the remote
            destinationFile = f"{os.path.join(destination, fileName)}"
            self._internalTransferTo(source, destinationFile)

            # Remove the zip file
            os.remove(source)

            prevRemoteDir = self.command("pwd")

            # Unzip the remote file
            self.command(f"cd {destination} && tar -xzvf {fileName}")

            # Remove the zip file
            self.command(f"cd {destination} && rm {fileName}")

            # Change dir back
            self.command(f"cd {prevRemoteDir}")

            finalPath = os.path.join(destination, folderName)

            return finalPath

        self._internalTransferTo(source, destination)

        return os.path.join(destination, os.path.basename(source))

    def transferFrom(self, source: str, destination: str) -> str:
        """
        Transfer a file from the remote to the local machine.

        If the remote machine is the local one, no file will be moved nor transferred, and the
        source path will be returned.

        :param source: The path to the file on the remote.
        :param destination: The path to the file on the local machine.

        :return: The final path to the file/folder.
        """

        if source is None or source == "":
            source = self.workDir

        if destination is None or destination == "":
            destination = os.getcwd()

        # If there are spaces in the path, cancel the transfer
        if " " in source:
            raise Exception(f"The source path cannot contain spaces: {source}")

        if " " in destination:
            raise Exception(
                f"The destination path cannot contain spaces: {destination}"
            )

        if self.isLocal:
            if os.path.isdir(source):
                # Create the destination folder
                containerFolder = destination
            else:
                containerFolder = os.path.dirname(destination)

            self.command(f"mkdir -p {containerFolder}")

            self.command(f"cp -r {source} {destination}")
            return destination

        logging.getLogger("Horus").info(
            "Transferring data from %s to %s", source, destination
        )

        # Check if the source is a folder
        destination = os.path.abspath(destination)
        try:
            self.command(f"test -d {source}")

            logging.getLogger("Horus").info("Source %s is a folder.", source)

            # Then zip the folder
            folderName = os.path.basename(source)
            sourceZip = os.path.join(folderName, ".")

            unique_id = secrets.token_hex(6)  # pylint: disable=invalid-name
            zipPath = f"{folderName}-{unique_id}.tar.gz"
            container = os.path.dirname(source)

            logging.getLogger("Horus").info(
                "Zipping remote folder %s into %s", source, zipPath
            )

            self.command(f"cd {container} && tar -czvf {zipPath} {sourceZip}")

            source = os.path.join(container, zipPath)

            # container_local = os.path.dirname(destination)  # pylint: disable=invalid-name
            container_local = destination  # pylint: disable=invalid-name
            os.makedirs(container_local, exist_ok=True)

            destination = os.path.join(destination, zipPath)

            logging.getLogger("Horus").info(
                "Transferring remote folder %s into %s", source, destination
            )

            self._internalTransferFrom(source, destination)

            # Remove the zip file

            logging.getLogger("Horus").info(
                "Removing the generated zip file %s", source
            )

            self.command(f"rm {source}")

            prevLocalDir = os.getcwd()

            logging.getLogger("Horus").info("Unzipping local folder %s", destination)

            # Unzip the local file
            with tarfile.open(destination, "r:gz") as tar:
                logging.getLogger("Horus").debug("Extracting to %s", container_local)
                tar.extractall(path=container_local)

            # Remove the zip file
            os.chdir(container_local)
            subprocess.run(["rm", destination], check=True)

            # Change local dir back
            os.chdir(prevLocalDir)

            return os.path.join(container_local, folderName)

        except Exception:  # pylint: disable=broad-exception-caught
            pass

        self.conn.get(source, destination)

        return os.path.join(destination, os.path.basename(source))

    def disconnect(self):
        """
        Disconnect from the remote.
        """
        try:
            if not self.isLocal and self.conn.is_connected:
                self.conn.close()
        except Exception as exc:  # pylint: disable=broad-exception-caught
            logging.getLogger("Horus").critical(
                "Could not disconnect remote %s: %s", self.name, str(exc)
            )
            raise exc

    def __del__(self):
        """
        Disconnect from the remote when the object is deleted.
        """
        self.disconnect()

    @property
    def isConnected(self):
        """
        Check if the remote is connected.

        :return: True if connected, False otherwise.
        """
        if self.isLocal:
            return True

        try:
            return self.conn.is_connected
        except Exception as exc:  # pylint: disable=broad-exception-caught
            logging.getLogger("Horus").error(
                "Could not check if remote %s is connected: %s", self.name, str(exc)
            )
            return False


class RemotesManager:
    """
    Manages the connection to the remote clusters.
    """

    # The default local name
    LOCAL_REMOTE_NAME = LOCAL_REMOTE_NAME

    remote: t.Optional[RemotesAPI] = None
    """
    The connected remote
    """

    def __init__(self, appSupportDir: str) -> None:
        """
        Instantiate the remotes manager

        :param appSupportDir: The path to the app support directory
        """
        self.appSupportDir = appSupportDir
        self._crypto = _PasswordCrypto(
            os.path.join(appSupportDir, ".horus_keyfile")
        )

        # Configure the local remote if it does not exist
        if not self.remoteExists(self.LOCAL_REMOTE_NAME):
            self.configureRemote(
                {
                    "name": self.LOCAL_REMOTE_NAME,
                    "host": self.LOCAL_REMOTE_NAME,
                    "port": None,
                    "username": None,
                    "password": None,
                    "keyPath": None,
                    "proxyCommand": None,
                    "workDir": None,
                }
            )

    def configureRemote(self, newConfig: t.Dict[str, t.Any]):
        """
        Configures the SSH connection for HPC clusters

        param newConfig: An object containing the ssh configuration
        {
            name: str,
            username: str,
            host: str,
            port: int,
            keyPath: str,
            proxyCommand: str,
            workDir: str
        }
        """

        # Check that the config is valid
        if newConfig.get("name") is None:
            raise Exception("The name of the remote is required")

        # Fix the name of the remote to not have special characters
        newConfig["name"] = newConfig["name"].replace(" ", "_")

        if not newConfig["name"].lower() == self.LOCAL_REMOTE_NAME.lower():
            if newConfig.get("username") is None:
                raise Exception("The user of the remote is required")

            if newConfig.get("host") is None:
                raise Exception("The host of the remote is required")

            if newConfig.get("port") is None:
                raise Exception("The port of the remote is required")

            if newConfig.get("keyPath") is None and newConfig.get("password") is None:
                raise Exception(
                    "Either the keys or the password of the remote is required. None provided."
                )

            if (
                newConfig.get("keyPath") is not None
                and newConfig.get("password") is not None
            ):
                raise Exception(
                    "While configuring a remote either the keys or "
                    "the password is required, not both."
                )

            newKeyPath = newConfig.get("keyPath", None)
            if newKeyPath is not None:
                if isinstance(newKeyPath, list):
                    newKeyPath = newKeyPath[0]
                    newConfig["keyPath"] = newKeyPath

                if not os.path.exists(newKeyPath):
                    raise Exception("The keys file does not exist")

        remotesPath = os.path.join(self.appSupportDir, "remotes.json")

        # Encrypt the password before persisting
        configToStore = dict(newConfig)
        if configToStore.get("password") and not str(configToStore["password"]).startswith(_ENC_PREFIX):
            configToStore["password"] = self._crypto.encrypt(configToStore["password"])

        if os.path.exists(remotesPath):
            # Load and update the existing ssh configuration
            with open(remotesPath, "r", encoding="utf-8") as file:
                remotesConfig: t.Dict[str, t.Any] = json.load(file)

            # Check if the remote already exists
            if configToStore["name"] in remotesConfig.keys():
                # Update the remote
                remotesConfig[configToStore["name"]] = configToStore
            else:
                # Create a new remote
                remotesConfig.update({configToStore["name"]: configToStore})

        else:
            # Create a new ssh configuration
            remotesConfig = {configToStore["name"]: configToStore}

        with open(remotesPath, "w", encoding="utf-8") as file:
            json.dump(remotesConfig, file)

    def listRemotes(self) -> list[dict[str, t.Any]]:
        """
        Loads the ssh configuration file and returns the list of remotes
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        remotesConfig: t.Dict[str, t.Any] = {}
        if not os.path.exists(remotesFile):
            remotesConfig = {}
        else:
            with open(remotesFile, "r", encoding="utf-8") as file:
                remotesConfig = json.load(file)

        # Convert the remotes configuration to a list, stripping passwords
        remotes = []
        for _, config in remotesConfig.items():
            sanitized = dict(config)
            sanitized["password"] = None
            remotes.append(sanitized)

        # Always, if the local remote is not in the list, add it
        if self.LOCAL_REMOTE_NAME not in remotesConfig.keys():
            local_remote_config = {
                "name": self.LOCAL_REMOTE_NAME,
                "host": self.LOCAL_REMOTE_NAME,
                "port": None,
                "username": None,
                "password": None,
                "keyPath": None,
                "proxyCommand": None,
                "workDir": None,
            }
            remotes.append(local_remote_config)

            # Save the local remote configuration to the file
            self.configureRemote(local_remote_config)

        return remotes

    def deleteRemote(self, name: str):
        """
        Removes a remote from the ssh configuration file

        :param name: The name of the remote to remove
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        if not os.path.exists(remotesFile):
            return

        with open(remotesFile, "r", encoding="utf-8") as f:
            remotesConfig: t.Dict[str, str] = json.load(f)

        # Remove the remote
        remotesConfig.pop(name)

        with open(remotesFile, "w", encoding="utf-8") as f:
            json.dump(remotesConfig, f)

    def connectRemote(self, name: str):
        """
        Connects to a remote machine

        :param name: The name of the remote to connect
        """

        # If its already connected to the same remote, do nothing
        if self.remote is not None and self.remote.name == name:
            return

        # Check if the remote exists
        if not self.remoteExists(name):
            raise Exception(f"The remote {name} does not exist")

        remotesConfig = self._remoteConfig()

        # Get the remote configuration (including local)
        selectedRemote = remotesConfig[name]
        # Init the Remote
        self.remote = RemotesAPI(selectedRemote)

        # Connect to the remote
        self.remote.connect()
        if not self.remote.isConnected:
            raise Exception("Could not connect to the remote")

    def _remoteConfig(self) -> t.Dict[str, t.Any]:
        """
        Returns the remote configuration read from the file, with passwords decrypted.
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        remotesConfig: t.Dict[str, t.Any] = {}
        if os.path.exists(remotesFile):
            with open(remotesFile, "r", encoding="utf-8") as f:
                remotesConfig = json.load(f)

        # Decrypt passwords transparently (plain-text legacy values pass through)
        for config in remotesConfig.values():
            if config.get("password"):
                config["password"] = self._crypto.decrypt(config["password"])

        return remotesConfig

    def remoteExists(self, remoteName: str) -> bool:
        """
        Returns whether a remote exists by the remote's name
        """

        return remoteName in self._remoteConfig().keys()

    def getRemoteAPI(self, remoteName: str) -> RemotesAPI:
        """
        Returns the connected instance of the remote
        """

        # Check if the remote exists
        if not self.remoteExists(remoteName):
            raise Exception(f"The remote {remoteName} does not exist")

        remotesConfig = self._remoteConfig()

        rapi = RemotesAPI(remotesConfig[remoteName])

        # Connect the remote
        rapi.connect()

        return rapi
