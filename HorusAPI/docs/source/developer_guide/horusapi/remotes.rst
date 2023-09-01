*********
RemoteAPI
*********

In order to manage the remote to which the user is connected to, you can use, withing the :bdg-secondary-line:`Block` execution, the :bdg-secondary-line:`RemoteAPI`.
The API is automatically instantiated and assigned to the current running block. Therefore, within the :bdg-secondary-line:`Block` action function,
you can access it under 'block.remote'.

.. code-block:: python

    def mySlurmBlockInitialAction(block: SlurmBlock):
        
        # Access the remote using block.remote
        block.remote.remoteCommand('ls -l')

        block.remote.sendData('myFile.txt', 'my/Destination/path/in/remote.txt')


The :bdg-secondary-line:`RemoteAPI` methods can be found in the :ref:`api-reference` section.
