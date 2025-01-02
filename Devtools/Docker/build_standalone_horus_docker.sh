echo "Building standalone docker image for Horus $VERSION..."

# Build Horus standalone image
docker build -t horus -f Devtools/Docker/horus.dockerfile .

# Push Horus standalone image
docker tag horus chdominguez/horus:latest
docker tag horus chdominguez/horus:$VERSION

# Push both tags
docker push chdominguez/horus:latest
docker push chdominguez/horus:$VERSION
