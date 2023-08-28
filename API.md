# API Specification

## General

### Version

Route: `/api/version/`

Method: `GET`

Response: `{"nbdsuite": "version", "horus": "version"}`

## NBDSuite
### Force fields
Route: `/api/nbdsuite/forcefields/`

Method: `GET`

Response: `{["forcefield1", "forcefield2", ...]}`

## Flows and blocks
### Flows
Route: `/api/flows/`

Method: `GET`

Response: `{["flow1", "flow2", ...]}`

### Blocks
Route: `/api/blocks/`

Method: `GET`

Response: `{["block1", "block2", ...]}`

## Plugins

Route: `/api/plugins/`

Method: `GET`

Response: `{["plugin1", "plugin2", ...]}`
