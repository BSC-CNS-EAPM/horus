from setuptools import setup
from distutils.extension import Extension
from Cython.Distutils import build_ext
import os

ext_modules = [
    Extension("App", ["App/app_delegate.py"]),
    Extension("App", ["App/__init__.py"]),
    Extension("Server", ["Server/server.py"]),
    Extension("Server", ["Server/__init__.py"]),
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
