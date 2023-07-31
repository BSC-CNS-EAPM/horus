from setuptools import setup
from distutils.extension import Extension
from Cython.Distutils import build_ext
import os

ext_modules = [
    Extension("App", ["App/app_delegate.py"]),
    Extension("App", ["App/__init__.py"]),
    Extension("Server.server", ["Server/server.py"]),
    Extension("Server.plugin_manager", ["Server/plugin_manager.py"]),
    Extension("Server.remotes_manager", ["Server/remotes_manager.py"]),
    Extension(
        "Server.__init__",
        ["Server/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
    Extension("HorusAPI.src.plugins", ["HorusAPI/src/plugins.py"]),
    Extension("HorusAPI.src.molstar", ["HorusAPI/src/molstar.py"]),
    Extension(
        "HorusAPI.__init__",
        ["HorusAPI/src/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
]

setup(
    name="Horus",
    cmdclass={"build_ext": build_ext},  # type: ignore
    ext_modules=ext_modules,  # type: ignore
    # Set the build dir to be build/cython
    script_args=["build_ext", "-b", "build/cython"],
)

# Remove the generated C files
for file in os.listdir("Server"):
    if file.endswith(".c"):
        os.remove(os.path.join("Server", file))

for file in os.listdir("App"):
    if file.endswith(".c"):
        os.remove(os.path.join("App", file))

for file in os.listdir("HorusAPI/src"):
    if file.endswith(".c"):
        os.remove(os.path.join("HorusAPI/src", file))
