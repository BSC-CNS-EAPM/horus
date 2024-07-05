.. _molstar:

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
It is designed to be used within :bdg-secondary-line:`Blocks` in order to add, visualize or edit
molecular structures.

In order to control the molecular visualizer within a :bdg-secondary-line:`Block` action, you need to import the
:bdg-secondary-line:`MolstarAPI` class and use the desired methods.

.. code-block:: python

    from HorusAPI import MolstarAPI

    my_pdb_file = "/path/to/1crn.pdb"
    molecule_name = "1crn crystal structure"

    with open(my_pdb_file, "r") as f:
        pdb_file_contents = f.read()

    # Create the structure calling directly the Mol* API
    MolstarAPI().addPDB(pdb_file_contents, molecule_name)

The Mol* actions will be stored in the :bdg-secondary-line:`flow` and will be applied to the canvas after it finishes. The actions will be applied in the 
order they were called. If a :bdg-secondary-line:`flow` is not opened, the actions will be applied when the :bdg-secondary-line:`flow` is first opened. 
After apllying the actions, the :bdg-secondary-line:`flow` will be saved again with the updated Mol* state.

MolViewSpec
-----------

The :bdg-secondary-line:`MolstarAPI` in Horus is compatible with :bdg-secondary-line:`MolViewSpec`. For more information about this library, please visit the
`MolViewSpec documentation <https://colab.research.google.com/drive/1O2TldXlS01s-YgkD9gy87vWsfCBTYuz9#scrollTo=QaFqBtMQIz_r>`_.

Horus comes with :bdg-secondary-line:`mvs` embedded inside the MolstarAPI, you can access the library by calling the :bdg-secondary-line:`mvs` attribute of the :bdg-secondary-line:`MolstarAPI` class.

.. code-block:: python

    from HorusAPI import MolstarAPI

    mol = MolstarAPI()

    # MolviewSpec
    mvs = mol.mvs
    builder = mvs.create_builder()
    (
        builder.download(url="https://www.ebi.ac.uk/pdbe/entry-files/download/1cbs_updated.cif")
        .parse(format="mmcif")
        .assembly_structure(assembly_id="1")
        .component()
        .representation()
    )

    # We can load the scene in Mol* using the loadMVJS method
    mol.loadMVJS(builder.get_state())

MolstarAPI methods
------------------

.. automodule:: src.molstar
    :members:
    :undoc-members:
