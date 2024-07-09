.. _install_plugin:

Installing Plugins
==================

Understanding Plugins
---------------------

:bdg-secondary-line:`Horus` works with :bdg-secondary-line:`Blocks`, which perform actions on the flow. To add more :bdg-secondary-line:`Blocks` or extensions (additional views), users need to install :bdg-secondary-line:`Plugins`.
:bdg-secondary-line:`Plugins` can be downloaded directly from the Plugin developer website and have the `.hp` (Horus Plugin) format.

If you are interested in building custom :bdg-secondary-line:`Plugins`, please refer to the :ref:`developer` section.

Installing a Plugin
-------------------

To install a :bdg-secondary-line:`Plugin` in :bdg-secondary-line:`Horus`, follow these steps:

1. **Open the Plugin Manager:**

   - Go to the plugin manager within the :bdg-secondary-line:`Horus` application.

   .. image:: images/plugins_1.png
    :width: 600
    :align: center
    :alt: Open Plugins Manager

2. **Install the Plugin:**

   - Click on "Install Plugin."
   - Browse for the `.hp` file you downloaded from the :bdg-secondary-line:`Plugin` developer website.
   - Wait for the :bdg-secondary-line:`Plugin` to install. If the installation appears to be stuck, please be patient as some dependencies may take a while to download and install.

   .. image:: images/plugins_2.png
    :width: 600
    :align: center
    :alt: Select install plugin

3. **Verify Installation (optional):**

   - Check the :bdg-secondary-line:`Horus` logs to verify if the :bdg-secondary-line:`Plugin` is completely installed (only if necessary). 
   - Logs can be found at:
        - macOS: `~/Library/Application Support/com.bsc.horus/logs`
        - Linux: `~/.local/share/com.bsc.horus/logs`

4. **Restart Horus (optional):**

   - Some :bdg-secondary-line:`Plugins` require the application to be restarted to function properly.

Example
-------

To install a :bdg-secondary-line:`Plugin` named `example_plugin.hp`:

1. Download `example_plugin.hp` from the :bdg-secondary-line:`Plugin` developer website.
2. Open :bdg-secondary-line:`Horus` and go to the :bdg-secondary-line:`Plugins` manager.
3. Click on "Install Plugin" and select `example_plugin.hp`.
4. Wait for the installation to complete. Check the logs if needed.
5. Restart :bdg-secondary-line:`Horus` if prompted.
