# pylint: disable=invalid-name, unspecified-encoding
import subprocess
import pkgutil
import yaml
import json

# All the packages that do not come bundled with the app (i.e. are not used at runtime)
EXCLUDE_PACKAGES = [
    "pyinstaller",
    "dnspython",
    "cython",
    "pytest",
    "sphinx",
    "pydata_sphinx_theme",
    "sphinx_design",
    "nbsphinx",
    "sphinx_copybutton",
    "pylint",
    "black",
    "pyright",
    "zope",
    "locust",
    "twine",
]


def get_installed_packages():
    """Get a set of installed package names."""
    return {pkg.name for pkg in pkgutil.iter_modules()}


def get_python_licenses():
    """Extract runtime dependencies from environment.yml by filtering those actually imported."""

    yml_file = "Devtools/Environment/conda_horus.yaml"

    with open(yml_file, "r") as f:
        env_file = yaml.load(f, yaml.FullLoader)

    pip_deps = env_file["dependencies"][2]["pip"]
    pip_deps = [d.split("==")[0] for d in pip_deps]

    pip_deps = [d for d in pip_deps if d.lower() not in EXCLUDE_PACKAGES]

    # Run pip-licenses for the selected dependencies
    command = ["pip-licenses", "--format=json", "--with-license", "-p"]
    command += [pkg for pkg in pip_deps]

    result = subprocess.run(command, capture_output=True, text=True, check=True)

    return json.loads(result.stdout)


def get_npm_licenses():

    # Run npm-licenses for the selected dependencies
    command = ["npx", "license-checker-rseidelsohn", "--json", "--production", "--depth", "0"]
    result = subprocess.run(command, capture_output=True, text=True, check=True)

    npm_licenses = json.loads(result.stdout)

    # Pass the format so it is the same as the python ones
    npm_parsed = []
    for k, l in npm_licenses.items():

        print("k", k)
        split = k.split("@")
        name = split[0] if not k.startswith("@") else f"@{split[1]}"

        if not name:
            continue

        npm_parsed.append(
            {
                "Name": name,
                "License": l["licenses"],
                "LicenseText": (
                    open(l["licenseFile"]).read()
                    if l.get("licenseFile") and "LICENSE" in l.get("licenseFile")
                    else "No license text."
                ),
            }
        )

    return npm_parsed


def generate_license_file(licenses_data, output_file="LICENSES.md"):
    """Generate a LICENSES.txt file for runtime dependencies using pip-licenses."""

    # Read the Horus license file
    with open("LICENSE.md", "r") as hl:
        horus_lic = hl.read()

    with open(output_file, "w") as f:
        f.write("# LICENSES\n\n")

        # Insert at first the Horus license
        f.write(horus_lic)
        f.write("\n\n")

        # Place the python licenses
        for entry in licenses_data:
            f.write(f"## {entry['Name']} - {entry['License']}\n\n")
            f.write("```\n")  # Start code block for license text
            f.write(f"{entry['LicenseText']}\n")
            f.write("```\n\n")  # End code block

    print(f"Generated {output_file} with license information.")


if __name__ == "__main__":
    python_lic = get_python_licenses()
    npm_lic = get_npm_licenses()
    generate_license_file(python_lic + npm_lic)
