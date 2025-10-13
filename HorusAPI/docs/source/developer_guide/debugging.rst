.. _debugpy:

*****************
Debugging Plugins
*****************

Horus provides comprehensive debugging capabilities for plugin development through the integration of ``debugpy``, a Python debugging adapter that enables step-by-step debugging, breakpoint management, and variable inspection directly from your IDE.

What is debugpy?
================

``debugpy`` is the official Python debugging adapter implementation for the Debug Adapter Protocol (DAP). It allows you to attach debuggers from various IDEs (such as VS Code, PyCharm, and others) to running Python processes. This enables:

- Setting breakpoints in your plugin code
- Step-by-step execution through your code
- Inspection of variables and their values
- Call stack analysis
- Real-time code evaluation

Enabling Plugin Debugging
==========================

To enable debugging for your plugins, you have two options:

Command Line Option
-------------------

Use the ``--debug-plugins`` or ``-dp`` flag when starting Horus:

.. code-block:: bash

    # Enable debugging
    horus -dp

Environment Variable
--------------------

Set the ``HORUS_DEBUG_PLUGINS`` environment variable:

.. code-block:: bash

    export HORUS_DEBUG_PLUGINS=1
    horus

Debug Ports
===========

Horus uses different ports for different debugging scenarios:

- **Plugin Initialization and Extensions**: Port 5678 (configurable via ``HORUS_DEBUGPY_PORT``)
- **Flow Execution**: Port 5679 (configurable via ``HORUS_DEBUGPY_FLOW_PORT``)

You can customize these ports using environment variables:

.. code-block:: bash

    export HORUS_DEBUGPY_PORT=9001
    export HORUS_DEBUGPY_FLOW_PORT=9002

VS Code Configuration
=====================

To debug plugins using Visual Studio Code, you'll need to create appropriate launch configurations.

Launch Configuration (.vscode/launch.json)
-------------------------------------------

Create or modify your ``.vscode/launch.json`` file with the following configurations. 
This will configure the debugger to attach to the Horus process for both plugin initialization and flow execution.
Keep in mind that this is just an example; you may need to adjust paths and settings based on your specific setup.

.. code-block:: json

    {
      "version": "0.2.0",
      "configurations": [
        {
          "name": "Debug Plugin & Extensions",
          "type": "debugpy",
          "request": "attach",
          "connect": {
            "host": "localhost",
            "port": 5678
          }
        },
        {
          "name": "Debug Flow",
          "type": "debugpy",
          "request": "attach",
          "connect": {
            "host": "localhost",
            "port": 5679
          },
        }
      ]
    }

Debugging Procedure
===================

Plugin debugging in Horus involves two distinct scenarios, each requiring different approaches:

Debugging Plugin Initialization and Extensions
-----------------------------------------------

This method is used to debug:
- Main Horus application
- Plugin loading and initialization code
- Extension views and endpoints

**Steps:**

1. **Set up your VS Code configuration** with the appropriate paths for your plugin
2. **Set breakpoints** in your plugin's initialization code
3. **Start Horus in plugin-debug mode** using: ``horus -dp``
4. **Wait for the debug message**: "Waiting for debugger to attach to port 5678..."
5. **Launch the debugger** from VS Code using the "Debug Plugin & Extensions" configuration
6. **Load or interact with the Extensions** in Horus to trigger the breakpoints

Debugging Block Execution (Flows)
----------------------------------

This method is used to debug:
- Plugin initialization (as its needed to load the blocks)
- Block execution logic
- Data processing within blocks
- Flow runtime behavior

**Steps:**

1. **Set up your VS Code configuration** with the appropriate paths for your plugin
2. **Set breakpoints** in your block's actions
3. **Start Horus in plugin-debug mode** using: ``horus -dp``
4. **Create a flow** in Horus and place blocks from your plugin
5. **Execute the flow** - this will spawn a separate debug process
6. **Wait for the flow debug message**: "Waiting for debugger to attach to port 5679..."
7. **Launch the flow debugger** from VS Code using the "Debug Flow" configuration
8. **Step through your block execution** as the flow runs
