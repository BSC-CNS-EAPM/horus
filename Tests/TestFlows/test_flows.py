"""
Test file for Flows
"""

import os
import json
from typing import cast
import requests
import random
import pytest
import time
from multiprocess import Process  # type: ignore pylint: disable=no-name-in-module
import subprocess

from HorusAPI.src.plugins import SlurmBlock, Status
from Server.FlowManager.flow_manager import Flow, FlowManager
from Server.PluginManager.plugin_manager import PluginManager
from HorusAPI import PluginBlock as Block
from App import AppDelegate

from unittest.mock import patch


@pytest.fixture
def flow_appDelegate():
    """
    Initiate a dummy AppDelegate
    """
    return AppDelegate()


@pytest.fixture
def plugin_manager(flow_appDelegate):
    """
    Initiate a dummy plugin manager
    """
    return PluginManager("AppSupport")


@pytest.fixture
def flow_manager(flow_appDelegate, plugin_manager):
    """
    Initiate a dummy flow manager
    """
    return FlowManager("AppSupport")


@pytest.fixture
def flow_data():
    """
    Dummy flow data in JSON format
    """
    return {
        "name": "Test Flow",
        "path": "/path/to/flow.flow",
        "currentExecuting": 1,
        "status": "RUNNING",
        "date": "2022-01-01 12:00:00",
        "blocks": [
            {
                "id": "horus.string",
                "name": "Test Block",
                "inputs": {},
                "outputs": {},
                "internalVariables": {},
                "placedID": 1,
            }
        ],
        "molstarState": {},
        "terminalOutput": ["Test output"],
    }


@pytest.fixture
def flow(flow_data, plugin_manager):
    return Flow(flow_data)


def test_flow_properties(flow: Flow):
    assert flow.name == "Test Flow"
    assert flow.path == "/path/to/flow.flow"
    assert flow.currentExecuting == 1
    assert flow.status == Flow.FlowStatus.RUNNING
    assert flow.date == "2022-01-01 12:00:00"
    assert flow.terminalOutput == ["Test output"]


def test_flow_blocks(flow: Flow):
    assert len(flow.blocks) == 1
    assert isinstance(flow.blocks[0], Block)
    assert flow.blocks[0].id == "horus.string"
    assert flow.blocks[0].name == "String"
    assert flow.blocks[0].inputs == {"string": None}
    assert flow.blocks[0].outputs == {"string": None}
    assert flow.blocks[0]._placedID == 1


def test_flow_encode(flow: Flow):
    encoded_flow = flow.encode()
    assert encoded_flow["name"] == "Test Flow"
    assert encoded_flow["path"] == "/path/to/flow.flow"
    assert encoded_flow["currentExecuting"] == 1
    assert encoded_flow["status"] == "RUNNING"
    assert encoded_flow["date"] == "2022-01-01 12:00:00"
    assert encoded_flow["terminalOutput"] == ["Test output"]
    assert len(encoded_flow["blocks"]) == 1
    assert encoded_flow["blocks"][0]["id"] == "horus.string"
    assert encoded_flow["blocks"][0]["placedID"] == 1


def test_flow_write(tmpdir, flow: Flow):
    flow.path = os.path.join(tmpdir, "test_flow.flow")

    # Backup the flow
    os.system(f"cp {flow.path} {flow.path}.bak")

    try:
        encoded_flow = flow.write()
        assert os.path.exists(flow.path)

        # Read the saved flow
        saved_flow = Flow.read(flow.path)

        assert saved_flow.encode() == encoded_flow
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {flow.path}.bak {flow.path}")


def test_flow_read(tmpdir, flow_data):
    flow_path = os.path.join(tmpdir, "test_flow.flow")
    flow = Flow(flow_data)
    flow.path = flow_path

    flow.write()

    read_flow = Flow.read(flow_path)
    assert read_flow.name == "Test Flow"
    assert read_flow.currentExecuting == 1
    assert read_flow.status == Flow.FlowStatus.RUNNING
    assert read_flow.date == "2022-01-01 12:00:00"
    assert read_flow.terminalOutput == ["Test output"]
    assert len(read_flow.blocks) == 1
    assert isinstance(read_flow.blocks[0], Block)
    assert read_flow.blocks[0].id == "horus.string"
    assert read_flow.blocks[0].inputs == {"string": None}
    assert read_flow.blocks[0].outputs == {"string": None}
    assert read_flow.blocks[0]._placedID == 1


def test_flow_find_block_by_id(flow: Flow):
    block = flow.findBlockByID("horus.string")
    assert isinstance(block, Block)
    assert block.id == "horus.string"
    with pytest.raises(Exception):
        flow.findBlockByID("non_existent_block")


def test_flow_find_block_by_placed_id(flow: Flow):
    block = flow.findBlockByPlacedID(1)
    assert isinstance(block, Block)
    assert block._placedID == 1
    with pytest.raises(Exception):
        flow.findBlockByPlacedID(2)


def test_flow_run(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)
        flow.run(placedID=1)
        encoded_flow = flow.encode()

        # Re-instantiate the flow, run again, and verify that the workflow is reproducible
        read_flow = Flow.read(path)
        read_flow.run(placedID=1, resetFlow=True)
        read_flow_encoded = read_flow.encode()

        # Compare only reproducible fields for flow
        for i in range(len(read_flow_encoded["blocks"])):
            block_read = read_flow_encoded["blocks"][i]
            block_flow = encoded_flow["blocks"][i]

            # Assert reproducible fields
            assert block_read["id"] == block_flow["id"]
            assert block_read["name"] == block_flow["name"]
            assert block_read["inputs"] == block_flow["inputs"]
            assert block_read["outputs"] == block_flow["outputs"]
            assert block_read["variables"] == block_flow["variables"]
            assert block_read["blockLogs"] == block_flow["blockLogs"]

        assert encoded_flow["terminalOutput"] == read_flow_encoded["terminalOutput"]

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_double_circular_flow_run(flow_appDelegate, capfd):
    path = os.path.join(os.path.dirname(__file__), "test_flow_double_circular.flow")

    # Create a backup of the flow by copying the file to a .bak file
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=6)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution

        # Split the output by line and remove the last empty line
        splitted_out = flow.terminalOutput

        parsedOutput = []
        for split in splitted_out:
            if split == "\n":
                continue
            parsedOutput.append(split)

        assert len(parsedOutput) == 5

        # Verify that the output is correct
        assert parsedOutput[0] == "Received variable: 13"
        assert parsedOutput[1] == "Received variable: 17"
        assert parsedOutput[2] == "Received variable: 13"
        assert parsedOutput[3] == "Received variable: 12"
        assert parsedOutput[4] == "Received variable: 33"

        # Verify that all the cycles count are equal to the cycles
        for block in flow.blocks:
            for conn in block._variableConnections:
                if conn.isCyclic:
                    assert conn.currentCycle == conn.cycles

        # Re-read the flow and check everything is saved
        encoded_flow = flow.encode()

        read_flow = Flow.read(path)
        read_flow.run(placedID=6, resetFlow=True)
        read_flow_encoded = read_flow.encode()

        # Check only reproducible fields for flow
        for i in range(len(read_flow_encoded["blocks"])):
            block_read = read_flow_encoded["blocks"][i]
            block_flow = encoded_flow["blocks"][i]

            # Assert reproducible fields
            assert block_read["id"] == block_flow["id"]
            assert block_read["name"] == block_flow["name"]
            assert block_read["inputs"] == block_flow["inputs"]
            assert block_read["outputs"] == block_flow["outputs"]
            assert block_read["variables"] == block_flow["variables"]
            assert block_read["blockLogs"] == block_flow["blockLogs"]

        assert read_flow_encoded["terminalOutput"] == encoded_flow["terminalOutput"]
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_flow_terminal_output_storage(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=1)

        # Check that the terminal output is correct
        assert flow.terminalOutput is not None

        # Prints to the terminal 2 times, but between it adds a new line "\n"
        assert len(flow.terminalOutput) == 4

        assert flow.terminalOutput[0] == "Received variable: test"
        assert flow.terminalOutput[1] == "\n"
        assert flow.terminalOutput[2] == "Received variable: test"
        assert flow.terminalOutput[3] == "\n"
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_background_molstar_api(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "molstarapi_background.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=1)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that it has pending actions
        assert flow.pendingActions is not None
        assert len(flow.pendingActions) == 1

        # Verify that the pending action is "addPDB"
        action = flow.pendingActions[0]

        assert action["type"] == "addMolecule"
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_flow_smiles_manager(plugin_manager):
    path = os.path.join(os.path.dirname(__file__), "test_flow_smiles_manager.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=1)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that the pending smiles actions are there
        assert len(flow.pendingSmilesActions) == 5

        # Verify that the first action is the reset one
        assert flow.pendingSmilesActions[0]["type"] == "reset"

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")

        # Remove the smiles.csv file produced by the test
        smilescsv = os.path.join(os.path.dirname(__file__), "smiles.csv")
        os.system(f"rm {smilescsv}")


def test_extensions_on_blocks(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "open_extension_test.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=1)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution

        # Check that the block has extensions to be opened
        extOpen = flow.blocks[0]._extensionsToOpen

        # This test block adds 2 extensions to be opened
        assert len(extOpen) == 2

        extension1 = extOpen[0]

        assert extension1["data"] is not None
        assert extension1["url"] is not None
        assert extension1["name"] == "Results"
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_no_inputs_block(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "no_inputs_test.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)
        flow.run(placedID=2)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_extra_data_block(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "extra_data_test.flow")

    # Save a backup of the clean flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=1)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution

        assert flow.terminalOutput is not None

        # The first run, it should print (Runs: 1)
        assert flow.terminalOutput[0] == "Runs: 1"

        flow.run(placedID=1, resetFlow=False)

        # The second run, it should print (Runs: 2)
        assert flow.terminalOutput[2] == "Runs: 2"
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_flow_inside_block(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "Flow_inside_block.flow")

    # Save a backup of the clean flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.run(placedID=1)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution

        assert flow.terminalOutput is not None

        # The first run, it should print the savedID of the flow
        assert flow.terminalOutput[0] == flow.savedID
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_slurm_flow_second_action(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "Slurm_test.flow")

    dir_flow = os.path.dirname(path)

    # Save a backup of the clean flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        # Set the block 1 to be completed, due to compatibility issues when the code has been updated
        b = cast(SlurmBlock, flow.findBlockByPlacedID(1))
        b.status = Status.COMPLETED

        flow.terminalOutput = []

        flow.run(resetFlow=False)

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution

        assert flow.terminalOutput is not None

        # The first run, it should print the savedID of the flow
        assert flow.terminalOutput[0] == "Test slurm block final action"

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

    finally:
        # Remove the test.sh file
        try:
            os.remove(os.path.join(dir_flow, "test.sh"))
        except:
            pass

        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_flow_elapsed_time():
    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        initial_started_time = flow.startedTime
        initial_finished_time = flow.finishedTime
        initial_elapsed = flow.elapsed

        flow.run(placedID=1)

        assert initial_started_time != flow.startedTime
        assert initial_finished_time != flow.finishedTime
        assert initial_elapsed != flow.elapsed

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_flow_elapsed_time_stop():
    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        initial_started_time = flow.startedTime
        initial_finished_time = flow.finishedTime
        initial_elapsed = flow.elapsed

        flow.run(placedID=1)
        flow.stop()

        assert initial_started_time != flow.startedTime
        assert initial_finished_time != flow.finishedTime
        assert initial_elapsed != flow.elapsed

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_block_plugin_dir_inside_action(plugin_manager):
    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        # Get the first block of the flow
        block1 = flow.blocks[0]

        flow.run(placedID=1)
        flow.stop()

        # Verify that the block has been updated with the plugin dir during the execution
        assert hasattr(block1, "pluginDir")
        assert block1.pluginDir is not None
        assert block1.pluginDir == os.path.abspath("AppSupport/DefaultPlugins/Horus")

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


# Cannot use these tests as the flow needs to access the Server's plugin manager
# and it is only available after the server has started
# def test_json_code_flow(plugin_manager):
#     path = os.path.join(os.path.dirname(__file__), "code_variable.flow")

#     # Backup the flow
#     os.system(f"cp {path} {path}.bak")

#     try:
#         flow = Flow.read(path)

#         for b in flow.blocks:
#             b._cleanRun()

#         flow.terminalOutput = []

#         flow.run(placedID=2)

#         print(flow.terminalOutput)

#         supposedOutput = "Received variable: {'json': 'json', 'json3': {'json2': 'json2'}}"

#         # Check that the output is correct
#         assert flow.terminalOutput[0] == supposedOutput

#     finally:
#         # Restore the flow by copying the .bak file to the original file
#         os.system(f"mv {path}.bak {path}")


# def test_python_code_flow(plugin_manager):
#     path = os.path.join(os.path.dirname(__file__), "code_variable.flow")

#     # Backup the flow
#     os.system(f"cp {path} {path}.bak")

#     try:
#         flow = Flow.read(path)

#         for b in flow.blocks:
#             b._cleanRun()

#         flow.terminalOutput = []

#         flow.run(placedID=5)

#         # Check that the output is correct
#         assert (
#             flow.terminalOutput[0]
#             == "this is a new code variable! We can execute python from here"
#         )
#         assert flow.terminalOutput[2] == "Received variable: 190"

#     finally:
#         # Restore the flow by copying the .bak file to the original file
#         os.system(f"mv {path}.bak {path}")


# def test_block_variable_merger(plugin_manager):
#     path = os.path.join(os.path.dirname(__file__), "code_variable.flow")

#     # Backup the flow
#     os.system(f"cp {path} {path}.bak")

#     try:
#         flow = Flow.read(path)

#         for b in flow.blocks:
#             b._cleanRun()

#         flow.terminalOutput = []

#         flow.run(placedID=12)

#         # Check that the output is correct
#         assert flow.terminalOutput[0] == "Received variable: ['1', '2', '3', '4']"

#     finally:
#         # Restore the flow by copying the .bak file to the original file
#         os.system(f"mv {path}.bak {path}")


# Test a flow run by sending a post request to a server
def test_flow_run_flow_post_full_app(plugin_manager):

    port = str(random.randint(3000, 9000))

    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    # Must be in app / browser mode in order to test the multiprocessing component of flows
    p = subprocess.Popen(
        ["python", "Horus.py", "--host", "localhost", "--port", port],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Wait for the server to start
    time.sleep(5)

    baseURL = f"http://localhost:{port}"

    # Check that the server is running
    try:

        flow = Flow.read(path)

        originalTime = str(flow.startedTime)

        # Send a request to the server
        response = requests.post(
            baseURL + "/api/plugins/executeflow",
            json={
                "flowPath": path,
                "placedID": 2,
                "resetFlow": False,
            },
            timeout=10,
        )

        if response.status_code != 200:
            pytest.fail("Request failed with status code: " + str(response.status_code))

        # Wait for the flow to finish
        time.sleep(1)
        flowTries = 0
        while flowTries < 5:
            flow = Flow.read(path)

            if flow.isActive:
                flowTries += 1
                time.sleep(1)
            else:
                break

        # If the flow is queued, means that there was
        # an error spawning the process of the flow and that the flow could not run
        # (recurrent macOS error)
        if flow.status == flow.FlowStatus.QUEUED:
            pytest.fail(
                "Flow was QUEUED and did not run. Verify that Horus can spawn correctly the processes of flows."
            )

        # Verify that the request was correctly processed and that
        # the flow actually was set to be executed
        assert str(flow.startedTime) != originalTime

        # Verify that the flow is finished
        assert flow.status == flow.FlowStatus.FINISHED

    except requests.exceptions.ConnectionError:

        if p.stdout:
            output = p.stdout.read()

            if "Failed to start the window management system." in output:
                import warnings

                warnings.warn("Please test this function in a Windowed computer")

                # Pass the pytest
                return

        pytest.fail("Connection error")
    finally:
        # Kill the process
        p.kill()

        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_dirty_block(plugin_manager):
    path = os.path.join(os.path.dirname(__file__), "dirty.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.reset()

        # Check that the output is correct
        blockToRun = flow.findBlockByPlacedID(1)

        assert blockToRun.dirty == False

        flow.run(placedID=1, resetFlow=True)  # Default

        assert blockToRun.dirty == True

        # Run again without reset
        flow.run(placedID=1, resetFlow=False)

        assert flow.terminalOutput[6] == "True"

        # Run with reset
        flow.run(placedID=1, resetFlow=True)

        assert flow.terminalOutput[2] == "False"

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


def test_command_timeout(plugin_manager):
    path = os.path.join(os.path.dirname(__file__), "Timeout_test.flow")

    # Backup the flow
    os.system(f"cp {path} {path}.bak")

    try:
        flow = Flow.read(path)

        flow.reset()

        # Run the flow
        flow.run(placedID=1, resetFlow=True)

        # Assert that the flow runned nicely
        assert flow.status == flow.FlowStatus.FINISHED

        # Run again without reset, the second time, the timeout is changed
        flow.run(placedID=1, resetFlow=False)

        # Assert that the flow failed due to the timeout
        assert flow.status == flow.FlowStatus.ERROR

    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")
