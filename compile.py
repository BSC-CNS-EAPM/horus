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
    name="cython_example",
    cmdclass={"build_ext": build_ext},
    ext_modules=ext_modules,
    build_folder="build",
)

# Remove the generated C files
for file in os.listdir("Server"):
    if file.endswith(".c"):
        os.remove(os.path.join("Server", file))

for file in os.listdir("App"):
    if file.endswith(".c"):
        os.remove(os.path.join("App", file))
