import subprocess
import os


def get_git_version():

    # If the versions are set by GIT_TAG and GIT_BRANCH
    # in the environment, use those
    # This is useful for CI/CD pipelines in the GitHub Actions
    if "GIT_TAG" in os.environ:
        try:
            tag = os.environ["GIT_TAG"]
            _branch = os.environ["GIT_BRANCH"]
            commit = os.environ["GIT_COMMIT"]

            # If the branch is equal to the tag, it's a release
            if _branch == tag:
                _branch = "release"
            else:
                _branch = f"{_branch}-{commit}"

            return _branch, tag

        except Exception:
            pass

    # Get version from git tag or branch name
    try:
        _version = subprocess.check_output(
            ["git", "describe", "--tags", "--abbrev=0"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        _version = "0.0.1"

    # Check the branch name (whether it's a release or not)
    try:
        _branch = subprocess.check_output(
            ["git", "symbolic-ref", "-q", "--short", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
        _branch = f"{_branch}-{commit}"
    except Exception:
        _branch = "release"

    return _branch, _version


# Get version from git tag or branch name
branch, version = get_git_version()

version = f"{version}-{branch}"
