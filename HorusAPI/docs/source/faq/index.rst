.. _faq:

===
FAQ
===


Why aren't all the chains/ligands/residues of my PDB visible in the flow selector?
----------------------------------------------------------------------------------

Mol* sometimes loads certain PDBs as **ASSEMBLY** instead of **MODEL**, which by default hides secondary chains and ligands. To make all chains and ligands visible:

1. Click on the wrench icon in the Mol* viewer.
2. Open the "State Tree" panel.
3. Look for the section that says **Assembly**.
4. Change **Assembly** to **Model** to reveal the hidden chains and residues.

.. image:: images/assembly_to_model.png
   :width: 600
   :align: center
   :alt: Mol* Assembly to Model

How can I reset all the outputs of the blocks in my flow?
---------------------------------------------------------

You can reset the flow in two ways:

1. **Using the keyboard shortcut**:
   - Hold :bdg-secondary-line:`ctrl` (or :bdg-secondary-line:`⌘` on Mac) and press the play button of a block. 
   - This will reset and execute the flow from that block onward.

2. **Using the toolbar**:
   - Go to **Flow -> Reset Flow**.
   - This will reset all the outputs of the blocks, setting their status to "Not executed".

In both cases, the variables and configurations within the blocks are preserved. Files or results produced in the flow folder are **not deleted**. 
These options simply force Horus to re-execute any previously executed blocks.

How do I know if two blocks are correctly connected?
----------------------------------------------------

When hovering over the variables that can be dragged and dropped from the output
of a block to the input of another block, a small popup will appear providing information about that variable. 

The popup displays the description, name, and type of the variable.
To ensure maximum compatibility, verify that both variables are of the same type.
If they are not compatible, the connection will be displayed as a red line on the canvas.

==========
Contribute
==========

If you continue experiencing issues with :bdg-secondary-line:`Horus`, feel free to create a new issue on GitLab: `Submit an issue <https://gitlab.bsc.es/eapm/horus/-/issues/new>`_
