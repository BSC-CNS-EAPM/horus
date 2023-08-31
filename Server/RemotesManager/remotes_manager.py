"""
This module contains the RemotesAPI class, which is used to manage the
remote connections to the run Slurm blocks.
"""

import typing as t
import os
import subprocess
import json
import secrets
import fabric


class RemotesAPI:
    """
    This class manages the connnections to the remote clusters.
    - Send/Receive files
    - Submit jobs
    - Get job status
    - Get queue status
    - Perform commands...
    """

    conn: fabric.Connection
    """
    The connection to the remote cluster.
    """

    host: t.Optional[str] = None
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

    name: str = "Unnamed Remote"
    """
    The selected remote name.
    """

    def __init__(self, selectedRemote: t.Optional[t.Dict[str, t.Any]], local: bool = False):
        """
        Create a new ClusterAPI object.

        :param selectedRemote: The remote to connect to.
        """

        # Create the queue storage
        self._createQueueStorage()

        # Check if the remote is local
        if local or selectedRemote is None:
            self.isLocal = True
            self.name = "Local"
            self.remoteName = "Local"
            return

        # Set the remote details
        self.name = selectedRemote.get("name", "Unnamed Remote")
        self.host = selectedRemote.get("host", None)
        self.port = selectedRemote.get("port", 22)
        self.username = selectedRemote.get("username", None)
        self.password = selectedRemote.get("password", None)
        self.key = selectedRemote.get("key", None)
        self.proxyCommand = selectedRemote.get("proxyCommand", None)
        self.remoteName = selectedRemote.get("name", "Unnamed Remote")
        self.workDir = selectedRemote.get("workDir", "~/.horus/")

    def connect(self):
        """
        Connect to the remote.
        """

        # Check if connection details are provided
        if not self.isLocal:
            if self.host is None:
                raise Exception("No hostname provided.")  # pylint: disable=broad-exception-raised
            if self.port is None:
                raise Exception("No port provided.")  # pylint: disable=broad-exception-raised
            if self.username is None:
                raise Exception("No username provided.")  # pylint: disable=broad-exception-raised
            if self.password is None and self.key is None:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "No password or key provided."
                )

            # Set kwargs for connection
            connect_kwargs = {}  # pylint: disable=invalid-name

            if self.password is not None:
                connect_kwargs["password"] = self.password

            if self.key is not None:
                connect_kwargs["key_filename"] = self.key

            # Connect
            if self.password is not None:
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
                    raise Exception(  # pylint: disable=broad-exception-raised
                        f"Error connecting to {self.remoteName}: {exc}"
                    ) from exc

            else:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "No connection method provided."
                )

        if "~" in self.workDir:
            # Replace the ~ with the user home directory for compatibility
            # with the fabric library
            self.workDir = self.workDir.replace("~", self.userHome)

        # Create the .horus folder in the remote home directory
        self.command(f"mkdir -p {self.workDir}")

    @property
    def userHome(self):
        """
        Get the path to the remote home directory.

        :return: The path to the remote home directory.
        """
        return self.command("echo $HOME")

    def command(self, command: str):
        """
        Runs a command on the remote (or locally).

        :param command: The command to run.
        :return: The output of the command.
        """

        if self.isLocal:
            # Run command locally
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            process.wait()

            # If the command failed, raise an exception
            if process.returncode != 0:
                if process.stderr is not None:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        process.stderr.read().decode("utf-8").strip()
                    )
                else:
                    raise Exception("Command failed.")  # pylint: disable=broad-exception-raised

            # Return the stdout and stderr as a string
            if process.stdout is not None:
                return process.stdout.read().decode("utf-8").strip()
            else:
                return f"Command {command} executed successfully."

        out = self.conn.run(command, hide=True)

        # If the command failed, raise an exception
        if out.failed:
            raise Exception(out.stderr.strip())  # pylint: disable=broad-exception-raised

        # Return the stdout and stderr as a string
        return out.stdout.strip()

    def transferTo(self, source: str, destination: str):
        """
        Transfer a file from the local machine to the remote.

        :param source: The path to the file on the local machine.
        :param destination: The path to the file on the remote.
        """

        if destination is None or destination == "":
            destination = self.workDir

        if self.isLocal:
            os.system(f"cp -r {source} {destination}")
            return

        # Check if the source is a folder
        if os.path.isdir(source):
            # Change dir to the containing folder
            prevDir = os.getcwd()
            os.chdir(os.path.dirname(source))

            # Then zip the folder
            folderName = os.path.basename(source)
            sourceZip = os.path.join(source, "*")

            os.system(f"tar -czvf {folderName}.tar.gz {sourceZip}")
            source = os.path.join(os.getcwd(), f"{folderName}.tar.gz")

            # Change dir back
            os.chdir(prevDir)

            self.conn.put(source, destination)

            # Remove the zip file
            os.remove(source)

            prevRemoteDir = self.command("pwd")

            # Unzip the remote file
            self.command(f"cd {destination} && tar -xzvf {folderName}.tar.gz")

            # Remove the zip file
            self.command(f"cd {destination} && rm {folderName}.tar.gz")

            # Change dir back
            self.command(f"cd {prevRemoteDir}")

            return

        self.conn.put(source, destination)

    def transferFrom(self, source: str, destination: str):
        """
        Transfer a file from the remote to the local machine.

        :param source: The path to the file on the remote.
        :param destination: The path to the file on the local machine.
        """

        if source is None or source == "":
            source = self.workDir

        if destination is None or destination == "":
            destination = os.getcwd()

        if self.isLocal:
            os.system(f"cp -r {source} {destination}")
            return

        print(f"Transferring data from {source} to {destination}...")

        # Check if the source is a folder
        try:
            self.command(f"test -d {source}")

            print("Source is a folder.")

            # Then zip the folder
            folderName = os.path.basename(source)
            sourceZip = os.path.join(folderName, "*")

            unique_id = secrets.token_hex(6)  # pylint: disable=invalid-name
            zipPath = f"{folderName}-{unique_id}.tar.gz"
            container = os.path.dirname(source)

            print(f"Zipping remote folder into {zipPath}")

            self.command(f"cd {container} && tar -czvf {zipPath} {sourceZip}")

            source = os.path.join(container, zipPath)

            print("Transferring...")

            container_local = os.path.dirname(destination)  # pylint: disable=invalid-name
            destination = os.path.join(container_local, zipPath)

            print(f"Getting {source} to {destination}")

            self.conn.get(source, destination)

            # Remove the zip file

            print("Removing the generated zip file...")
            self.command(f"rm {source}")

            prevLocalDir = os.getcwd()

            print("Unzipping local file...")

            # Unzip the local file
            os.system(f"cd {container_local} && tar -xzvf {zipPath}")

            # Remove the zip file
            os.system(f"cd {container_local} && rm {zipPath}")

            # Change local dir back
            os.system(f"cd {prevLocalDir}")

            print("Done.")

            return
        except Exception:  # pylint: disable=broad-exception-caught
            pass

        self.conn.get(source, destination)

    def disconnect(self):
        """
        Disconnect from the remote.
        """
        try:
            if not self.isLocal and self.conn.is_connected:
                self.conn.close()
        except Exception as exc:  # pylint: disable=broad-exception-caught
            print(f"Could not disconnect remote {self.name}. {exc}")

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
            print(f"Could not check if remote {self.name} is connected. {exc}")
            return False

    # Slurm management
    _flowSavedID: t.Optional[str] = None
    """
    The path to the running flow.
    """

    _blockPlacedID: t.Optional[int] = None
    "The placed ID of the block the job is running on."

    _blockID: t.Optional[str] = None
    """
    The ID of the block the job is running on.
    """

    _resetRemoteBlock: bool = False
    """
    Whether the remote block needs to be resetted.
    """

    @property
    def queueStoragePath(self):
        """
        Get the path to the queue folder where the running/run jobs are stored

        :return: The path to the queue folder.
        """

        from App import AppDelegate  # pylint: disable=import-outside-toplevel

        return os.path.join(AppDelegate().appSupportDir, "queue.json")

    def _createQueueStorage(self):
        """
        Create the queue storage if it does not exist.
        """
        if not os.path.exists(self.queueStoragePath):
            with open(self.queueStoragePath, "w", encoding="utf-8") as file:
                file.write("{}")

    def readQueue(self) -> t.Dict[str, t.List[t.Dict[str, t.Any]]]:
        """
        Read the queue storage.

        :return: The queue storage.
        """
        with open(self.queueStoragePath, "r", encoding="utf-8") as file:
            return json.load(file)

    def saveJob(self, jobID: int):
        """
        Stores a remote job in the queue storage.

        :param jobID: The ID of the job.
        :param remote: The remote the job is running on.
        :param flowPath: The path to the flow that produced the job.
        """

        # Read the queue
        queue = self.readQueue()

        if self._flowSavedID is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Cannot save jobID '{jobID}'. Flow ID not set."
            )

        # Create the entry for the flow in the queue storage if it does not exist
        if self._flowSavedID not in queue:
            queue[self._flowSavedID] = []

        # Update the list of jobs for the flow
        queue[self._flowSavedID].append(
            {
                "remote": self.remoteName,  # The remote the job is running on
                "jobID": jobID,  # The ID of the job
                "status": "RUNNING",
                # The status of the job (running, queued, failed, completed)
                "blockID": self._blockID,
                # The ID of the block the job is running on
                "blockPlacedID": self._blockPlacedID,
            }
        )

        # Save the queue storage
        with open(self.queueStoragePath, "w", encoding="utf-8") as file:
            json.dump(queue, file)

    def submitJob(self, script: str) -> int:
        # Function exposed to HorusAPI
        """
        Submit a slurm job to the queue system of the cluster (SLURM)

        :param script: The path to the script to submit.
        :return: The job ID.
        """

        # Check if the script exists
        try:
            self.command(f"test -f {script}")
        except Exception as exc:
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Script {script} does not exist."
            ) from exc

        changeDirTo = os.path.dirname(script)

        out = self.command(f"cd {changeDirTo} && sbatch {script}")

        # Get the job ID
        try:
            jobID = int(out.split(" ")[-1].strip())
        except Exception as exc:
            raise Exception(  # pylint: disable=broad-exception-raised
                "Error submitting job. Could not get job ID."
            ) from exc

        # Save the job as running into the active jobs file
        self.saveJob(jobID)

        return jobID

    def didRemoteBlockFinish(self) -> bool:
        """
        Check if the remote block finished running.

        For this function to work, the following variables must be set:
        - self._flowSavedID
        - self._blockID

        This is meant to be run in the __call__ method of the RemoteBlock class in the
        HorusAPI module.
        """

        if self._resetRemoteBlock:
            raise Exception(  # pylint: disable=broad-exception-raised
                "Remote block was resetted."
            )

        if self._flowSavedID is None:
            raise Exception("Flow ID not set.")  # pylint: disable=broad-exception-raised

        if self._blockPlacedID is None:
            raise Exception("Block placedID not set.")  # pylint: disable=broad-exception-raised

        status = self.getRemoteBlockStatus(self._flowSavedID, self._blockPlacedID)

        # If the job is completed, return True
        # Otherwise, return False
        return status == "COMPLETED"

    def getRemoteBlockStatus(self, flowSavedID: str, blockPlacedID: int) -> str:
        """
        Returns the status of a remote block (running, queued, failed, completed)

        :param flowSavedID: The ID of the flow.
        :param blockPlacedID: The placed ID of the block.
        """

        # Get the status of the job
        queue = self.readQueue()

        jobs = queue.get(flowSavedID, None)

        if jobs is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "Corrupted queue storage: flow not found."
            )

        # Get the jobID
        jobID = None

        # Reverse the jobs. This is done because the remote
        # block can be 'resetted' and the jobID can change,
        # even though the blockID/placedID will remain the same.
        # Therefore, we get the last job with the same blockID/placedID
        reversedJobs = list(reversed(jobs))
        for j in reversedJobs:
            if j["blockPlacedID"] == blockPlacedID:
                jobID = j["jobID"]
                break

        if jobID is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "Corrupted queue storage: block not found."
            )

        return self.getJobStatus(jobID)

    def getJobStatus(self, jobID: int) -> str:
        """
        Get the status of a job.

        :param jobID: The ID of the job.
        :return: The status of the job (running, queued, failed, completed)
        """

        # Get the job status
        return self.command(f"sacct -j {jobID} -o 'State' --noheader -X")

    def updateQueue(self, savedFlowID: str) -> t.Dict[str, t.List[t.Dict[str, t.Any]]]:
        """
        Updates the queue storage with the current status of the jobs
        in the selected remote.
        """

        # Read the queue
        queue = self.readQueue()

        # Get the list of jobs for the flow
        jobs = queue.get(savedFlowID, [])

        remote = jobs[0].get("remote", None)

        # If the remote is not set, raise an exception
        if remote is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "Corrupted queue storage: remote not set."
            )

        # If the connected remote is not the same as
        # the remote the jobs are running on, raise an exception
        if remote != self.remoteName:
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Remote mismatch. Did you change the remote connection?. \
                Originally, the job was running on {remote} but you are \
                currently connected to {self.remoteName}"
            )

        # Loop through the jobs
        for job, index in zip(jobs, range(len(jobs))):
            # Job ID
            jobID = job.get("jobID", None)

            # If the job ID is not set, raise an exception
            if jobID is None:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Corrupted queue storage: job ID not set."
                )

            # Get the job status
            status = self.getJobStatus(jobID)

            # Update the job status
            job["status"] = status

            # Update the queue storage
            queue[savedFlowID][index] = job

        # Save the queue storage
        with open(self.queueStoragePath, "w", encoding="utf-8") as file:
            json.dump(queue, file)

        # Return the queue storage
        return queue


class RemotesManager:
    """
    Manages the connection to the remote clusters.
    """

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

    def configureRemote(self, newConfig: t.Dict[str, t.Any]):
        """
        Configures the SSH connection for HPC clusters

        param newConfig: An object containing the ssh configuration
        {
            name: str,
            username: str,
            host: str,
            port: int,
            keys: str,
            proxyCommand: str,
            workDir: str
        }
        """

        # Check that the config is valid
        if newConfig.get("name") is None:
            raise Exception("The name of the remote is required")

        if newConfig.get("username") is None:
            raise Exception("The user of the remote is required")

        if newConfig.get("host") is None:
            raise Exception("The host of the remote is required")

        if newConfig.get("port") is None:
            raise Exception("The port of the remote is required")

        if newConfig.get("keys") is None and newConfig.get("password") is None:
            raise Exception("Either the keys or the password of the remote is required")

        if newConfig.get("keys") is not None and newConfig.get("password") is not None:
            raise Exception("Either the keys or the password of the remote is required")

        if newConfig.get("keys") is not None and not os.path.exists(newConfig["keys"]):
            raise Exception("The keys file does not exist")

        if newConfig["name"].lower() == "local":
            # The local remote does not need to be configured
            raise Exception("The local machine does not need to be configured")

        remotesPath = os.path.join(self.appSupportDir, "remotes.json")

        if os.path.exists(remotesPath):
            # Load and update the existing ssh configuration
            with open(remotesPath, "r", encoding="utf-8") as file:
                remotesConfig: t.Dict[str, t.Any] = json.load(file)

            # Check if the remote already exists
            if newConfig["name"] in remotesConfig.keys():
                # Update the remote
                remotesConfig[newConfig["name"]] = newConfig
            else:
                # Create a new remote
                remotesConfig.update({newConfig["name"]: newConfig})

        else:
            # Create a new ssh configuration
            remotesConfig = {newConfig["name"]: newConfig}

        with open(remotesPath, "w", encoding="utf-8") as file:
            json.dump(remotesConfig, file)

    def listRemotes(self):
        """
        Loads the ssh configuration file and returns the list of remotes
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        if not os.path.exists(remotesFile):
            return []

        with open(remotesFile, "r", encoding="utf-8") as file:
            remotesConfig: t.Dict[str, str] = json.load(file)

        # Convert the remotes configuration to a list
        remotes = []
        for name, config in remotesConfig.items():  # pylint: disable=unused-variable
            remotes.append(config)

        return remotes

    def deleteRemote(self, name: str):
        """
        Removes a remote from the ssh configuration file

        :param name: The name of the remote to remove
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        if not os.path.exists(remotesFile):
            return

        with open(remotesFile, "r") as f:
            remotesConfig: t.Dict[str, str] = json.load(f)

        # Remove the remote
        remotesConfig.pop(name)

        with open(remotesFile, "w") as f:
            json.dump(remotesConfig, f)

    def connectRemote(self, name: str):
        """
        Connects to a remote machine

        :param name: The name of the remote to connect
        """

        # If its already connected to the same remote, do nothing
        if self.remote is not None and self.remote.name == name:
            return

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        remotesConfig: t.Dict[str, t.Any] = {}
        if os.path.exists(remotesFile):
            with open(remotesFile, "r") as f:
                remotesConfig = json.load(f)

        # Check if the remote exists
        if name not in remotesConfig.keys() and name.lower() != "local":
            raise Exception(f"The remote {name} does not exist")

        if name.lower() == "local":
            self.remote = RemotesAPI(None, local=True)
        else:
            # Get the remote configuration if its not the local machine
            selectedRemote = remotesConfig[name]

            # Init the Remote
            self.remote = RemotesAPI(selectedRemote)

            # Connect to the remote
            self.remote.connect()

        if not self.remote.isConnected:
            raise Exception("Could not connect to the remote")
