************
Installation
************

In order to develop :bdg-secondary-line:`Plugins` for Horus, you should
install the HorusAPI package in your python environment. This package contains the necessary
classes and functions to interact with the Horus app. The installation of the package is not mandatory, as the
plugins will run inside Horus, not your virtual environment. The main attractive of installing the :bdg-secondary-line:`HorusAPI` is to be able to
develop the plugins with type hints and code completion.

Main installation
=================

You will need to download the latest release of |Product| from the
`releases page <https://horus.bsc.com/download>`_. You can also install
|Product| directly from PyPI using ``pip``:

.. code-block:: bash

    pip install HorusAPI

Once installed, you can import the |Product| package into your Python
application:

.. code-block:: python

    import HorusAPI

.. note::

    To install from the releases page, perform the following command instead:

    .. code-block:: bash

        pip install <path to horusapi-x.x.x.whl>

.. |Product| replace:: HorusAPI