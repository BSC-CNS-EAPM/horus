**********
Extensions
**********

Building an extension view
==========================

Extensions are embedded views coded in HTML, CSS and JavaScript. They can be used
to add new interfaces for interacting with the results of your blocks, for example.
In order to display the embedded view, you need to include the web files inside
the :bdg-secondary-line:`Pages` folder of your plugin:

.. code-block:: bash

    MyPlugin
    ├── Include/
    ├── deps/
    ├── Pages/ # Put here all your web files
    ├── plugin.meta
    └── main.py

This folder acts as the root of your web page.

PluginPage
----------

Extensions are built using the :bdg-secondary-line:`PluginPage` class.

.. autoclass:: src.PluginPage

PluginEndpoint
--------------

As you may have noticed, web pages need to contact the server through requests in order
to get data. This is done using the :bdg-secondary-line:`PluginEndpoint` class. 
Horus runs a background Flask server, therefore you can treat your extensions as
being part of a Flask app. The URL to send the requests to can be computed using the `window.location` value
due to the fact that extensions are running inside an iframe. For example:

.. code-block:: javascript

    const href = window.location.href;

    const postTo = href + "customEndpoint"; // This will be the correct URL to send the request to

.. autoclass:: src.PluginEndpoint

Adding views to your Plugin
===========================

Once you have defined your :bdg-secondary-line:`PluginPage` and :bdg-secondary-line:`PluginEndpoint` objects,
you can add them to your plugin using the :bdg-secondary-line:`addPage` method of the :bdg-secondary-line:`Plugin` class.

.. code-block:: python

    plugin.addPage(myCustomViewPage)

If the extension is correctly defined, you should be able to see it in the Extensions menu.

.. image:: images/extensions.png
    :align: center

Examples
========

.. code-block:: python

    # Define the PELE results page
    myCustomViewPage = PluginPage(
        id="customView",
        name="Custom view",
        description="View your results in a custom way",
        html="index.html", # The HTML file to load
    )

    # Define the endpoint function
    def customEndpointFunction():
        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        print(data)

        return {"ok": True}


    # Add the endpoint to the PluginPage
    customEndpoint = PluginEndpoint(
        url="/customEndpoint",
        methods=["POST"],
        function=customEndpointFunction,
    )

    # Add the endpoint to the page
    myCustomViewPage.addEndpoint(customEndpoint)

Extensions class
----------------

Apart from opening the extensions view from the menu, you can also use the :bdg-secondary-line:`Extensions` class
to open the view directly from a :bdg-secondary-line:`Block` action. Using the :bdg-secondary-line:`open()` method you can pass
data to your extension that can be handled when loading the HTML. You will need
the ID of the plugin that provides the extension and the extension ID.

In your block's action:

.. code-block:: python

    from HorusAPI import Extensions

    # Open the extensions view
    Extensions().open(pluginID="mypluginid", pageID="customView", data={"someData": data})


You can also store the "result" inside the block that provided the data. This will display
an "Extensions" button in the block's view with the provided label. When clicked, the extension
will open with the provided data.

.. code-block:: python

    from HorusAPI import Extensions

    # Open the extensions view
    Extensions().storeExtensionResults(pluginID="mypluginid", pageID="customView", data={"someData": data}, title="View results")

You can access the data in JavaScript as follows:

.. code-block:: javascript
    
    // Get the data passed from the extension
    const data = window.parent.extensionData; // Remember that extensions run inside an iframe
    console.log(data.someData) // The object passed from the Extensions class
