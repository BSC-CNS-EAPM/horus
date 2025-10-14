*******
Plugins
*******

Plugins are the way to extend Horus functionality. They are loaded when the app launches
and can be used to add new blocks, extensions or predefined flows to the app.

Automatic plugin creation
=========================
The easiest way to create a plugin is to use the :bdg-secondary-line:`create-horus-plugin` command provided
by the HorusAPI. This command will create a plugin folder with the basic structure, along with a build script
to create the plugin package. To create a plugin, activate the python environment where the HorusAPI is installed
and run the following command:

.. code-block:: bash

    create-horus-plugin

Manually creating a plugin
==========================

To manually create a plugin, first create a folder with the name of the plugin and inside
it, add a file called :bdg-secondary-line:`plugin.meta`. This file contains
the metadata of the plugin in JSON format and it's used by Horus to load the plugin. Here's an
example of a plugin metadata file:

.. code-block:: json

    {
        "id": "horus",
        "name": "Horus",
        "description": "Base plugin for Horus",
        "author": "Horus",
        "version": "0.0.1",
        "pluginFile": "Horus.py",
        "dependencies": [],
        "pluginRequires": [],
    }


This is a JSON object that represents a plugin for the Horus app. The object contains the following properties:

- ``id``: The unique ID of the plugin.
- ``name``: The name of the plugin.
- ``description``: The description of your plugin.
- ``author``: The author of the plugin.
- ``version``: The version of the plugin.
- ``pluginFile``: The entry point of the plugin. This file must be located in the root of the plugin folder.
- ``minHorusVersion``: The minimum Horus version required in order to run the plugin (optional).
- ``maxHorusVersion``: The maximum Horus version required in order to run the plugin (optional).
- ``platforms``: A list of the platforms where this plugin runs. Allowed values are "universal", "linux", "macos_intel" and "macos_arm". Defaults to "universal" if not specified (optional).
- ``externalURL``: An URL that links to the Plugin's webpage or documentation (optional).
- ``dependencies``: An array of strings that contains the PyPI dependencies of the plugin. This dependencies can be declared as DEPENDENCY==VERSION or using the --no-deps flag (DEPENDENCY==VERSION --no-deps) which will allow to install the dependency without installing the others that are necessary for it, or using the --isolated flag (DEPENDENCY==VERSION --isolated) which will install that dependency separately from the others (optional).
- ``pluginRequires``: A list of Plugin IDs that can be used as a dependency for this other plugin. The plugins listed here will share the deps / Include folders. (optional).

Dependencies of plugins
-----------------------

As you may know, Horus runs a python backend, which allows plugins to execute arbitrary python code. You can
include any Python library that is required for your Plugin to work. To include libraries in
your plugin, you must add them to the :bdg-secondary-line:`dependencies` array of the plugin metadata file. For example, if you want
to include pandas and matplotlib, your :bdg-secondary-line:`plugin.meta` file should look like this:

.. code-block:: json

    {
        "id": "my_unique_id",
        "name": "My Plugin",
        "description": "A custom plugin",
        "author": "Foo",
        "version": "0.0.1",
        "pluginFile": "main.py",
        "dependencies": ["pandas", "matplotlib"]
    }


When the plugin is loaded, Horus will install the dependencies using :bdg-secondary-line:`pip`. If the dependencies are already installed,
Horus will skip the installation. In order for the dependencies to be installed, the computer where
Horus is running must have a valid :bdg-secondary-line:`python` interpreter installed. 

Deps folder: Some libraries are either not available in :bdg-secondary-line:`pip` or they are private. In this case, you can
embeed the library pre-installed with the plugin by isntalling manually the package in the :bdg-secondary-line:`Include` folder of the plugin.
The :bdg-secondary-line:`Include` folder is located in the root of the plugin folder and is appended to the :bdg-secondary-line:`PYTHONPATH` variable
when the plugin is loaded, allowing for imports to work.

Moreover, one can import from other plugins, as the plugins directory is automatically included in the :bdg-secondary-line:`PYTHONPATH`. Make sure to add the dependency plugin ID in "pluginRequires" to the plugin
meta of your plugin if you intend to import from other plugins.

.. warning::

    When importing a library in your python Plugin code, make sure to always import inside scoped functions. Libraries
    imported at top level may not work as the plugin gets automatically unloaded when not in use. This may result in
    the library being unloaded and the plugin not working as expected.

.. note::

    Aditionally, preinst.sh and postinst.sh files can be provided in the plugin folder to declare pre-install and post-install scripts. These will execute before and after the plugin install process, respectively. 
    Moreover, prerm.sh and postrm.sh can be provided to perform the same functionality when uninstalling the plugin.
    Those scripts allow to perform custom actions like copying files, installing environments and more during the installation process.

Code organization
-----------------

The code of the plugin should be located in the root of the plugin folder, but this is not mandatory. You can organize
some of the code inside a :bdg-secondary-line:`Include` folder. The only requirement is that the entry point of the plugin must be
located in the root of the plugin folder and must be named as the :bdg-secondary-line:`pluginFile` property of the plugin metadata file.
When running the plugin, the :bdg-secondary-line:`Include` folder is appended to the :bdg-secondary-line:`PYTHONPATH` variable.
Moreover, you can specify a logo for your plugin by including a :bdg-secondary-line:`logo.png` image into the root of the plugin.
Therefore, a more complex :bdg-secondary-line:`Plugin` folder structure can look like:

.. code-block:: bash

    MyPlugin
    ├── Include
    │   ├── __init__.py
    │   └── mymodule.py
    ├── deps
    │   └── ... # Installed by Horus
    ├── plugin.meta
    └── main.py
    └── logo.png # Logo for your plugin

Then you can use the following statement in your :bdg-secondary-line:`main.py` file to import the :bdg-secondary-line:`mymodule.py` file:

.. code-block:: python

    from mymodule import MyModule

Coding the plugin
=================
In order to create a plugin we need to use the :bdg-secondary-line:`Plugin` class. This class is located in the :bdg-secondary-line:`HorusAPI` module. 
The plugin object must be instantiated to a global :bdg-secondary-line:`plugin` variable. For example:

.. code-block:: python

    from HorusAPI import Plugin

    plugin = Plugin()

or from a function that returns the plugin object:

.. code-block:: python

    from HorusAPI import Plugin

    def get_plugin():
        return Plugin()

    plugin = get_plugin()


Once you have instantiated your :bdg-secondary-line:`Plugin` object, you can start adding blocks and extensions to it. Please refer
to the :ref:`api-reference` section for more information about how to add blocks and extensions to your plugin using the :bdg-secondary-line:`Plugin` object.

Live development
================

When developing a plugin, you may want to test it without having to install it in Horus every time a change is made. To do this, you can use the
:bdg-secondary-line:`development mode` setting when running Horus. This setting is available in the :bdg-secondary-line:`Settings` section of the app.
When this setting is enabled, a new button in the Bloks sidebar will appear. This button will allow you to reload the plugin without having to restart
Horus.

For advanced debugging capabilities, including breakpoints and step-by-step execution, see the :ref:`debugpy` section which explains how to use Python's debugpy adapter for plugin debugging.

Furthermore, it is recommended to make a symlink of your plugin development folder in the :bdg-secondary-line:`Plugins` folder of Horus. This way, you can
develop your plugin in a separate folder and reload it in Horus without having to copy the plugin folder every time a change is made. To do this, you can
run the following command in your terminal:

.. code-block:: bash

    # Linux
    ln -s /absolute/path/to/your/plugin /home/<username>/.local/share/horus/Plugins

    # macOS
    ln -s /absolute/path/to/your/plugin /Users/<username>/Library/Application\ Support/horus/Plugins

You can also change the folder where Horus looks for the installed plugins using the :bdg-secondary-line:`HORUS_PLUGINS_DIR` or :bdg-secondary-line:`HORUS_DEV_PLUGINS_FOLDERS` environment variable. Check all the
Horus options in the :ref:`running` section.

.. note::

    The :bdg-secondary-line:`Plugins` are imported in the following order:

    1. Development plugins
    2. Installed plugins
    3. Default plugins

.. warning::

    Make sure the symlink is correctly created in the :bdg-secondary-line:`Plugins` folder of Horus. Otherwise, the plugin will not be loaded.
    The folder containing the *.py entry (and all the plugin files), should be inside the :bdg-secondary-line:`Plugins` folder. For example, if your plugin
    folder is called :bdg-secondary-line:`MyPlugin`, the final path to the entry point of the plugin should look like:

    .. code-block:: bash

        # Linux
        /home/<username>/.local/share/com.bsc.horus/Plugins/MyPlugin/main.py

        # macOS
        /Users/<username>/Library/Application\ Support/com.bsc.horus/Plugins/MyPlugin/main.py

.. note::

    You can also modify the AppSupport directory of an Horus instance by setting the environment variable HORUS_APP_SUPPORT_DIR.
    
    .. code-block:: bash

        export HORUS_APP_SUPPORT_DIR="/my/app/support/dir/folder"


Distributing plugins
====================

Once your plugin is ready, you can distribute it to other users. To do this, you have to create a zip file with the
contents of the plugin folder and then rename the :bdg-secondary-line:`.zip` extension to :bdg-secondary-line:`.hp`. Plugins can be installed in Horus
using the :bdg-secondary-line:`Install plugin` button in the :bdg-secondary-line:`Plugins` section of the app.

.. image:: images/PluginManager.png
    :width: 600
    :align: center
    :alt: Plugin Manager window with installed plugins.
