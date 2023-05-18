from setuptools import setup
from distutils.extension import Extension
from Cython.Distutils import build_ext
import os

ext_modules = [
    Extension("App", ["App/app_delegate.py"]),
    Extension("App", ["App/__init__.py"]),
    Extension("Server.server", ["Server/server.py"]),
    Extension("Server.plugin_manager", ["Server/plugin_manager.py"]),
    Extension("Server.__init__", ["Server/__init__.py"], include_package_data=True),
    Extension("HorusAPI", ["HorusAPI/plugins.py"]),
    Extension("HorusAPI", ["HorusAPI/molstar.py"]),
    Extension("HorusAPI", ["HorusAPI/__init__.py"]),
]

setup(
    name="Horus",
    cmdclass={"build_ext": build_ext},
    ext_modules=ext_modules,
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

for file in os.listdir("HorusAPI"):
    if file.endswith(".c"):
        os.remove(os.path.join("HorusAPI", file))
