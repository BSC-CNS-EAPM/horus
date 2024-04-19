import pytest
import os
import pathlib
import typing

from Server.WebAppManager import HorusUser
from Server.FileExplorer import (
    File,
    FileExplorer,
    UserFileExplorer,
)  # Import your File class from your module


@pytest.fixture
def example_file(tmp_path):
    # Create a temporary file for testing
    file_path = tmp_path / "example.txt"
    file_path.write_text("Example content")
    return File(file_path)


def test_init_file(example_file):
    assert example_file.path == example_file.path
    assert isinstance(example_file.id, str)
    assert isinstance(example_file.name, str)
    assert example_file.ext is not None
    assert example_file.isDir is False
    assert example_file.isHidden is False
    assert example_file.isSymlink is False
    assert example_file.modDate is not None
    assert example_file.size is None


def test_get_size(example_file):
    size = example_file.getSize()
    assert size is not None
    assert isinstance(size, float)


def test_to_dict(example_file):
    file_dict = example_file.toDict()
    assert isinstance(file_dict, dict)
    assert "id" in file_dict
    assert "path" in file_dict
    assert "name" in file_dict
    assert "ext" in file_dict
    assert "isDir" in file_dict
    assert "isHidden" in file_dict
    assert "isSymlink" in file_dict
    assert "size" in file_dict
    assert "modDate" in file_dict


@pytest.fixture
def example_file_explorer(tmp_path):
    # Create a temporary directory for testing
    dir_path = tmp_path / "example_dir"
    dir_path.mkdir()
    return FileExplorer(dir_path)


def test_init_file_explorer(tmp_path):
    explorer = FileExplorer(tmp_path)
    assert explorer.path == pathlib.Path(tmp_path).resolve()


def test_list_directory(tmp_path):
    explorer = FileExplorer(tmp_path)
    # Create a couple of files in the directory
    (tmp_path / "file1.txt").write_text("Content of file1")
    (tmp_path / "file2.txt").write_text("Content of file2")

    # List the directory
    files = explorer.listDirectory()
    assert len(files) == 2
    assert isinstance(files[0], File)


def test_folder_chain(tmp_path):
    explorer = FileExplorer(tmp_path)
    chain = explorer.folderChain()
    assert len(chain) == len(str(tmp_path).split(os.path.sep))


def test_parse_files(tmp_path):
    explorer = FileExplorer(tmp_path)
    # Create a couple of files in the directory
    (tmp_path / "file1.txt").write_text("Content of file1")
    (tmp_path / "file2.txt").write_text("Content of file2")

    # List the directory
    files = explorer.listDirectory()

    # Parse the files
    parsed_files = explorer.parseFiles(files)
    assert len(parsed_files) == 2
    assert isinstance(parsed_files[0], dict)


def test_compute_path_size(tmp_path):
    explorer = FileExplorer(tmp_path)
    # Create a couple of files in the directory
    (tmp_path / "file1.txt").write_text("Content of file1")
    (tmp_path / "file2.txt").write_text("Content of file2")

    # Compute the size
    size = explorer.computePathSize(tmp_path)
    assert size > 0


class MockHorusUser:
    def __init__(self, tmp_path) -> None:
        self.flowsDir = os.path.dirname(tmp_path)


@pytest.fixture
def example_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    return UserFileExplorer(tmp_path, user)  # type: ignore


def test_init_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    explorer = UserFileExplorer(tmp_path, user)  # type: ignore
    assert explorer.path == pathlib.Path(tmp_path).resolve()
    assert explorer.user == user
    assert str(explorer.relativeTo) == os.path.dirname(str(pathlib.Path(tmp_path).resolve()))


def test_list_directory_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    explorer = UserFileExplorer(tmp_path, user)  # type: ignore
    # Create a couple of files in the directory
    (tmp_path / "file1.txt").write_text("Content of file1")
    (tmp_path / "file2.txt").write_text("Content of file2")

    # List the directory
    files = explorer.listDirectory()
    assert len(files) == 2
    assert isinstance(files[0], File)


def test_folder_chain_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    explorer = UserFileExplorer(tmp_path, user)  # type: ignore
    chain = explorer.folderChain()
    assert len(chain) == len(str(tmp_path).split(os.path.sep)) + 1


def test_parse_files_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    explorer = UserFileExplorer(tmp_path, user)  # type: ignore
    # Create a couple of files in the directory
    (tmp_path / "file1.txt").write_text("Content of file1")
    (tmp_path / "file2.txt").write_text("Content of file2")

    # List the directory
    files = explorer.listDirectory()

    # Parse the files
    parsed_files = explorer.parseFiles(files)
    assert len(parsed_files) == 2
    assert isinstance(parsed_files[0], dict)


def test_get_absolute_path_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    explorer = UserFileExplorer(tmp_path, user)  # type: ignore
    abs_path = explorer.getAbsolutePath()
    assert abs_path == pathlib.Path(tmp_path).resolve()


def test_get_relative_path_user_explorer(tmp_path):
    user = MockHorusUser(tmp_path)
    explorer = UserFileExplorer(tmp_path, user)  # type: ignore
    rel_path = str(explorer.getRelativePath())
    assert rel_path == os.path.basename(str(tmp_path))
