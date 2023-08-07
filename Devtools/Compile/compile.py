# manipulate get_config_vars:
# 1. step: wrap functionality and filter
from distutils.sysconfig import get_config_vars as default_get_config_vars

def remove_pthread(x):
    if type(x) is str:
        # x.replace(" -pthread ") would be probably enough...
        # but we want to make sure we make it right for every input
        if x=="-pthread":
            return ""
        if x.startswith("-pthread "):
            return remove_pthread(x[len("-pthread "):])
        if x.endswith(" -pthread"):
            return remove_pthread(x[:-len(" -pthread")])
        return x.replace(" -pthread ", " ")
    return x

def my_get_config_vars(*args):
  result = default_get_config_vars(*args)
  # sometimes result is a list and sometimes a dict:
  if type(result) is list:
     return [remove_pthread(x) for x in result]
  elif type(result) is dict:
     return {k : remove_pthread(x) for k,x in result.items()}
  else:
     raise Exception("cannot handle type"+type(result))

# 2.step: replace    
import distutils.sysconfig as dsc
dsc.get_config_vars = my_get_config_vars

from setuptools import setup
from distutils.extension import Extension
from Cython.Distutils import build_ext # type: ignore
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
    # Disable the -lpthread flag
    
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
