******
Blocks
******

Blocks are the most important part of the HorusAPI. :bdg-secondary-line:`Blocks` execute python code
based on the provided :bdg-secondary-line:`PluginVariable`. In order to build a :bdg-secondary-line:`Block`,
you first need to instantiate some :bdg-secondary-line:`PluginVariable` and define the :bdg-secondary-line:`Action`
that the block will perform.

.. warning::
    The :bdg-secondary-line:`PluginVariable` instances are only used to model the variables of the block. In order to access the updated values,
    do so using the :bdg-secondary-line:`block.variables` or :bdg-secondary-line:`block.variables` properties.

Defining the Block
==================

The first step is to instantiate the :bdg-secondary-line:`Blocks` class. There are different kind of blocks depending on the :bdg-secondary-line:`Action` that they perform: 
Regular blocks (:bdg-secondary-line:`PluginBlock`), Input blocks (:bdg-secondary-line:`InputBlock`) and Slurm blocks (:bdg-secondary-line:`SlurmBlock`). 

.. autoclass:: src.PluginBlock

.. autoclass:: src.InputBlock

.. autoclass:: src.SlurmBlock

:bdg-secondary-line:`PluginBlock` is the most common block. It is used to execute a single python function that will be run locally
on the machine. :bdg-secondary-line:`InputBlock` only accepts a single :bdg-secondary-line:`PluginVariable` as input and are used to
pass data to the inputs of another :bdg-secondary-line:`PluginBlock` or :bdg-secondary-line:`SlurmBlock`. Finally, :bdg-secondary-line:`SlurmBlock`
executes two python functions, one before the job is sent to the a Slurm queue, and one after the job is finished.

Setting the action of the block
-------------------------------

The :bdg-secondary-line:`Action` of the block is defined as a python function. The function must always take the :bdg-secondary-line:`block` parameter with the respective :bdg-secondary-line:`PluginBlock` type.
If any error is raised past the :bdg-secondary-line:`Action` function scope, the block will be marked as failed and the error message will be displayed in the GUI as a pop-up alert.

Accessing variables
-------------------

In order to acces the updated variables coming from the flow within the :bdg-secondary-line:`Block` :bdg-secondary-line:`Action`,
do not use the :bdg-secondary-line:`PluginVariable` object, but rather the :bdg-secondary-line:`block.variables` dictionary. This dictionary
contains the updated values of the variables, and can be accessed using the :bdg-secondary-line:`PluginVariable` ID as the key. You can access three
different kind of variables: :bdg-secondary-line:`Variables`, :bdg-secondary-line:`Inputs` and :bdg-secondary-line:`Configs`.

.. code-block:: python

    def myCustomAction(block: PluginBlock):

        # The block passed to the function contains an updated dictionary of the variables
        # acces it using the variable id

        # Accessing variable value
        inputStringValue = block.variables["stringVariableID"]

        # Accessing input value
        inputFilePath = block.inputs["fileID"]

        # Accessing config value
        configValue = block.config["configID"]

        print(inputStringValue)

Setting outputs
---------------

If your :bdg-secondary-line:`Block` produces any output, you can set the value of the variable using the :bdg-secondary-line:`block.setOutput()`
method. As with the other variables, use the output variable ID.

.. code-block:: python

    def myCustomAction(block: PluginBlock):

        # Setting output value
        block.setOutput("outputVariableID", variableValue)

Examples
========

Input blocks
------------

As an example, here is the definition of an :bdg-secondary-line:`InputBlock` that simply passes a string to the next block:

.. image:: images/input_block.png
    :align: center
    :width: 300
    :alt: String input block provided by the default Horus plugin

.. code-block:: python

    from HorusAPI import PluginVariable, InputBlock, VariableTypes

    # First define the variable to be used in the block
    inputString = PluginVariable(
        name="String",
        id="string",
        description="A string to be used as an input.",
        type=VariableTypes.STRING,
    )

    # Then instantiate the block giving it a name, a description, the action to be performed and the variable.
    stringBlock = InputBlock(
        name="String",
        description="A string to be used as an input.",
        action=None,
        variable=inputString,
    )

As you see, if the input being passed does not required any preparation, the action can be defined as None.

Regular blocks
--------------

Here is an example of a :bdg-secondary-line:`PluginBlock` that simply prints the given input and sets it as its output:

.. image:: images/action_block.png
    :align: center
    :width: 300
    :alt: Block that prints the input variable

.. code-block:: python

    from HorusAPI import PluginVariable, PluginBlock, VariableTypes

    # First define the variable to be used as input in the block
    inputVariable = PluginVariable(
        name="Input",
        id="inputID",
        description="A variable to be used as an input.",
        type=VariableTypes.ANY,
    )

    # Define also the output variable
    outputVariable = PluginVariable(
        name="Output variable",
        id="outputID",
        description="The same variable as the input.",
        type=VariableTypes.ANY,
    )

    # Then define the action that the block will perform
    def myCustomAction(block: PluginBlock):

        # The block passed to the function contains an updated dictionary of the variables
        # acces it using the variable id
        inputValue = block.inputs["inputID"]

        print(inputValue)

        block.setOutput("outputID", inputValue)

    # Finally, instantiate the block giving it a name, a description, the action to be performed and the variable.
    printVariableBlock = PluginBlock(
        name="Print variable",
        description="Prints a given variable.",
        action=myCustomAction,
        inputs=[inputVariable],
        outputs=[outputVariable],
    )

Slurm blocks
------------

Here is an example of a :bdg-secondary-line:`SlurmBlock` that uploads a file to a remote server before the job is sent to the Slurm queue
and downloads the result after the job is finished:

.. image:: images/slurm_block.png
    :align: center
    :width: 300
    :alt: Block that sends a job to a cluster and downloads the results

.. code-block:: python

    from HorusAPI import PluginVariable, SlurmBlock, VariableTypes

    # First define the input to be used in the block
    inputFile = PluginVariable(
        name="File",
        id="fileID",
        description="A file to upload to a remote server.",
        type=VariableTypes.FILE,
    )

    # Then define the output to be used in the block
    outputFile = PluginVariable(
        name="Output file",
        id="outputFile",
        description="The file downloaded from the remote server after the job is finished.",
        type=VariableTypes.FILE,
    )

    # You can also define a regular variable, which is independent of the inputs.
    # This variable will be available in the block configuration button.
    regularVariable = PluginVariable(
        name="Regular variable",
        id="regularVariable",
        description="A regular variable.",
        type=VariableTypes.STRING,
    )


    # Then define the action that the block will perform before the job is sent to the Slurm queue
    def myCustomActionBefore(block: SlurmBlock):
        # The block passed to the function contains an updated dictionary of the variables
        # acces it using the variable id either for the regular variables or the inputs.

        regularVariableValue = block.variables["regularVariable"]
        inputFilePath = block.inputs["fileID"]

        print("Regular variable value: ", regularVariableValue)

        # Upload the file to the remote server using the RemoteAPI
        block.remote.sendData(inputFilePath, "/path/in/remote/server")

        jobID = block.remote.submitJob("/path/in/remote/server")

        print("Job submitted with ID: ", jobID)


    # Then define the action that the block will perform after the job is finished
    def myCustomActionAfter(block: SlurmBlock):
        print("Job finished, downloading results...")

        # Download the results from the remote server using the RemoteAPI
        block.remote.getData("/path/in/remote/server", "/path/in/local/machine")

        # Set the output variable to the path of the downloaded file
        block.setOutput("outputFile", "/path/in/local/machine")


    # Finally, instantiate the block giving it a name, a description, the action to be performed and the variable.
    sendJobBlock = SlurmBlock(
        name="Send a job",
        description="Submits a job to the remote and downloads the results",
        initialAction=myCustomActionBefore,
        finalAction=myCustomActionAfter,
        variables=[regularVariable],
        inputs=[inputFile],
        outputs=[outputFile],
    )

Adding Blocks to a Plugin
=========================

Once you have defined several :bdg-secondary-line:`Block`, you can add them to your :bdg-secondary-line:`Plugin` using the
.addBlock() method:

.. code-block:: python

    plugin.addBlock(myBlock)

Configurations
==============

You can add permanent variables to :bdg-secondary-line:`Block`. These variables are available for
modification under the Plugin configuration button and once defined, will have the same value on every run. 

The :bdg-secondary-line:`PluginConfig` class 
is just a subclass of :bdg-secondary-line:`PluginBlock`, so you can define also an action which
will be executed every time the configuration is modified. This can be used for configuration validation.

Instantiate the :bdg-secondary-line:`PluginConfig` and then add it to the :bdg-secondary-line:`Plugin` instance using the
.addConfig() method.

.. code-block:: python

    plugin.addConfig(myConfig)

Then, the config can be accessed like the variables in the :bdg-secondary-line:`Block`'s action:

.. code-block:: python

    myConfigValue = block.config["myConfigID"]

Storing data on blocks or flow
==============================

Sometimes it is useful to store persistent data on a block or on the flow itself. For example, one could store the times
the block has run, or a variable that is needed in the :bdg-secondary-line:`finalAction` of a :bdg-secondary-line:`SlurmBlock`, which is defined in the :bdg-secondary-line:`initialAction`.
:bdg-secondary-line:`extraData` is a property of Blocks (a dictionary where to store key:value pairs) that allows developers to store variables across runs of the same block. The same applies
for the :bdg-secondary-line:`extraData` of a given flow.

.. warning::

    The :bdg-secondary-line:`extraData` property of a given block never gets automatically resetted, 
    it is up to the developer of the block when to remove/overwrite the stored variables. 

.. code-block:: python

    # Extra data of the given block
    block.extraData["value_to_store"] = "myValue"

    # Extra data of the flow. Not to be confused with the block.extraData property!
    block.flow.extraData["my_key"] = "my_value"

Verifying if the flow was reset
===============================

The ``block.dirty`` property is a boolean flag that indicates whether a block is being re-executed within a flow. 
It will be ``False`` when the block runs for the first time or after the flow has been manually reset by the user. 
In all subsequent executions without a reset, ``block.dirty`` will be ``True``.

This property can be particularly useful when managing persistent data stored in :bdg-secondary-line:`extraData`, 
as it allows the developer to distinguish between fresh executions and re-runs. For instance, if certain variables 
in :bdg-secondary-line:`extraData` should be cleared or reset upon a flow restart, you can use ``block.dirty`` to trigger this reset manually.

.. code-block:: python

    if block.dirty:
        print("This block has been run multiple times without a reset...")
    else:
        # Reset persistent data in extraData if the flow was reset
        block.extraData.clear()
        print("Running the block for the first time or after reset!")

This way, the developer can manage the lifecycle of :bdg-secondary-line:`extraData` values, ensuring they are 
cleared or modified only when necessary, while maintaining persistence across non-reset runs.

Accessing the flow inside the block
===================================

The :bdg-secondary-line:`Block` has access to the instance of the :bdg-secondary-line:`Flow` it is being executed in.
This can be useful to access the list of blocks in the flow, the flow name, the flow ID or other
properties. The flow instance can be obtained using the :bdg-secondary-line:`block.flow` property.

Creating a unique folder for the block
======================================

Blocks in Horus are often executed multiple times, and it's essential to isolate each
execution's data to avoid overwriting results. This is handled using unique directories
that are automatically generated for each run. The logic for this mechanism is encapsulated
in the :bdg-secondary-line:`unique_block_dir_local` and :bdg-secondary-line:`unique_block_dir_remote` 
properties of the block.

Both properties ensure that each execution of a block gets its own dedicated directory with the 
same unique name, but located in different parent directories: one on the local machine and 
one on the remote execution environment. The unique name is generated using a combination of 
the block's internal ID and placement ID, avoiding naming collisions and ensuring safe, 
traceable data storage across multiple runs.

If you wish to persist the unique block directory paths across executions, you should save the values
into the :bdg-secondary-line:`block.extraData` attribute.

Example
-------

Here's an example of using the unique block directory to store a copy of an input file:

.. code-block:: python

   def my_block_action(block: PluginBlock):
       input_file = block.inputs.get("input_data")
       
       # Use appropriate path based on execution context
       if block.remote.isLocal:
           unique_dir = block.unique_block_dir_local
       else:
           unique_dir = block.unique_block_dir_remote
       
       # Copy data to the unique directory
       block.remote.sendData(input_file, unique_dir)