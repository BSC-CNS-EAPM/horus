**************
Molstar (Mol*)
**************

Molstar is the molecular visualizer bundled with Horus. Mol* is an open
source molecular visualizer written in TypeScript and WebGL. You can
find tutorials, documentation and the source code of Mol* at https://molstar.org.

.. image:: images/molstar.png
    :width: 95%
    :align: center
    :alt: Molstar implementation in Horus

In order to control Mol* from Horus, we use the :bdg-secondary-line:`MolstarAPI`, a bridge
built for communicating :bdg-secondary-line:`Blocks` with the molecular visualizer.

MolstarAPI
==========

MolstarAPI is a library for creating and manipulating molecular structures in the embedded Mol* visualizer inside Horus.
It is designed to be used withing :bdg-secondary-line:`Blocks` in order to add, visualize or edit
molecular structures.

In order to control the molecular visualizer within a :bdg-secondary-line:`Block` action, you need to import the
:bdg-secondary-line:`MolstarAPI` class and use the singleton instance to call the desired methods.

.. code-block:: python

    from HorusAPI import MolstarAPI

    my_pdb_file = "/path/to/1crn.pdb"
    molecule_name = "1crn crystal structure"

    # Create the structure calling directly the Mol* API
    MolstarAPI().addPDB(my_pdb_file, molecule_name)    

.. automodule:: src.molstar
    :members:
    :undoc-members:
