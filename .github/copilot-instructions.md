# Copilot Instructions for Horus

## Project Overview

- **Horus** is a modular, multi-platform GUI for scientific workflow design, especially in molecular modeling. It supports both local and server modes, with a 2D infinite canvas and autonomous, linkable blocks.

## Technology stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Flask, Python 3.9

## Frontend guidelines

- Use functional components and React hooks.
- Function component should be in `PascalCase` and using the function keyword.

## Backend guidelines

- Follow pylint and PEP 8 standards.
- Use type hints for function signatures.
- Use Flask blueprints for modularity.

## Plugins

- Horus plugins aim to extend the core functionality of the application. They can be developed independently and integrated seamlessly using the HorusAPI.
- Plugins can introduce new views (called Extensions) or new blocks (called Blocks).
- New extensions are run inside an iframe, and communicate with the main application using the window object or by calling the backend API.
- When communicating with the frontend app, the Extensions use the parent window object. For example, parent.horusVariables.setVariable() will update the variable in the flow that is assigned to the extension.

  **Update this file if you introduce new conventions, workflows, or architectural changes.**
