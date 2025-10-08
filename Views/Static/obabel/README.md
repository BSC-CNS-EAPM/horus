# OpenBabel Integration

## Overview
This directory contains the OpenBabel JavaScript build for molecular structure processing within Horus.

## Updating OpenBabel

When updating OpenBabel from the [cheminfo-to-web project](https://github.com/partridgejiang/cheminfo-to-web), follow these steps:

### 1. Format the JavaScript file
```bash
npx js-beautify Views/Static/obabel/openbabel.js -r -w 80
```

This step is required because the OpenBabel JavaScript file is too large for standard Prettier formatting. Without proper formatting, the code becomes unreadable and difficult to maintain.

### 2. Apply code formatting
Save the file with Prettier to ensure consistent formatting.

### 3. Update script directory paths
Modify the script directory configuration to match Horus path structure:

```javascript
var scriptDirectory = self.baseURL + "/Static/obabel/";

if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.baseURL + "/Static/obabel/";
}
```

## Notes
- Ensure the path structure aligns with Horus's static file organization
- Test molecular structure processing functionality after updates
- Verify worker thread compatibility
