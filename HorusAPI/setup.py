import setuptools

# Add to the path the HorusAPI package
import os
import sys

horusAPIPath = os.path.join(os.path.dirname(__file__), "..")
sys.path.append(horusAPIPath)

import HorusAPI

version = HorusAPI.__version__
long_version = HorusAPI._version.long_version

# If long_version does not contain "release"
# use the branch name as the version (with commit hash)
if "release" not in long_version:
    branch = long_version.split("-")[1:]
    branch = "-".join(branch)
    # Add the branch name to the version with .dev
    version += f".dev0+{branch}"

print(f"Building version: {long_version}")

# Create the HorusAPI package
setuptools.setup(
    name="HorusAPI",
    version=version,
    author="Nostrum Biodiscovery",
    author_email="it@nostrumbiodiscovery.com",
    description=f"Horus API {long_version}",
    long_description="Horus API",
    long_description_content_type="text/markdown",
    classifiers=[
        "Programming Language :: Python :: 3.9",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.9",
    package_dir={"": "src"},
    packages=setuptools.find_packages(where="src"),
)
