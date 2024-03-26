"""
Server-mode file explorer for Flask
"""

import os
import logging
import typing
import hashlib


class FileExplorer:
    """
    File explorer class. Manages paths, files, and folders.

    Provides Flask a JSON with the information about the files and folders in the given path.
    """

    def __init__(self, currentPath: str = os.getcwd(), highestBoundary: str = "/") -> None:
        """
        :param currentPath: The current path to be shown in the directory.
        :param highestBoundary: The highest boundary to be shown in the directory. For WebApp mode, this
        should be the user's directory.
        """
        self.currentPath = currentPath
        self.highestBoundary = highestBoundary

    @property
    def isAccesible(self) -> bool:
        """
        Returns True if the current path is accessible, False otherwise.
        """

        # If the path is outside the highest boundary, it is not accessible
        if self.highestBoundary != "/":
            if not self.currentPath.startswith(self.highestBoundary):
                logging.getLogger("Horus").error(
                    "Path %s is outside the highest boundary %s",
                    self.currentPath,
                    self.highestBoundary,
                )
                return False

        return os.path.exists(self.currentPath)

    def listDirectory(
        self,
        allowedExtensions: typing.Optional[typing.List[str]] = None,
        openFolder: bool = False,
        relative: bool = False,
    ):
        """
        Lists the directory in the current path.

        :param allowedExtensions: A list of allowed extensions.
        If None, all extensions are allowed.
        :param openFolder: If True, only folders will be listed.
        """

        if not self.isAccesible:
            raise Exception("Path is not accessible")

        # List the files in the current path
        files = []
        for file in os.listdir(self.currentPath):
            # Get the path of the file
            path = os.path.join(self.currentPath, file)

            # If we are on openFolder mode, check if the file is a folder
            if openFolder and not os.path.isdir(path):
                continue

            # Check if the file is selectable by its extension
            extension = file.split(".")
            if len(extension) > 1:
                extension = extension[-1]
            else:
                extension = None
            isDir = os.path.isdir(path)
            selectable = (
                False  # pylint: disable=simplifiable-if-expression
                if allowedExtensions is not None
                and extension not in allowedExtensions
                and not isDir
                else True
            )
            if not selectable:
                continue

            # Take into account the highest boundary
            if self.highestBoundary != "/":
                path = path.replace(self.highestBoundary, "")

            if relative and path.startswith("/"):
                # On webapp mode (where relative is True)
                # the path starts with /flow_folder/actualfile.txt
                # Therefore we need only the actualfie.txt part
                path = os.sep.join(path.split(os.sep)[1:])

            files.append(
                {
                    "id": file,
                    "name": file,
                    "isDir": isDir,
                    "fullpath": path,
                    "isHidden": file.startswith("."),  # Hidden files
                }
            )

        return files

    def folderChain(self):
        """
        Returns the folder chain for the current path.
        """

        if not self.isAccesible:
            raise Exception("Path is not accessible")

        # Array where the chain will be stored
        chain = []

        # Set initially the current chain to the highest boundary
        currentChain = self.highestBoundary

        # Get the current path
        currentPath = self.currentPath

        # Take into account the highest boundary
        if self.highestBoundary != "/":
            currentPath = currentPath.replace(self.highestBoundary, "")
            currentChain = "/"

        # Split the path into an array
        splittedPath = currentPath.split(os.sep)

        # Root name would be the last element of the highest boundary
        rootName = self.highestBoundary.split(os.sep)[-1]

        for folder, index in zip(splittedPath, range(len(splittedPath))):
            # The ID should be a hash of the folder
            id = hashlib.md5(folder.encode()).hexdigest()

            currentChain = os.path.join(currentChain, folder)
            chain.append(
                {
                    "id": id,
                    "name": rootName if index == 0 else folder,
                    "isDir": True,
                    "fullpath": currentChain,
                }
            )

        return chain
