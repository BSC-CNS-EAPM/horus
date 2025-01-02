.. _webapp:

***********
WebApp mode
***********

You can configure Horus as a web server to offer a Web App to your users. In order to configure the Web App mode, you need to setup a horus.config.json file in the current working directory.
The configuration file is a JSON file that contains the server configuration and the user management settings.

.. note::
  You can set a custom logo for the Web App by placing a file called "logo.png" in the root folder of your project, just where you will run `horus -w`.


.. note::
  The first user to register will be automatically assigned as administrator. This user will have acces to the AdminTools panel, where permissions, plugins and app settings can be managed.


Configuration File
==================

This document describes the configuration options available in the JSON configuration file. Here it is shown
as a JavaScript file for clarity, but take into account that the configuration file must be a JSON.

.. literalinclude:: horus.config.template.js
  :language: javascript


Public flows
============

The Horus WebApp instance can have a public flows directory. The flows inside that folder will be displayed as "Preset flows" alognside flows that come from plugins. To setup this folder, just use the following environment variable: **HORUS_PUBLIC_FLOWS=/path/to/public/flows/dir**.