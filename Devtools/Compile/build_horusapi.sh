#!/bin/bash

# Go to the HorusAPI directory
cd HorusAPI

# Generate stubs
stubgen src/ --output stubs/

# Move the stubs to the src directory
mv stubs/HorusAPI/src/*.pyi src/

# Compile the python code and build the wheel
python setup.py build_ext bdist_wheel

# Remove the stubs
rm -rf stubs/ && rm -rf src/*.pyi

# Remove .c files
rm -rf src/*.c

# Move the wheel to the dist directory
cd .. && mv HorusAPI/dist/*.whl dist/

# Remove the dist HorusAPI directory
rm -rf HorusAPI/dist/

