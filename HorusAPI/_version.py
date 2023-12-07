import subprocess


def get_git_version():
    # Get version from git tag or branch name
    try:
        version = subprocess.check_output(
            ["git", "describe", "--tags", "--abbrev=0"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        version = "0.0.1"

    # Check the branch name (whether it's a release or not)
    try:
        branch = subprocess.check_output(
            ["git", "symbolic-ref", "-q", "--short", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
        commit_hash = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
        branch = f"{branch}-{commit_hash}"
    except Exception:
        branch = "release"

    return branch, version


# Get version from git tag or branch name
branch, version = get_git_version()

version = f"{version}-{branch}"
