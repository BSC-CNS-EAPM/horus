.. _faq:

============
FAQ & Issues
============


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

Flows Stuck in "Queued" State and Application Crashes on macOS
--------------------------------------------------------------

A limitation with macOS multiprocessing can sometimes prevent flow subprocesses from starting correctly, causing flows to remain in the "Queued" state and the application to crash. To resolve this issue:

1. **Restart Horus**: A simple restart often resolves the problem.

2. **Run Horus from the Command Line**: If restarting does not help, start Horus from the command line (see the :ref:`running` section for details) and set the environment variable `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`.

This should allow flows to run smoothly.

.. note::

    This issue will be fixed in future versions of Horus.

Error importing libraries in Linux
----------------------------------

You may encounter an error like the following when running Horus on Linux machines:

.. code-block:: bash

   ImportError: /usr/local/bin/Horus/_internal/libcrypto.so.3: version `OPENSSL_3.3.0'/usr/local/bin/Horus/_internal/libssl.so.3

This error may occur due to slight version differences in Linux standard libraries. To resolve this, the best approach is to have Horus use the system libraries.
You can do this by removing the conflicting files. For the example above, you would run:

.. code-block:: bash

   rm /usr/local/bin/Horus/_internal/libssl.so.3

==========
Contribute
==========

If you continue experiencing issues with :bdg-secondary-line:`Horus`, feel free to create a new issue on GitLab: `Submit an issue <https://gitlab.bsc.es/eapm/horus/-/issues/new>`_
