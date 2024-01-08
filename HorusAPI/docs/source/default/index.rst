.. _default:

**************
Default blocks
**************

Horus implements some useful blocks by default.

- VisualizePDB
- Atom
- chain
- File
- Folder
- Smiles

******************
Default extensions
******************

Horus comes with a default extension used to load HTML files. This can be useful for loading simple reports of the calculations made by a block.
For example, one could load pandas dataframes, matplotlib plots, or even ipywidgets.

You can use the extension by calling the ExtensionsAPI from inside a block. Use the pluginID "horus" and the pageID "html_loader". Then, pass the html file as a string in the data parameter.

.. code-block:: python

    from HorusAPI import Extensions, PluginBlock

    def myBlockAction(block: PluginBlock):
        from ipywidgets import IntSlider
        from ipywidgets.embed import embed_minimal_html

        slider = IntSlider(value=40)
        embed_minimal_html('export.html', views=[slider], title='Widgets export')

        # Load the html file as a string
        with open("export.html", "r") as f:
            html = f.read()

        Extensions().open(pluginID="horus", pageID="html_loader", data={"html": html})





