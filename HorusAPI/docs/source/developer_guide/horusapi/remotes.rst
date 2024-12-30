*********
RemoteAPI
*********

In order to manage the remote to which the user is connected to, you can use, within the :bdg-secondary-line:`Block` execution, the :bdg-secondary-line:`RemoteAPI`.
The API is automatically instantiated and assigned to the current running block. Therefore, within the :bdg-secondary-line:`Block` action function,
you can access it under 'block.remote'.

.. code-block:: python

    def mySlurmBlockInitialAction(block: SlurmBlock):
        
        # Access the remote using block.remote
        remoteName = block.remote.name
        remoteHost = block.remote.host
        remoteWorkDir = block.remote.workDir

        # Execute commands in the remote or locally using the command method
        block.remote.command('ls -l')

        # Send files to the remote using the sendData method
        remoteUploadedPath = block.remote.sendData('myFile.txt', 'my/Destination/path/in/remote.txt')

        # Transfer back the files using the getData method
        finalDownloadedPath = block.remote.getData('my/Destination/path/in/remote.txt', 'myFile.txt')

        # Change the remote working directory using the cd context manager
        with block.remote.cd('my/remote/path'):
            output = block.remote.command('ls -l')
            print ("Output of ls -l in my/remote/path: ", output)

        # Submit Slurm jobs using the submitJob method
        jobID = block.remote.submitJob('path/to/slurm/script.sh')

Executing commands
==================

As seen in the above section. one can use the RemoteAPI to execute commands in the remote or in the local machine. Horus will
automatically send the commands based on the selected remote from the block. In order to override this behaviour and send
commands locally even though a remote is selected, set the forceLocal argument to true.

.. code-block:: python

    # Creates the folder in the remote
    block.remote.command("mkdir myFolder")

    # Creates the folder on the local machine
    block.remote.command("mkdir myFolder", forceLocal=True)

Methods
=======

The :bdg-secondary-line:`RemoteAPI` methods can be found in the :ref:`api-reference` section.
