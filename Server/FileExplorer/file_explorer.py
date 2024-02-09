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

    def __init__(self, currentPath: str = os.getcwd()) -> None:
        self.currentPath = currentPath

    @property
    def isAccesible(self) -> bool:
        """
        Returns True if the current path is accessible, False otherwise.
        """

        return os.path.exists(self.currentPath)

    def listDirectory(
        self,
        allowedExtensions: typing.Optional[typing.List[str]] = None,
        openFolder: bool = False,
    ):
        """
        Lists the directory in the current path.

        :param allowedExtensions: A list of allowed extensions.
        If None, all extensions are allowed.
        """

        if not self.isAccesible:
            logging.getLogger("Horus").error("Path %s is not accessible", self.currentPath)
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

        # Array where the chain will be stored
        chain = []

        # Set initially the current chain into the root
        currentChain = os.sep

        # Split the path into an array
        splittedPath = self.currentPath.split(os.sep)
        for folder, index in zip(splittedPath, range(len(splittedPath))):
            # The ID should be a hash of the folder
            id = hashlib.md5(folder.encode()).hexdigest()

            currentChain = os.path.join(currentChain, folder)
            chain.append(
                {
                    "id": id,
                    "name": "root" if index == 0 else folder,
                    "isDir": True,
                    "fullpath": currentChain,
                }
            )

        return chain
