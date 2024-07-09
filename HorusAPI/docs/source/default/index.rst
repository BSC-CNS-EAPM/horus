.. _default:

**************
Default blocks
**************

:bdg-secondary-line:`Horus` implements some useful blocks by default. These can be found under the "Horus" section of the :bdg-secondary-line:`Block` list.

.. image:: images/horus_defaults.png
    :width: 600
    :align: center
    :alt: Horus default blocks

******************
Default extensions
******************

Horus comes with a default :bdg-secondary-line:`Extension` used to load HTML files, images and more. This can be useful for loading simple reports of the calculations made by a :bdg-secondary-line:`Block`.
For example, one could load pandas dataframes, matplotlib plots, or even ipywidgets.

You can use the extension by calling the :bdg-secondary-line:`ExtensionsAPI` from inside a :bdg-secondary-line:`Block`. You can use its methods to load information into :bdg-secondary-line:`Horus`. For
more information about :bdg-secondary-line:`Extensions`, please refer to the :ref:`extensions` section.

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

        Extensions().loadHTML(html, "My results")





