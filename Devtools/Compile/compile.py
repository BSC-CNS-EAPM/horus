from distutils.sysconfig import get_config_vars as default_get_config_vars
import distutils.sysconfig as dsc
from setuptools import setup
from distutils.extension import Extension
from Cython.Distutils import build_ext  # type: ignore
import os


# manipulate get_config_vars:
# 1. step: wrap functionality and filter
def remove_pthread(x):
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
    result = default_get_config_vars(*args)
    # sometimes result is a list and sometimes a dict:
    if isinstance(result, list):
        return [remove_pthread(x) for x in result]
    elif isinstance(result, dict):
        return {k: remove_pthread(x) for k, x in result.items()}
    else:
        raise Exception("cannot handle type" + str(type(result)))


# 2.step: replace
dsc.get_config_vars = my_get_config_vars

ext_modules = [
    # Compile the AppDelegate
    Extension("App.app_delegate", ["App/app_delegate.py"]),
    Extension("App.__init__", ["App/__init__.py"], include_package_data=True),  # type: ignore
    # Compile the Server
    Extension("Server.server", ["Server/server.py"]),
    Extension(
        "Server.__init__",
        ["Server/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
    # Compile the server extension
    # Flow manager
    Extension("Server.FlowManager.flow_manager", ["Server/FlowManager/flow_manager.py"]),
    Extension(
        "Server.FlowManager.__init__",
        ["Server/FlowManager/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
    # Remotes manager
    Extension(
        "Server.RemotesManager.remotes_manager", ["Server/RemotesManager/remotes_manager.py"]
    ),
    Extension(
        "Server.RemotesManager.__init__",
        ["Server/RemotesManager/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
    # Settings manager
    Extension(
        "Server.SettingsManager.settings_manager", ["Server/SettingsManager/settings_manager.py"]
    ),
    Extension(
        "Server.SettingsManager.__init__",
        ["Server/SettingsManager/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
    # Plugin manager
    Extension("Server.PluginManager.plugin_manager", ["Server/PluginManager/plugin_manager.py"]),
    Extension(
        "Server.PluginManager.__init__",
        ["Server/PluginManager/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
    # Compile the HorusAPI
    Extension("HorusAPI.plugins", ["HorusAPI/src/plugins.py"]),
    Extension("HorusAPI.molstar", ["HorusAPI/src/molstar.py"]),
    Extension("HorusAPI.extensions", ["HorusAPI/src/extensions.py"]),
    Extension("HorusAPI.utils", ["HorusAPI/src/utils.py"]),
    Extension(
        "HorusAPI.__init__",
        ["HorusAPI/src/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
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
