import typing as t
import fabric
import os


class RemotesAPI:
    conn: fabric.Connection
    """
    The connection to the remote cluster.
    """

    host: str = None
    """
    The hostname of the remote cluster.
    """

    port: int = 22
    """
    The port to connect to the remote cluster on.
    """

    username: str = None
    """
    The username to connect to the remote cluster with.
    """

    password: str = None
    """
    The password to connect to the remote cluster with.
    """

    key: str = None
    """
    The key to connect to the remote cluster with.
    """

    proxyCommand: str = None
    """
    The proxy command to connect to the remote cluster with.
    """

    horusDir = "~/.horus/"
    """
    The path to the .horus folder on the remote.
    """

    isLocal = False
    """
    Whether the remote is local or not.
    """

    def __init__(self, selectedRemote: t.Dict[str, t.Any], local: bool = False):
        """
        Create a new ClusterAPI object.

        :param selectedRemote: The remote to connect to.
        """

        # Check if the remote is local
        if local:
            self.isLocal = True
            return

        # Set the remote details
        self.host = selectedRemote.get("host", None)
        self.port = selectedRemote.get("port", 22)
        self.username = selectedRemote.get("username", None)
        self.password = selectedRemote.get("password", None)
        self.key = selectedRemote.get("key", None)
        self.proxyCommand = selectedRemote.get("proxyCommand", None)

    def connect(self):
        """
        Connect to the remote.
        """

        if self.isLocal:
            self.horusDir = os.getcwd()
            return

        # Check if connection details are provided
        if self.host is None:
            raise Exception("No hostname provided.")
        if self.port is None:
            raise Exception("No port provided.")
        if self.username is None:
            raise Exception("No username provided.")
        if self.password is None and self.key is None:
            raise Exception("No password or key provided.")

        # Set kwargs for connection
        connect_kwargs = {}

        if self.password is not None:
            connect_kwargs["password"] = self.password

        if self.key is not None:
            connect_kwargs["key_filename"] = self.key

        # Connect
        if self.password is not None:
            self.conn = fabric.Connection(
                host=self.host,
                port=self.port,
                user=self.username,
                connect_kwargs={
                    **connect_kwargs,
                },
                gateway=self.proxyCommand or None,
            )
        else:
            raise Exception("No connection method provided.")

        # Set the path to the .horus folder on the remote
        self.horusDir = self.userHome + "/.horus/"

        # Create the .horus folder in the remote home directory
        self.conn.run(f"mkdir -p {self.horusDir}")

    @property
    def userHome(self):
        """
        Get the path to the remote home directory.

        :return: The path to the remote home directory.
        """
        return self.conn.run("echo $HOME").stdout.strip()

    def runScript(
        self, script: t.Optional[str] = None, scriptPath: t.Optional[str] = None
    ):
        """
        Run a slurm script on the cluster from a given script string or path.

        :param script: The slurm script to run as a string.
        :param scriptPath: The path to the slurm script to run.
        """
        if script is not None:
            # Run script from string
            pass
        elif scriptPath is not None:
            # Run script from file
            pass
        else:
            # No script provided
            raise Exception("No script provided.")

    def command(self, command: str):
        """
        Runs a command on the remote.

        :param command: The command to run.
        :return: The output of the command.
        """

        if self.isLocal:
            with os.popen(command) as stream:
                return stream.read()

        out = self.conn.run(command, hide=True)

        # If the command failed, raise an exception
        if out.failed:
            raise Exception(out.stderr.strip())

        # Return the stdout and stderr as a string
        return out.stdout.strip()

    def transferTo(self, source: str, destination: str):
        """
        Transfer a file from the local machine to the remote.

        :param source: The path to the file on the local machine.
        :param destination: The path to the file on the remote.
        """

        if destination is None or destination == "":
            destination = self.horusDir

        if self.isLocal:
            os.system(f"cp {source} {destination}")
            return

        self.conn.put(source, destination)

    def transferFrom(self, source: str, destination: str):
        """
        Transfer a file from the remote to the local machine.

        :param source: The path to the file on the remote.
        :param destination: The path to the file on the local machine.
        """

        if source is None or source == "":
            source = self.horusDir

        if destination is None or destination == "":
            destination = os.getcwd()

        if self.isLocal:
            os.system(f"cp {source} {destination}")
            return

        self.conn.get(source, destination)

    def disconnect(self):
        """
        Disconnect from the remote.
        """
        if not self.isLocal:
            self.conn.close()

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

        return self.conn.is_connected

    # Slurm management

    currentJobID = None
