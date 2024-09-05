#!/bin/bash

# Check for Typescript errors
if bunx tsc --noEmit --skipLibCheck Views/**/*.ts Views/**/*.tsx --jsx react-jsx; then
    echo "No TypeScript errors found."
else
    echo "TypeScript errors found."
    exit 1
fi

# Check for eslint errors
if bunx eslint Views/ --ignore-pattern Static; then
    echo "No ESLint errors found."
else
    echo "ESLint errors found."
    exit 1
fi

# Run prettier (does not affect the pipeline, just formatting)
bunx prettier --write Views/

# Check for Python linting errors with pylint
if pylint App Server HorusAPI --fail-under 9.5; then
    echo "No pylint errors found."
else
    echo "pylint errors found."
    exit 1
fi

# Check for Python type errors with pyright
if pyright App Server HorusAPI; then
    echo "No pyright type errors found."
else
    echo "pyright type errors found. Please check / fix them."
fi

# Format python with black (does not affect the pipeline, just formatting)
black --line-length 98 App Server HorusAPI