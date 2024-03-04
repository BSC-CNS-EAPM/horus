#!/bin/bash

# Check for Typescript errors
if bunx tsc --noEmit --skipLibCheck Views/**/*.ts Views/**/*.tsx; then
    echo "No TypeScript errors found."
else
    echo "TypeScript errors found."
fi

# Check for eslint errors
if bunx eslint Views/; then
    echo "No ESLint errors found."
else
    echo "ESLint errors found."
fi

# Run prettier
bunx prettier --write Views/

# Check for Python errors with pylint
pylint App Server HorusAPI

# Check for types errors with pyright
pyright App Server HorusAPI

# Format python with black
black --line-length 98 App Server HorusAPI

