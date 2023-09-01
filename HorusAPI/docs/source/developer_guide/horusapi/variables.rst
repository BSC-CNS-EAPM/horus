*********
Variables
*********

Usign variables in your :bdg-secondary-line:`Blocks` is very easy. Variables allow for the
interchange of information between the :bdg-secondary-line:`Flow` and the 
:bdg-secondary-line:`Action` of the blocks. Consider variables as parameters that the user
can modify during the build of the :bdg-secondary-line:`Flow`.

PluginVariable
==============

In order to define a variable that can be used in the :bdg-secondary-line:`Flow builder` you need to
instantiate the :bdg-secondary-line:`PluginVariable` class. This class has the following
parameters:

.. autoclass:: src.PluginVariable

For example, one may want to define a variable that allows the user to select a PDB
structure from the Mol* visualizer. This variable can be defined as follows:

.. code-block:: python

    structureVariable = PluginVariable(
        name="Structure",
        id="structure",
        description="Select a molecular structure from Mol*",
        type=VariableTypes.STRUCTURE,
    )

VariableTypes
=============

It is important to correctly define the type of our :bdg-secondary-line:`PluginVariables`. The available types are
defined in the :bdg-secondary-line:`VariableTypes` class:

.. autoclass:: src.VariableTypes
    :members:

For array types, such as :bdg-secondary-line:`STRING_LIST`, you need to specify
the allowed values in the :bdg-secondary-line:`allowedValues` parameter. For example:

.. code-block:: python

    favoriteColor = PluginVariable(
        name="Favorite color",
        id="favcolor",
        description="Select your favorite color",
        type=VariableTypes.STRING_LIST,
        allowedValues=["Red", "Green", "Blue"],
    )

VariableGroup
=============

Variables can be grouped together using the :bdg-secondary-line:`VariableGroup` class. This is intended for
:bdg-secondary-line:`Blocks` that work with different sets of inputs. 

.. autoclass:: src.VariableGroup

For example, a PELE simulation
may require the input data for the protein and the ligand, which can be grouped together in a complex or separated
in their respective files. In this case, the :bdg-secondary-line:`VariableGroup` class can be used to group
these two different types of inputs:

.. code-block:: python

    ligandFileInput = VariableGroup(
        id="ligandFileInput",
        variables=[
            system_data_input,
            ligand_data_input_file,
        ],
    )

    ligandSelectionInput = VariableGroup(
        id="ligandSelectionInput",
        variables=[
            complex_data_input,
            complex_ligand_selection_input,
        ],
    )

The :bdg-secondary-line:`VariableGroup` class has to be then assigned to the inputGroup parameter of a :bdg-secondary-line:`Block`.