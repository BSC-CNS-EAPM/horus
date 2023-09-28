import setuptools
from distutils.extension import Extension
from Cython.Distutils import build_ext  # type: ignore

# Add to the path the HorusAPI package
import os
import sys

horusAPIPath = os.path.join(os.path.dirname(__file__), "..")
sys.path.append(horusAPIPath)

import HorusAPI

version = HorusAPI.__version__
# If long_version does not contain "release"
# use the branch name as the version (with commit hash)
if "release" not in version:
    real_version = version.split("-")[0]
    branch = "-".join(version.split("-")[1:])
    # Add the branch name to the version with .dev
    version = f"{real_version}.dev0+{branch}"
else:
    # Remove the "release" word from the version
    version = version.split("-")[0]

print("\n====================================")
print(f"Building HorusAPI version: {version}")
print("====================================\n")

ext_modules = [  # Compile the HorusAPI
    Extension("HorusAPI.plugins", ["src/plugins.py"]),
    Extension("HorusAPI.molstar", ["src/molstar.py"]),
    Extension("HorusAPI.utils", ["src/utils.py"]),
    Extension("HorusAPI.extensions", ["src/extensions.py"]),
    Extension(
        "HorusAPI.__init__",
        ["src/__init__.py"],
        include_package_data=True,  # type: ignore
    ),
]

package_data = {
    # Include the compiled .so files
    "HorusAPI": [
        "src/*.so",
    ],
}

# Copy the src/__init__.py file to a backup
os.system("cp src/__init__.py src/__init__.py.bak")

# Append temporarily inside the src/__init__.py file the version
with open("src/__init__.py", "a") as f:
    f.write(f'\n__version__ = "{version}"\n')


# Create the HorusAPI package
setuptools.setup(
    name="HorusAPI",
    version=version,
    author="Nostrum Biodiscovery",
    author_email="it@nostrumbiodiscovery.com",
    description=f"Horus API package for building plugins. Version: {version}",
    long_description="Horus API",
    long_description_content_type="text/markdown",
    cmdclass={"build_ext": build_ext},
    ext_modules=ext_modules,  # type: ignore
    classifiers=[
        "Programming Language :: Python",
        "Operating System :: OS Independent",
    ],
    # Python can be any
    python_requires=">=3.6",
    packages=setuptools.find_packages(where="src"),
    package_dir={"": "src"},
    package_data=package_data,
    include_package_data=True,
    zip_safe=False,
)

# Restore the src/__init__.py file
os.system("mv src/__init__.py.bak src/__init__.py")

# Because in the wheel the .pyi files are not included,
# but it is a zip file, we will include them manually
# inside the wheel

# Get the path of the wheel
wheelPath = os.listdir("dist")[0]

# Unzip the wheel
os.system(f"unzip dist/{wheelPath} -d dist/")

# Copy the .pyi files inside the wheel
os.system(f"cp -r src/*.pyi dist/HorusAPI/")

# Copy the py.typed file inside the wheel
os.system(f"cp py.typed dist/HorusAPI/")

# Remove the wheel
os.remove(f"dist/{wheelPath}")

# Zip the wheel again
os.system(f"cd dist/ && zip -r {wheelPath} *")
