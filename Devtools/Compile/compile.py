# pylint: disable=invalid-name

from distutils.sysconfig import get_config_vars as default_get_config_vars
import distutils.sysconfig as dsc
from distutils.extension import Extension
from typing import cast
from setuptools import setup
from Cython.Distutils import build_ext  # type: ignore
import os
from pathlib import Path


# TODO: THIS CODE IS DUPLICATED IN HorusAPI/setup.py !!!
# manipulate get_config_vars:
# 1. step: wrap functionality and filter
def remove_pthread(x):
    """
    Remove the pthread command line argument
    """
    if isinstance(x, str):
        # x.replace(" -pthread ") would be probably enough...
        # but we want to make sure we make it right for every input
        if x == "-pthread":
            return ""
        if x.startswith("-pthread "):
            return remove_pthread(x[len("-pthread ") :])  # noqa: E203
        if x.endswith(" -pthread"):
            return remove_pthread(x[: -len(" -pthread")])
        return x.replace(" -pthread ", " ")
    return x


def my_get_config_vars(*args):
    """
    Correctly get the config variables that I provide
    """
    result = default_get_config_vars(*args)
    # sometimes result is a list and sometimes a dict:
    if isinstance(result, list):
        return [remove_pthread(x) for x in result]
    elif isinstance(result, dict):
        return {k: remove_pthread(x) for k, x in (cast(dict, result)).items()}
    else:
        raise Exception("cannot handle type" + str(type(result)))


# 2.step: replace
dsc.get_config_vars = my_get_config_vars

# Every module under App/ and Server/ gets cythonized. Globbed, not listed:
# a module missing here produces no .so, and since build.spec excludes these
# packages from PyInstaller, the frozen app crashes at import time.
ext_modules = [
    Extension(
        source.with_suffix("").as_posix().replace("/", "."),
        [source.as_posix()],
        include_package_data=True,  # type: ignore
    )
    for folder in ("App", "Server")
    for source in sorted(Path(folder).rglob("*.py"))
]

setup(
    name="Horus",
    cmdclass={"build_ext": build_ext},
    ext_modules=ext_modules,  # type: ignore
    # Set the build dir to be build/cython
    script_args=["build_ext", "-b", "build/cython"],
)

print("Deleting generated .c files")

# Remove the generated C files
for file in os.listdir("Server"):
    filePath = os.path.join("Server", file)
    if filePath.endswith(".c"):
        os.remove(filePath)
    # List other directories inside
    if os.path.isdir(filePath):
        for fileInside in os.listdir(filePath):
            filePathInside = os.path.join(filePath, fileInside)
            if filePathInside.endswith(".c"):
                os.remove(filePathInside)


for file in os.listdir("App"):
    if file.endswith(".c"):
        os.remove(os.path.join("App", file))

for file in os.listdir("HorusAPI/src"):
    if file.endswith(".c"):
        os.remove(os.path.join("HorusAPI/src", file))
