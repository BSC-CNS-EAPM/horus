const { contextBridge } = require('electron');

// Get app version
const pjson = require('../../package.json');

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    app: () => pjson.version
})