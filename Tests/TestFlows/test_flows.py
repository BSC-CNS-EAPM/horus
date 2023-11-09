"""
Test file for Flows
"""

import os
import json

import pytest
import datetime

from Server.FlowManager.flow_manager import Flow, FlowManager
from HorusAPI import PluginBlock as Block, SlurmBlock
from Server.PluginManager.plugin_manager import PluginManager


@pytest.fixture
def plugin_manager():
    """
    Initiate a dummy plugin manager
    """
    return PluginManager("AppSupport", False)


@pytest.fixture
def flow_manager(plugin_manager):
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
def flow(flow_data):
    return Flow(flow_data)


def test_flow_properties(flow: Flow):
    assert flow.name == "Test Flow"
    assert flow.savedID == "1234"
    assert flow.path == "/path/to/flow.flow"
    assert flow.remote == "Local"
    assert flow.currentExecuting == 1
    assert flow.status == Flow.FlowStatus.RUNNING
    assert flow.date == "2022-01-01 12:00:00"
    assert flow.molstarState == {}
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
    assert encoded_flow["molstarState"] == {}
    assert encoded_flow["terminalOutput"] == ["Test output"]
    assert len(encoded_flow["blocks"]) == 1
    assert encoded_flow["blocks"][0]["id"] == "horus.string"
    assert encoded_flow["blocks"][0]["connectedTo"] == []
    assert encoded_flow["blocks"][0]["connectedToReference"] == []
    assert encoded_flow["blocks"][0]["placedID"] == 1


def test_flow_write(tmpdir, flow: Flow):
    flow.path = os.path.join(tmpdir, "test_flow.flow")
    encoded_flow = flow.write()
    assert os.path.exists(flow.path)
    with open(flow.path, "r") as f:
        saved_flow = json.load(f)

    print(saved_flow)
    print(encoded_flow)
    assert saved_flow == encoded_flow


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
    assert read_flow.molstarState == {}
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


def test_flow_run():
    path = os.path.join(os.path.dirname(__file__), "test_flow.flow")

    flow = Flow.read(path)

    flow.run(placedID=1)

    # Check that the flow has been updated
    assert flow.status == Flow.FlowStatus.FINISHED

    # Re-read the flow and check everything is saved
    encoded_flow = flow.encode()

    read_flow = Flow.read(path).encode()

    assert read_flow == encoded_flow
