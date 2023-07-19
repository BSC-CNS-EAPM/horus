import setuptools
import sys
import subprocess
import json

release = False


def get_git_version():
    # Get the latest git tag or branch name
    try:
        branch = (
            subprocess.check_output(
                ["git", "describe", "--tags", "--abbrev=0"], stderr=subprocess.DEVNULL
            )
            .decode()
            .strip()
        )
        print("Using latest git tag: ", branch)
        release = True
    except subprocess.CalledProcessError:
        branch = (
            subprocess.check_output(["git", "symbolic-ref", "-q", "--short", "HEAD"])
            .decode()
            .strip()
        )
        subroc = (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"])
            .decode()
            .strip()
        )
        branch = f"{branch}-{subroc}"
        print("Using latest git branch: ", branch)
        release = False
    return branch


# Get version from git tag or branch name
print("Using latest git tag or branch name")
branch = get_git_version()

# Get the version from package.json
with open("../package.json") as json_file:
    data = json.load(json_file)
    version = data.get("version", "")

long_version = f"{version}-{branch}"

if not release:
    version += f".dev0+{branch}"

print(f"Building version: {version}")

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
