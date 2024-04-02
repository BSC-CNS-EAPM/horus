"""
Test file for Flows
"""

import os
import json

import pytest

from Server.FlowManager.flow_manager import Flow, FlowManager
from Server.PluginManager.plugin_manager import PluginManager
from HorusAPI import PluginBlock as Block
from App import AppDelegate


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
        "savedID": "1234",
        "path": "/path/to/flow.flow",
        "remote": "Local",
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
                "connectedTo": [],
                "connectedToReferences": [],
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
    assert flow.savedID == "1234"
    assert flow.path == "/path/to/flow.flow"
    assert flow.remote == "Local"
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
    assert flow.blocks[0]._connectedTo == []
    assert flow.blocks[0]._connectedToReferences == []
    assert flow.blocks[0]._placedID == 1


def test_flow_encode(flow: Flow):
    encoded_flow = flow.encode()
    assert encoded_flow["name"] == "Test Flow"
    assert encoded_flow["savedID"] == "1234"
    assert encoded_flow["path"] == "/path/to/flow.flow"
    assert encoded_flow["remote"] == "Local"
    assert encoded_flow["currentExecuting"] == 1
    assert encoded_flow["status"] == "RUNNING"
    assert encoded_flow["date"] == "2022-01-01 12:00:00"
    assert encoded_flow["terminalOutput"] == ["Test output"]
    assert len(encoded_flow["blocks"]) == 1
    assert encoded_flow["blocks"][0]["id"] == "horus.string"
    assert encoded_flow["blocks"][0]["connectedTo"] == []
    assert encoded_flow["blocks"][0]["connectedToReference"] == []
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
    with open(flow_path, "w") as f:
        json.dump(flow_data, f)
    read_flow = Flow.read(flow_path)
    assert read_flow.name == "Test Flow"
    assert read_flow.savedID == "1234"
    assert read_flow.remote == "Local"
    assert read_flow.currentExecuting == 1
    assert read_flow.status == Flow.FlowStatus.RUNNING
    assert read_flow.date == "2022-01-01 12:00:00"
    assert read_flow.terminalOutput == ["Test output"]
    assert len(read_flow.blocks) == 1
    assert isinstance(read_flow.blocks[0], Block)
    assert read_flow.blocks[0].id == "horus.string"
    assert read_flow.blocks[0].inputs == {"string": None}
    assert read_flow.blocks[0].outputs == {"string": None}
    assert read_flow.blocks[0]._connectedTo == []
    assert read_flow.blocks[0]._connectedToReferences == []
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

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Re-read the flow and check everything is saved
        encoded_flow = flow.encode()

        read_flow = Flow.read(path).encode()

        assert read_flow == encoded_flow
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

        read_flow = Flow.read(path).encode()

        assert read_flow == encoded_flow
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

        assert action["type"] == "addPDB"
    finally:
        # Restore the flow by copying the .bak file to the original file
        os.system(f"mv {path}.bak {path}")


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
        assert extension1["title"] == "Results"
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


def test_molview_flow(flow_appDelegate):
    path = os.path.join(os.path.dirname(__file__), "molview.flow")

    # Save a backup of the clean flow
    os.system(f"cp {path} {path}.bak")

    flow = Flow.read(path)

    try:
        flow.run(placedID=1)

        # Check that the flow has been updated
        assert flow.status == Flow.FlowStatus.FINISHED

        # Verify that all blocks are marked as finished
        for block in flow.blocks:
            assert block._finishedExecution

        # Check that it has 6 molstar pending actions (is the ones present in the dev_plugin molviewSpecBlock)
        assert len(flow.pendingActions) == 6
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
