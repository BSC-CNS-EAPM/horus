"""
Server-mode file explorer for Flask
"""

# Standard imports
import os
import pathlib
import logging
import typing
import hashlib
import subprocess
from datetime import datetime

# Horus imports
if typing.TYPE_CHECKING:
    from Server.WebAppManager import HorusUser


class FileExplorerException(Exception):
    """
    Exceptions related to the FileExplorer class
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)

        logging.getLogger("Horus").error(message)


class PathIsNotDirectory(FileExplorerException):
    """
    Raised when _listDir() tries to read a non-directory path
    """

    def __init__(self, path: "pathlib.Path") -> None:

        message = f"Path {path} is not a directory."

        super().__init__(message)


class PathNotAccessible(FileExplorerException):
    """
    Raised when the provided path is not accesible, either by permissions or by being
    outside the highest boundary
    """

    def __init__(self, path: "pathlib.Path") -> None:

        message = f"Path '{path}' is not accessible."

        super().__init__(message)


class File:
    """
    Representation of a file or directory for the frontend Chonky interface
    """

    id: str
    """
    MD5 hash of the path
    """

    path: "pathlib.Path"
    """
    pathlib.Path to the file / directory
    """

    name: str
    """
    The name of the file (without extension)
    """

    ext: typing.Optional[str] = None
    """
    The extension of the file
    """

    isDir: bool = False
    """
    Whether the file is a directory or not
    """

    isHidden: bool = False
    """
    Whether the file is hidden or not
    """

    isSymlink: bool = False
    """
    Whether the file is a symlink or not
    """

    size: typing.Optional[float] = None
    """
    The size of the file, in bytes
    """

    modDate: typing.Optional[typing.Union[datetime, str]] = None
    """
    The modification date of the file
    """

    def __init__(
        self,
        path: typing.Union["pathlib.Path", str],
    ):
        if not isinstance(path, pathlib.Path):
            path = pathlib.Path(path)

        # Get the ID from hashing the path
        self.path = path
        self.id = self.getHashID(str(path))
        self.name = path.name
        self.ext = "".join(path.suffixes)
        self.isDir = path.is_dir()
        self.isHidden = path.name.startswith(".")
        self.isSymlink = path.is_symlink()
        self.modDate = datetime.fromtimestamp(path.lstat().st_mtime)

    def getSize(self) -> float:
        """
        Compute the size of the file
        """
        self.size = FileExplorer.computePathSize(str(self.path.absolute()))

        return self.size

    @classmethod
    def getHashID(cls, path: str):
        return hashlib.sha256(path.encode()).hexdigest()[:16]

    def toDict(self):
        fileDict = {
            "id": self.id,
            "path": str(self.path),
            "name": self.name if self.name != "" else str(self.path),
            "ext": self.ext,
            "isDir": self.isDir,
            "isHidden": self.isHidden,
            "isSymlink": self.isSymlink,
            "size": self.size,
            "modDate": str(self.modDate) if isinstance(self.modDate, datetime) else self.modDate,
        }
        return fileDict


class FileExplorer:
    """
    File explorer class. Manages paths, files, and folders.

    Provides Flask a JSON with the information about the files and folders in the given path.
    """

    def __init__(
        self,
        path: typing.Union["pathlib.Path", str, None],
    ) -> None:
        """
        :param currentPath: The current path to be shown in the directory.
        :param highestBoundary: The highest boundary to be shown in the directory. For WebApp mode, this
        should be the user's directory.
        :param highestBoundaryName: The name of the highest boundary. Defaults to the dirname of the highest boundary. In case
        of "/" defaults to "root"
        :param relativeTo: A path where all of the listed files will be relative to. This path must be inside the highestBoundary
        """

        if path is None:
            path = os.getcwd()

        self.path = pathlib.Path(path).resolve()

        # if not self.path.is_dir():
        #     raise PathIsNotDirectory(self.path)

        if not self.isAccesible:
            raise PathNotAccessible(self.path)

    def listDirectory(
        self,
        allowedExtensions: typing.Optional[typing.List[str]] = None,
        openFolder: bool = False,
    ) -> typing.List[File]:
        """
        Reads the given path and returns the contents as a list of files

        Raises
        ------
        PathIsNotDirectory if the provided path is not a directory
        """

        if not self.path.is_dir():
            raise PathIsNotDirectory(self.path)

        if allowedExtensions == ["*"]:
            allowedExtensions = None

        # Parse the allowed extensions to add a leading dot if they do not have it
        if allowedExtensions is not None:
            allowedExtensions = [
                f".{a}" if not a.startswith(".") else a for a in allowedExtensions
            ]

        dirList: typing.List[File] = []
        for file in self.path.iterdir():

            # Skip files that are not folders when setting "openFolder" to true
            if openFolder and not file.is_dir():
                continue

            # Skip files that are not part of the allowedExtensions
            if (
                allowedExtensions is not None
                and not "".join(file.suffixes) in allowedExtensions
                and not file.is_dir()
            ):
                continue

            # Initialize and append a file
            f = File(file)
            dirList.append(f)

        return dirList

    def folderChain(self) -> list[File]:
        """
        Returns the folder chain for the current path.
        """

        # Array where the chain will be stored
        chain: list[File] = []

        buildingChain = ""
        for c in self.path.absolute().parts:
            buildingChain = os.path.join(buildingChain, c)
            chain.append(File(pathlib.Path(buildingChain)))

        return chain

    def parseFiles(self, fileList: list[File]) -> list[dict]:
        """
        Parses the given list of files with their .toDict() method

        Returns
        -------
        A list of dictionaries for JSON encoded Files
        """

        return [f.toDict() for f in fileList]

    @property
    def isAccesible(self) -> bool:
        """
        Returns True if the current path is accessible, False otherwise.
        """

        # By default, files are accessible.
        # This is modified on the UserFileExplorer
        return True

    @classmethod
    def computePathSize(cls, path: str, units="mb") -> float:
        """
        Returns the size of a path in MB

        Parameters
        ----------
        :param: path -> Path to the directory to compute its size
        :param: units -> The units of the size (default MB) (b, kb, mb, gb)

        Returns
        -------
        :param: int -> The folder size in the specified units
        """
        # Get the size of the using the du command
        # By default, it will print in kilobytes, and we have to make the conversion

        unitsMap = {
            "b": 1 / 1024,
            "kb": 1,
            "mb": 1024,
            "gb": 1024 * 1024,
        }

        units = unitsMap[units]
        size = 0
        try:
            with subprocess.Popen(
                ["du", "-csk", path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
            ) as proc:
                try:
                    proc.wait(timeout=10)
                    if proc.stdout is not None:
                        size = float(proc.stdout.read().decode("utf-8").split("\t")[0])
                    else:
                        raise Exception("STDOUT from 'du' command is null")
                except subprocess.TimeoutExpired as te:
                    proc.kill()
                    raise Exception("'du' command timed out. Is the folder too big?") from te

        except Exception as e:
            logging.getLogger("Horus").error("Failed to compute the size of %s: %s", path, str(e))

        return size / units


class UserFileExplorer(FileExplorer):
    """
    Restricted file explorer to be used in WebApp mode
    """

    user: "HorusUser"
    """
    The HorusUser. This will give information about the available paths.
    """

    relativeTo: "pathlib.Path"
    """
    Convert all paths as relatives to this one
    """

    obfuscate: bool
    """
    Wether to parse the files or keep the full path

    This will make the property "relativeTo" unused
    """

    def __init__(
        self,
        path: typing.Union["pathlib.Path", str, None],
        user: "HorusUser",
        relativeTo: typing.Optional[str] = None,
        obfuscate: bool = True,
    ) -> None:
        """
        :param: user: HorusUser -> The user instance
        :param: relativeTo: Optional[str] -> Will convert all paths as relative to this path, defaults to User's flow dir
        :param: obfuscate: bool = True -> Will make use of the relativeTo parameter. If set to "False" full paths will be return on WebApp mode
        """

        self.user = user
        self.relativeTo = pathlib.Path(relativeTo) if relativeTo else self.userPathBoundary
        self.obfuscate = obfuscate

        # if not self.relativeTo.is_dir():
        #     raise PathIsNotDirectory(self.relativeTo)

        path = path if path else relativeTo if relativeTo else user.flowsDir
        path = pathlib.Path(path)

        # If the path is relative (does not start with "/")
        # then convert it to a real path within the flow user dir
        if not path.is_absolute():
            if self.relativeTo.name == path.name:
                path = self.userPathBoundary.joinpath(path)
            else:
                if not self.relativeTo.is_absolute():
                    # If the relative to is not absolute either, assume its
                    # a flow directory, and convert the path to aboslute
                    self.relativeTo = self.userPathBoundary.joinpath(self.relativeTo)

                # Generate the full absolute path
                path = self.relativeTo.joinpath(path)

        super().__init__(path)

    @property
    def userPathBoundary(self) -> "pathlib.Path":
        """
        Returns a Path instance of the user's flows dir
        """

        return pathlib.Path(self.user.flowsDir).resolve()

    @property
    def isAccesible(self) -> bool:
        """
        Returns True if the current path is accessible, False otherwise.
        """

        # In User, include a check to verify the path is within the user's directory
        if self.userPathBoundary != self.path and not self.userPathBoundary in self.path.parents:
            return False

        return super().isAccesible

    def folderChain(self) -> list[File]:
        """
        Returns the folder chain for the current path.
        """

        chain = super().folderChain()

        # Include the Flows directory on top of the chain
        # to allows the user to move between all of the directories
        container = File(self.userPathBoundary)
        chain.insert(0, container)

        return chain

    def parseFiles(self, fileList: list[File]) -> list[dict]:
        """
        Parses the given list of files with their .toDict() method

        Will parse relativeTo pathsfor Users

        Returns
        -------
        A list of dictionaries for JSON encoded Files
        """

        parsedFiles = []
        for f in fileList:
            if f.path == self.relativeTo:
                f.path = pathlib.Path("./")
            elif f.path == self.userPathBoundary:
                # The flow users directory is now 2 levels up
                # because the working directory of the flow was
                # changed to be a new generated folder
                # with the same name as the flow file
                f.path = pathlib.Path("../../")
            elif self.userPathBoundary in f.path.resolve().parents:
                if self.obfuscate:
                    f.path = self._getRelativePathOf(f.path)
            else:
                continue

            parsedFiles.append(f.toDict())

        return parsedFiles

    def _getAbsolutePathOf(self, path: "pathlib.Path"):
        """
        Converts any path to the relative one

        Returns
        -------
        :return: The relative path
        """

        return path.resolve()

    def _getRelativePathOf(self, path: "pathlib.Path"):
        """
        Converts any path to the relative one

        Returns
        -------
        :return: The relative path
        """

        return pathlib.Path(os.path.relpath(path, self.relativeTo))

    def getAbsolutePath(
        self,
    ) -> "pathlib.Path":
        """
        Converts a relative path from the
        webapp mode into the full path

        :param path: The relative path inside the user directory

        Returns
        -------
        :return: The absolute path
        """

        return self._getAbsolutePathOf(self.path)

    def getRelativePath(
        self,
    ) -> "pathlib.Path":
        """
        Converts the absolute path of the current folder to a relative path
        to the user's flow directory

        Returns
        -------
        The absolute path
        """

        return self._getRelativePathOf(self.path)
