#!/bin/bash

if command -v bunx &> /dev/null; then
    RUNNER="bunx"
elif command -v npx &> /dev/null; then
    RUNNER="npx"
else
    echo "Error: Neither bunx nor npx is installed."
    exit 1
fi

# Check for Typescript errors
if $RUNNER tsc --noEmit --skipLibCheck --project tsconfig.json; then
    echo "No TypeScript errors found."
else
    echo "TypeScript errors found."
    exit 1
fi

# Check for eslint errors
if $RUNNER eslint Views/ --ignore-pattern Static; then
    echo "No ESLint errors found."
else
    echo "ESLint errors found."
    exit 1
fi

# Run prettier (does not affect the pipeline, just formatting)
$RUNNER prettier --write Views/ --ignore-pattern "Views/Static/**"

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