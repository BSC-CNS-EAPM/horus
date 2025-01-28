"""
This module contains the RemotesAPI class, which is used to manage the
remote connections to the run Slurm blocks.
"""

# Standard library imports
import contextlib
import datetime
import json
import logging
import os
import secrets
import subprocess
import tarfile

# Types
import traceback
import typing as t

# async await
import asyncio

# Third party imports
import fabric

# Horus imports
from HorusAPI import ResetRemoteException, SlurmBlock

STDOUT_FILE = "StdOut"
STDERR_FILE = "StdErr"
SUBMISSION_FILE = "Command"


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

    loadProfile: bool = False
    """
    Whether to load the user profile when logging in ina remote shell.
    This can slow down command executions.
    """

    def __init__(
        self, selectedRemote: t.Optional[t.Dict[str, t.Any]] = None, local: bool = False
    ):
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

            # For local, set the workDir as the current directory
            self.workDir = os.getcwd()

            return

        # Set the remote details
        self.name = selectedRemote.get("name", "Unnamed Remote")
        self.host = selectedRemote.get("host", None)
        self.port = selectedRemote.get("port", 22)
        self.username = selectedRemote.get("username", None)
        self.password = selectedRemote.get("password", None)
        self.key = selectedRemote.get("keyPath", None)
        self.proxyCommand = selectedRemote.get("proxyCommand", None)
        self.remoteName = selectedRemote.get("name", "Unnamed Remote")
        self.workDir = selectedRemote.get("workDir", "~/.horus/")
        self.loadProfile = selectedRemote.get("loadProfile", False)

    def connect(self):
        """
        Connect to the remote.
        """

        # Check if connection details are provided
        if not self.isLocal:
            if self.host is None:
                raise Exception("No hostname provided.")
            if self.port is None:
                raise Exception("No port provided.")
            if self.username is None:
                raise Exception("No username provided.")
            if self.password is None and self.key is None:
                raise Exception("No password or key provided.")

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
                    logging.getLogger("Horus").critical(
                        "Could not connect to the remote %s: %s", self.host, str(exc)
                    )
                    raise Exception(
                        f"Could not connect to the remote {self.host}: {exc}"
                    ) from exc
            else:
                raise Exception("No connection method provided.")

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

    def command(
        self, command: str, timeout: t.Optional[int] = None, forceLocal: bool = False
    ) -> str:  # pylint: disable=method-hidden
        """
        Runs a command on the remote (or locally).

        :param command: The command to run.
        :param timeout: The timeout in seconds.
        :return: The output of the command.
        """

        if self.isLocal or forceLocal:
            # Run command locally
            logging.getLogger("Horus").info("Running command: '%s' on local machine,", command)
            try:
                process = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                )

                process.wait(timeout=timeout)

                out = process.stdout.read().decode("utf-8").strip() if process.stdout else ""

                logging.getLogger("Horus").debug("Local command output: %s", out)

                # If the command failed, raise an exception
                if process.returncode != 0:
                    raise Exception(out if out else f"Command '{command}' failed")

                # Return the stdout and stderr as a string
                return out

            except subprocess.TimeoutExpired as te:
                logging.getLogger("Horus").error("Command timed out: %s", command)
                raise Exception("Command timed out.") from te

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
                return self._oldCommand(command, timeout)

            if not self.conn.transport:
                raise Exception("Connection is not open.")

            # Get a new channel from the SSH connection
            channel = self.conn.transport.open_session()

            # Set timeout if specified
            if timeout is not None:
                channel.settimeout(timeout)

            # Construct command to source bashrc and execute the actual command
            bash_command = f'bash -l -c "source ~/.bashrc 2>/dev/null || source /etc/bash.bashrc 2>/dev/null; {command}"'

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

            if exit_status != 0:
                logging.getLogger("Horus").error(
                    "Command '%s' failed on remote %s with status %d: %s",
                    bash_command,
                    self.name,
                    exit_status,
                    stderr_str,
                )
                raise Exception(stderr_str)

            logging.getLogger("Horus").debug("Remote command output: %s", stdout_str)
            return stdout_str.decode("utf-8")

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

    def _oldCommand(self, command: str, timeout: t.Optional[int] = None):
        # Run command on remote
        # Hide is needed to avoid the output to be printed on the console
        # in_stream is needed to avoid fabric raising OSError (fabric
        # tries to acces sys.stdin which is not available because is mocked
        # with PrintCapturer)
        try:
            # Update the command with the timeout
            if timeout:
                command = "timeout {timeout} {command}".format(timeout=timeout, command=command)

            out = self.conn.run(command, hide=True, in_stream=False)

            # If the command failed, raise an exception
            if out.failed:
                raise Exception(out.stderr.strip())  # pylint: disable=broad-exception-raised

            out = str(out.stdout.strip())

            logging.getLogger("Horus").debug("Remote command output: %s", out)

            # Return the stdout and stderr as a string
            return out
        except Exception as exc:
            logging.getLogger("Horus").debug(
                "Error running command %s on remote %s: %s", command, self.name, str(exc)
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
            raise Exception(f"Error transferring data from {self.remoteName}: {exc}") from exc

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
            raise Exception(f"Error transferring data to {self.remoteName}: {exc}") from exc

    def transferTo(self, source: str, destination: str) -> str:
        """
        Transfer a file from the local machine to the remote.

        If the remote machine is the local one, no file will be moved nor transferred, and the
        source path will be returned.

        :param source: The path to the file on the local machine.
        :param destination: The path to the file on the remote.

        :return: The final path to the file/folder.
        """

        logging.getLogger("Horus").info("Transferring data from %s to %s", source, destination)

        if destination is None or destination == "":
            destination = self.workDir

        # If there are spaces in the path, cancel the transfer
        if " " in source:
            raise Exception(f"The source path cannot contain spaces: {source}")

        if " " in destination:
            raise Exception(f"The destination path cannot contain spaces: {destination}")

        # Create the destination container folder
        if os.path.isdir(source):
            containerFolder = destination
        else:
            containerFolder = os.path.dirname(destination)

        self.command(f"mkdir -p {containerFolder}")

        if self.isLocal:
            self.command(f"cp -r {source} {destination}")
            return os.path.join(destination, os.path.basename(source))

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
            raise Exception(f"The destination path cannot contain spaces: {destination}")

        if self.isLocal:
            if os.path.isdir(source):
                # Create the destination folder
                containerFolder = destination
            else:
                containerFolder = os.path.dirname(destination)

            self.command(f"mkdir -p {containerFolder}")

            self.command(f"cp -r {source} {destination}")
            return os.path.join(destination, os.path.basename(source))

        logging.getLogger("Horus").info("Transferring data from %s to %s", source, destination)

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

            logging.getLogger("Horus").info("Zipping remote folder %s into %s", source, zipPath)

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

            logging.getLogger("Horus").info("Removing the generated zip file %s", source)

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
            self.writeQueue({})

    def readQueue(self) -> t.Dict[str, t.List[t.Dict[str, t.Any]]]:
        """
        Read the queue storage.

        :return: The queue storage.
        """
        try:
            with open(self.queueStoragePath, "r", encoding="utf-8") as file:
                return json.load(file)
        except Exception as exc:  # pylint: disable=broad-exception-caught
            logging.getLogger("Horus").error(
                "Could not read queue storage: %s. Returning empty queue.", str(exc)
            )
            return {}

    async def saveJob(self, jobID: t.Union[str, list[str]], flowID: t.Optional[str] = None):
        """
        Stores a remote job in the queue storage.

        :param jobID: The ID of the job.
        :param remote: The remote the job is running on.
        :param flowPath: The path to the flow that produced the job.
        """

        # Read the queue
        queue = self.readQueue()

        flowID = flowID or self._flowSavedID
        if flowID is None:
            raise Exception(f"Cannot save jobID '{jobID}'. Flow ID not set.")

        # Create the entry for the flow in the queue storage if it does not exist
        if flowID not in queue:
            queue[flowID] = []

        if isinstance(jobID, str):
            jobID = [jobID]

        async def _process_job(j, flowID):
            exists = j in [sj["jobID"] for sj in queue[flowID]]
            if exists:
                return None

            stdout_task = self._getSlurmStd(STDOUT_FILE, j, flowID)
            stderr_task = self._getSlurmStd(STDERR_FILE, j, flowID)
            submission_task = self._getSlurmStd(SUBMISSION_FILE, j, flowID)
            stdout_result, stderr_result, submission_result = await asyncio.gather(stdout_task, stderr_task, submission_task)
            stdout_path = stdout_result[1]
            stderr_path = stderr_result[1]
            submission_path = submission_result[1]

            return {
                "remote": self.remoteName,  # The remote the job is running on
                "jobID": j,  # The ID of the job
                "status": "PENDING",
                # The status of the job (running, queued, failed, completed)
                "blockID": self._blockID,
                # The ID of the block the job is running on
                "blockPlacedID": self._blockPlacedID,
                "submitDate": datetime.datetime.now().timestamp(),
                STDOUT_FILE: stdout_path,
                STDERR_FILE: stderr_path,
                SUBMISSION_FILE: submission_path
            }

        # Process all jobs concurrently
        job_entries = await asyncio.gather(*[_process_job(j, flowID) for j in jobID])

        # Filter out None entries and append valid ones to queue
        for entry in job_entries:
            if entry is not None:
                queue[flowID].append(entry)

        # Save the queue storage
        self.writeQueue(queue)

    def submitJob(self, script: str, changeDir: bool = True) -> t.Union[str, list[str]]:
        """
        Submit a slurm job to the queue system of the cluster (SLURM)

        :param script: The path to the script to submit.
        :param: changeDir: automatically cd to the container folder of the script. \
        Disable this if using the cd context manager or for specific cases.

        :return: The job ID.
        """
        # Check if the script exists
        try:
            self.command(f"test -f {script}")
        except Exception as exc:
            raise Exception(f"Script {script} does not exist.") from exc

        command = f"sbatch {script}"

        # Get the directory of the script
        if changeDir:
            changeDirTo = os.path.dirname(script)
            if changeDirTo == "":
                changeDirTo = "."

            command = f"cd {changeDirTo} && {command}"

        # Submit the job and get the job ID
        try:
            out = self.command(command)
            jobID = out.split(" ")[-1].strip()
        except Exception as exc:
            logging.getLogger("Horus").error("Error submitting job: %s.", str(exc))
            raise Exception(f"Error submitting job. Could not get job ID: {exc}") from exc

        # Save the job as running into the active jobs file
        try:
            asyncio.run(self.saveJob(jobID))
        except Exception as exc:
            logging.getLogger("Horus").error(
                "Error saving job with ID %s: %s", jobID, traceback.format_exc()
            )
            raise Exception(f"Error saving job with ID {jobID} to the queue storage.") from exc

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
            raise ResetRemoteException("Remote block was resetted.")

        if self._flowSavedID is None:
            raise Exception("Flow ID not set.")

        if self._blockPlacedID is None:
            raise Exception("Block placedID not set.")

        # Run the async function and wait for it to complete
        status = asyncio.run(self.getRemoteBlockStatus(self._flowSavedID, self._blockPlacedID))

        # If the job is RUNNING or PENNDING, return False
        if status == "RUNNING" or status == "PENDING":
            return False

        return True

    async def _getJobsStatus(self, flowSavedID: str, blockPlacedID: int):
        # Get the status of the job
        queue = self.readQueue()

        jobs = queue.get(flowSavedID, None)

        if jobs is None or len(jobs) == 0:
            # The slurm block did not send any job to a slurm queue
            # returning COMPLETED will make the SlurmBlock to execute
            # its finalAction function.
            return "COMPLETED"

        statuses = {}
        async_tasks = []

        # First collect all jobs that need status checks
        jobs_to_check = []
        for job in jobs:
            jobID = None
            if job["blockPlacedID"] == blockPlacedID:
                jobID = job["jobID"]
            else:
                continue

            if jobID is None:
                statuses[jobID] = "COMPLETED"
                continue

            if job["status"] != "RUNNING" and job["status"] != "PENDING":
                statuses[jobID] = job["status"]
                continue

            jobs_to_check.append((jobID, job))

        # Create tasks for all jobs that need checking
        async_tasks = [self.getJobStatus(job[0]) for job in jobs_to_check]

        # Wait for all status checks to complete
        statuses_list = await asyncio.gather(*async_tasks)

        # Map results back to job IDs
        for (jobID, _), status in zip(jobs_to_check, statuses_list):
            statuses[jobID] = status

        for jid, status in statuses.items():
            # Update the queue storage
            await self.updateQueue(flowSavedID, jobID=jid, status=status)

        return [s for s in statuses.values()]

    async def getRemoteBlockStatus(self, flowSavedID: str, blockPlacedID: int) -> str:
        """
        Returns the status of a remote block (running, queued, failed, completed)

        :param flowSavedID: The ID of the flow.
        :param blockPlacedID: The placed ID of the block.
        """

        statuses = await self._getJobsStatus(flowSavedID, blockPlacedID)

        # If any of the jobs is out of memory, return OUT_OF_ME
        if any([s == "OUT_OF_ME" for s in statuses]):
            return "OUT_OF_ME"

        # If any of the jobs is failed, return FAILED
        if any([s == "FAILED" for s in statuses]):
            return "FAILED"

        # If any of the jobs is timeout, return TIMEOUT
        if any([s == "TIMEOUT" for s in statuses]):
            return "TIMEOUT"

        # If any of the jobs is cancelled, return CANCELLED
        if any([s == "CANCELLED" for s in statuses]):
            return "CANCELLED"

        # If any of the jobs is pending, return PENDING
        if any([s == "PENDING" for s in statuses]):
            return "PENDING"

        # If any of the jobs is running, return RUNNING
        if any([s == "RUNNING" for s in statuses]):
            return "RUNNING"

        # If all the jobs are completed, return COMPLETED
        if all([s == "COMPLETED" for s in statuses]):
            return "COMPLETED"

        return SlurmBlock.Status.UNKNOWN.value

    def getRemoteBlockTime(self, flowSavedID: str, blockPlacedID: int) -> float:
        """
        Returns the time a remote block has been running
        """

        queue = self.readQueue()

        jobs = queue.get(flowSavedID, None)

        if jobs is None:
            return 0

        time = 0
        for job in jobs:
            if job["blockPlacedID"] == blockPlacedID:
                # If any of the jobs does not have an end date, return 0
                if "endDate" not in job or job["endDate"] is None:
                    return 0

                if "submitDate" not in job or job["submitDate"] is None:
                    return 0

                # If the job has the "elapsed" key, use it
                if "elapsed" in job:
                    time += job["elapsed"]
                else:
                    # Add the time the job has been running
                    time += job["endDate"] - job["submitDate"]

        return time

    async def getRemoteBlockLogs(
        self, jobID: str, flowID: str
    ) -> tuple[t.Union[str, None], t.Union[str, None], t.Union[str, None], t.Union[str, None]]:
        """
        Retrieves from slurm the stdout, stderr and the detailed status
        """

        # Create all tasks
        stdoutTask = self._getSlurmStd(STDOUT_FILE, jobID, flowID)
        stderrTask = self._getSlurmStd(STDERR_FILE, jobID, flowID)
        submissionTask = self._getSlurmStd(SUBMISSION_FILE, jobID, flowID)
        statusTask = self._getDetailedStatus(jobID)

        # Wait for all tasks to complete concurrently
        stdoutResult, stderrResult, submission, detailedStatus = await asyncio.gather(
            stdoutTask, stderrTask, submissionTask, statusTask
        )

        # Unpack the stdout/stderr results (which return tuples)
        stdout, _ = stdoutResult
        stderr, _ = stderrResult
        submission, _ = submission

        return (stdout, stderr, submission, detailedStatus)

    async def _getArraySlurmJobs(self, jobID: str) -> list[str]:
        """
        Checks if a jobID is a slurm job array
        """

        # If the remote has sacct, use it
        try:
            # Get the job status
            jobList = self.command(f"sacct -j {jobID} -o 'JobID' --noheader -X")

        except Exception:  # pylint: disable=broad-exception-caught
            # If sacct is not available, use the squeue (less reliable)
            logging.getLogger("Horus").warning(
                "sacct is not available. Using squeue instead. "
                + "Please configure sacct in your remote for better performance."
            )

            jobList = self.command(f"squeue -j {jobID} -h -o '%i'")

        jobs = [j.strip() for j in jobList.splitlines() if "_[" not in j]
        jobs.insert(0, jobID)

        return jobs

    def _getSlurmStatus(self, jobID: str) -> str:
        """
        Get the status of a slurm job.

        :param jobID: The ID of the job.
        :return: The status of the job (running, queued, failed, completed)
        """

        # If the remote has sacct, use it
        try:
            # Get the job status
            status = self.command(f"sacct -j {jobID} -o 'State' --noheader -X")

        except Exception:  # pylint: disable=broad-exception-caught
            # If sacct is not available, use the squeue (less reliable)
            logging.getLogger("Horus").warning(
                "sacct is not available. Using squeue instead. "
                + "Please configure sacct in your remote for better performance."
            )

            status = self.command(f"squeue -j {jobID} -h -o '%T'")

            # When using squeue, if the job is not found, the output is empty
            # Set as "COMPLETED" if the output is empty
            if status == "":
                status = SlurmBlock.Status.COMPLETED.value

        # Active statuses that should be considered as running
        activeStatuses = [
            SlurmBlock.Status.RUNNING.value,
            SlurmBlock.Status.PENDING.value,
            SlurmBlock.Status.CANCELLING.value,
            SlurmBlock.Status.COMPLETING.value,
            SlurmBlock.Status.CONFIGURING.value,
            SlurmBlock.Status.SIGNALING.value,
            SlurmBlock.Status.RESIZING.value,
        ]

        if SlurmBlock.Status.OUT_OF_ME.value in status:
            status = SlurmBlock.Status.OUT_OF_ME.value
        elif SlurmBlock.Status.FAILED.value in status:
            status = SlurmBlock.Status.FAILED.value
            # self.command(f"scancel {jobID}")
        elif SlurmBlock.Status.TIMEOUT.value in status:
            status = SlurmBlock.Status.TIMEOUT.value
            # self.command(f"scancel {jobID}")
        elif SlurmBlock.Status.CANCELLED.value in status:
            status = SlurmBlock.Status.CANCELLED.value
            # self.command(f"scancel {jobID}")
        elif status == "" or SlurmBlock.Status.PENDING.value in status:
            status = SlurmBlock.Status.PENDING.value
        elif any(x in status for x in activeStatuses):
            status = SlurmBlock.Status.RUNNING.value
        elif SlurmBlock.Status.COMPLETED.value in status:
            status = SlurmBlock.Status.COMPLETED.value
        else:
            status = SlurmBlock.Status.UNKNOWN.value

        # Remove any + or - from the status
        status = status.replace("+", "").replace("-", "")

        return status

    async def _getSlurmStd(
        self, file: str, jobID: str, flowID: str
    ) -> tuple[str, t.Union[str, None]]:
        """
        Read Job's StdOut file
        """
        # Check if the path exists in the queue
        j = self.getJobFromQueue(jobID, flowID)

        stdPath = None
        if j is not None and file in j:
            stdPath = j[file]

        try:

            if stdPath is None:
                # Run blocking command in thread pool
                stdPath = self.command(f"scontrol show job {jobID} | grep {file}").split("=")[1]

                # Store the stdPath in the jobQueue
                self._updateStdPathForJob(stdPath, file, jobID, flowID)

            # Run blocking command in thread pool
            std = self.command(f"cat {stdPath}", timeout=15)
            if std.strip() == "":
                std = f"{file} is empty"
        except Exception as e:
            stdPath = None
            std = str(e)

        return std, stdPath

    async def _getDetailedStatus(self, jobID: str):
        try:
            detailedStatus = self.command(f"scontrol show jobid -dd {jobID}")
        except Exception:
            detailedStatus = None
        return detailedStatus

    async def getJobIDfromBlock(
        self, flowID: str, blockPlacedID: int
    ) -> t.Union[list[str], None]:
        """
        Returns the jobIDs that a block sent

        Parameters
        ----------
        flowID: str -> The flowID
        blockPlacedID: int -> The block placed ID

        Returns
        -------
        An array of JobIDs if the block sent any job, None otherwise
        """

        # Get the status of the job
        queue = self.readQueue()
        jobs = queue.get(flowID, None)

        if jobs is None:
            return None

        jobs = [j["jobID"] for j in jobs if j["blockPlacedID"] == blockPlacedID]

        # Re check if any slurm jobs from an array were executed
        async_tasks = []
        for j in jobs:
            # Skip array jobs
            if "_" in j:
                continue

            # Create task to get array jobs
            async_tasks.append(self._getArraySlurmJobs(j))

        # Run the async function and wait for it to complete
        array_results = await asyncio.gather(*async_tasks)

        # Process results
        for j, jArray in zip((j for j in jobs if "_" not in j), array_results):
            for jA in jArray:
                if jA not in jobs:
                    # Save the job if it does not exist in jobs
                    await self.saveJob(jA, flowID)

                    # Add the job to the current jobs array
                    jobs.append(jA)

        return jobs

    def getJobFromQueue(self, jobID: str, flowID: str) -> t.Union[dict, None]:
        """
        Return the information stored about the job in the queue
        """

        q = self.readQueue()
        jobs = q.get(flowID, None)

        if jobs is None:
            return None

        jobToFind = None
        for j in jobs:
            if j["jobID"] == jobID:
                jobToFind = j
                break

        return jobToFind

    def _updateStdPathForJob(self, path: str, type: str, jobID: str, flowID: str):
        """
        Will update the queue storage with the new stdPath
        """

        q = self.readQueue()

        jobs = q.get(flowID, None)

        if jobs is None:
            return

        modified = False
        for j in jobs:
            if j["jobID"] == jobID:
                j[type] = path
                modified = True
                break

        # Store the queue
        if modified:
            self.writeQueue(q)

    async def getJobStatus(self, jobID: str):
        """
        Get the status of a job.

        :param jobID: The ID of the job.
        :return: The status of the job (running, queued, failed, completed)
        """

        # Get the job status for slurm
        status = self._getSlurmStatus(jobID)

        return status

    async def updateQueue(
        self,
        savedFlowID: str,
        jobID: t.Optional[str] = None,
        status: t.Optional[str] = None,
    ) -> t.Dict[str, t.List[t.Dict[str, t.Any]]]:
        """
        Updates the queue storage with the current status of the jobs
        in the selected remote.
        """

        # Read the queue
        queue = self.readQueue()

        # Get the list of jobs for the flow
        jobs = queue.get(savedFlowID, [])

        for job, index in zip(jobs, range(len(jobs))):
            # If a jobID is provided, skip the other jobs
            if jobID is not None and job["jobID"] != jobID:
                continue

            # Job ID
            queueJobID = job.get("jobID", None)

            # If the job ID is not set, raise an exception
            if queueJobID is None:
                raise Exception("Corrupted queue storage: job ID not set.")

            remote = job.get("remote", None)

            # If the remote is not set, raise an exception
            if remote is None:
                raise Exception("Corrupted queue storage: remote not set.")

            # If the connected remote is not the same as
            # the remote the jobs are running on, raise an exception
            if remote != self.remoteName:
                logging.getLogger("Horus").warning(
                    "Remote mismatch. Did you change the remote connection?. \
                    Originally, the job was running on %s but you are \
                    currently connected to %s. This job will be \
                    removed from the queue storage.",
                    remote,
                    self.remoteName,
                )

                # Remove the job from the queue storage
                queue[savedFlowID].pop(index)

                continue

            # Update the job status only if its pending or running
            if "RUNNING" not in job["status"] and "PENDING" not in job["status"]:
                continue

            # Get the job status
            newStatus = await self.getJobStatus(queueJobID) if status is None else status
            # Update the job status
            job["status"] = newStatus

            # If the status is different from RUNNING/PENDING, store the end date
            if "RUNNING" not in newStatus and "PENDING" not in newStatus:
                job["endDate"] = datetime.datetime.now().timestamp()

                # Try to get the total time from the slurm job
                try:
                    elapsed = self.getJobTime(queueJobID)
                    job["elapsed"] = elapsed
                except Exception:
                    pass

            # Update the queue storage
            queue[savedFlowID][index] = job

        returnQueue = queue
        # If all the jobs on the queue are completed, remove the flow from the queue
        # if all([j["status"] == "COMPLETED" for j in queue[savedFlowID]]):
        #     queue.pop(savedFlowID)

        # Save the queue storage
        self.writeQueue(queue)

        # Return the queue storage
        return returnQueue

    def getJobTime(self, jobID: str):
        """
        Executes a command to get the total time of a job.
        """

        elapsed = self.command(f"sacct -j {jobID} -o 'Elapsed' --noheader -X")

        # Convert the elapsed time (hh:mm:ss) to seconds
        elapsed = elapsed.split(":")
        elapsed = int(elapsed[0]) * 3600 + int(elapsed[1]) * 60 + int(elapsed[2])

        return elapsed

    async def cancelJobs(self, flowID: str):
        """
        Cancels SLURM jobs for a flow.
        """
        # Get the queue
        queue = self.readQueue()

        # Get the jobs for the flow
        jobs = queue.get(flowID, [])

        jobsToCancel = []
        for job in jobs:
            # Get the job ID
            jobID = job.get("jobID", None)

            # Skip subjobs from arrays, killing the parent jobID already kills the children
            if "_" in jobID:
                continue

            # If the job ID is not set, raise an exception
            if jobID is None:
                raise Exception("Corrupted queue storage: Job ID not set.")

            # Cancel the job if its running or queued
            status = job.get("status", None)
            if status.lower() == "running" or status.lower() == "pending":
                jobsToCancel.append(jobID)

        if jobsToCancel:
            self.command(f"scancel {' '.join(jobsToCancel)}")
            # Update the queue for each cancelled job
            for jid in jobsToCancel:
                try:
                    await self.updateQueue(flowID, jid)
                except Exception as e:
                    logging.getLogger("Horus").error(
                        "Error updating queue after cancelling jobs: %s", str(e)
                    )

    def writeQueue(self, queue: t.Dict[str, t.List[t.Dict[str, t.Any]]]):
        """
        Write the queue storage.

        :param queue: The queue storage.
        """

        with open(self.queueStoragePath, "w", encoding="utf-8") as file:
            json.dump(queue, file, indent=4)

    def deleteJobsForBlock(self, flowID: str, blockPlacedID: int):
        """
        Delete jobs for a block.

        :param blockID: The ID of the block.
        """

        # Read the queue
        queue = self.readQueue()

        # Delete the jobs from the queue storage
        try:
            q = queue[flowID]

            newQ = []
            for job in q:
                if job["blockPlacedID"] != blockPlacedID:
                    newQ.append(job)

            # Update the flow queue
            queue[flowID] = newQ

            # Save the queue storage
            self.writeQueue(queue)
        except KeyError:
            pass

    def deleteFlowFromQueue(self, flowID: str):
        """
        Delete a flow from the queue storage.

        :param flowID: The ID of the flow.
        """

        # Read the queue
        queue = self.readQueue()

        # Delete the flow from the queue storage
        try:
            queue.pop(flowID)
        except KeyError:
            pass

        # Save the queue storage
        self.writeQueue(queue)


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

        if newConfig.get("keyPath") is not None and newConfig.get("password") is not None:
            raise Exception(
                "While configuring a remote either the keys or the password is required, not both."
            )

        newKeyPath = newConfig.get("keyPath", None)
        if newKeyPath is not None:
            if isinstance(newKeyPath, list):
                newKeyPath = newKeyPath[0]
                newConfig["keyPath"] = newKeyPath

            if not os.path.exists(newKeyPath):
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

    def listRemotes(self, includeLocal: bool = False) -> list[dict[str, t.Any]]:
        """
        Loads the ssh configuration file and returns the list of remotes
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        if not os.path.exists(remotesFile):
            remotesConfig = {}
        else:
            with open(remotesFile, "r", encoding="utf-8") as file:
                remotesConfig: t.Dict[str, str] = json.load(file)

        # Convert the remotes configuration to a list
        remotes = []
        for name, config in remotesConfig.items():  # pylint: disable=unused-variable
            remotes.append(config)

        # Add the local machine
        if includeLocal:
            remotes.append({"name": "Local"})

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

    def _remoteConfig(self) -> t.Dict[str, t.Any]:
        """
        Returns the remote configuration read from the file
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        remotesConfig: t.Dict[str, t.Any] = {}
        if os.path.exists(remotesFile):
            with open(remotesFile, "r", encoding="utf-8") as f:
                remotesConfig = json.load(f)

        return remotesConfig

    def remoteExists(self, remoteName: str) -> bool:
        """
        Returns whether a remote exists by the remote's name
        """

        if remoteName.lower() != "local":
            return remoteName in self._remoteConfig().keys()

        return True
