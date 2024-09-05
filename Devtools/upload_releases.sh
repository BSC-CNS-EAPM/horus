
#!/bin/bash

# This script is made for uploading the macOS
# releases to GitLab. Linux releases are
# automatically uploaded during the CI pipeline.
# In order to use this script, you need to set
# the GITLAB_TOKEN environment variable.

version=$(git describe --tags --abbrev=0)
API_URL="https://gitlab.bsc.es/api/v4/projects/4120"
PACKAGE_REGISTRY_URL="$API_URL/packages/generic/horus/$version"
RELEASES_LINKS_URL="$API_URL/releases/$version/assets/links"

# Exit if the GITLAB_TOKEN environment variable is not set
if [ -z "$GITLAB_TOKEN" ]; then
    echo "Error: GITLAB_TOKEN environment variable is not set"
    exit 1
fi

for file in dist/*.zip; do
    echo "Uploading $file...\n"
    filename=$(basename $file)
    curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" --upload-file "$file" --url "$PACKAGE_REGISTRY_URL/$filename"
done

# Loop over each .tar.gz file in the dist/ directory
for file in dist/*.zip; do
    echo "Adding $file to release assets...\n"
    asset_name=$(basename "$file")
    asset_url="${PACKAGE_REGISTRY_URL}/$asset_name"

    curl --request POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --data name="$asset_name" \
    --data url="$asset_url" \
    --url "$RELEASES_LINKS_URL"
    
done