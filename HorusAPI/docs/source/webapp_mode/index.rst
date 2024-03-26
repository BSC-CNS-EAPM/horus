***********
WebApp mode
***********

You can configure Horus as a web server to offer a Web App to your users. In order to configure the Web App mode, you need to setup a horus.config.json file in the current working directory.
The configuration file is a JSON file that contains the server configuration and the user management settings.

.. note::
  You can set a custom logo for the Web App by placing a file called "logo.png" in the root folder of your project, just where you will run `horus -w`.


Configuration File
==================

This document describes the configuration options available in the JSON configuration file. Here it is shown
as a JavaScript file for clarity, but take into account that the configuration file must be a JSON.

.. literalinclude:: horus.config.template.js
  :language: javascript
