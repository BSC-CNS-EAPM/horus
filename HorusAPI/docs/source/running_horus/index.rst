.. _running:

Running Horus
=============

Launching Horus
---------------

For macOS and Ubuntu 22+
^^^^^^^^^^^^^^^^^^^^^^^^

To open :bdg-secondary-line:`Horus`, simply click the :bdg-secondary-line:`Horus` icon.

Command Line Options
--------------------

On both macOS and Linux, :bdg-secondary-line:`Horus` supports advanced command line arguments. Use the **-\-help** command to view all the
available options. Please replace :bdg-secondary-line:`Horus` in the command with the actual path for your :bdg-secondary-line:`Horus`
installation. For linux, it should be in the PATH, but on macOS, the executable is found under the Horus.app.

.. code-block:: bash

    # For macOS
    /Applications/Horus.app/Contents/MacOS/Horus --help

    # If you have the executable in the PATH or an alias
    horus --help


By default, :bdg-secondary-line:`Horus` uses a random port. If you want to fix the port to have the same URL always, use the `-p` and `-h` parameters.

Environment Variables
----------------------

In addition to command-line options, Horus allows configuration through the following environment variables:

- **HORUS_APP_SUPPORT_DIR**: Specifies the directory path for the App Support folder, which holds user configurations, remotes, and installed plugins.
- **HORUS_DEFAULT_PLUGINS_DIR**: Defines the path for default plugins that cannot be uninstalled. The default Horus plugin is located here. By default, this is set to ``app_support_dir/DefaultPlugins``.
- **HORUS_PLUGINS_DIR**: Indicates the directory for user-installed plugins. By default, this points to ``app_support_dir/Plugins``.
- **HORUS_PUBLIC_FLOWS**: Directory for public flows. Intended to be used in WebApp mode.
- **HORUS_GUI**: Sets the GUI backend to be used. Available options are QT and GTK (Linux only), or Cocoa (macOS).
- **HORUS_MODE**: Specifies the application mode. Valid values are ``app``, ``browser``, ``server``, or ``webapp``.
- **HORUS_PORT**: Defines the port for the Horus server.
- **HORUS_HOST**: Specifies the host for the Horus server.


**App Mode (Default Mode)**
---------------------------
This mode runs :bdg-secondary-line:`Horus` standard in a windowed environment.

**Browser Mode**
----------------
In cases where you need all the capabilities of App Mode (such as file picker interactions with the OS),
but the rest of the GUI (Mol*, the flow canvas, etc.) does not work well on the integrated GTK/Cocoa framework,
you can use this mode. It opens a small window that redirects to your web browser at the specified :bdg-secondary-line:`Horus` URL.

**Server Mode**
---------------
This mode runs :bdg-secondary-line:`Horus` entirely in server mode (no windowed app). You can connect using a browser to the application.
It is the same as Browser Mode but without the OS file picker.

**WebApp Mode**
---------------
This mode is intended for running :bdg-secondary-line:`Horus` in a private/public environment with user capabilities, registration, etc. For more
information, please refer to the :ref:`webapp` section.
