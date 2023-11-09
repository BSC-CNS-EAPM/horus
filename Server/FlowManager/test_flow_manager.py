import pytest
import os
import json
import datetime

from Server.FlowManager.flow_manager import Flow
from Server.BlockManager.block_manager import Block
from Server.PluginManager.plugin_manager import PluginManager


@pytest.fixture
def plugin_manager():
    return PluginManager()


@pytest.fixture
def flow_data():
    return {
        "name": "Test Flow",
        "savedID": "1234",
        "path": "/path/to/flow.json",
        "remote": "test_remote",
        "currentExecuting": 1,
        "status": "RUNNING",
        "date": "2022-01-01 12:00:00",
        "blocks": [
            {
                "id": "test_block",
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


def test_flow_properties(flow):
    assert flow.name == "Test Flow"
    assert flow.savedID == "1234"
    assert flow.path == "/path/to/flow.json"
    assert flow.remote == "test_remote"
    assert flow.currentExecuting == 1
    assert flow.status == Flow.FlowStatus.RUNNING
    assert flow.date == "2022-01-01 12:00:00"
    assert flow.molstarState == {}
    assert flow.terminalOutput == ["Test output"]


def test_flow_blocks(flow):
    assert len(flow.blocks) == 1
    assert isinstance(flow.blocks[0], Block)
    assert flow.blocks[0].id == "test_block"
    assert flow.blocks[0].name == "Test Block"
    assert flow.blocks[0].inputs == {}
    assert flow.blocks[0].outputs == {}
    assert flow.blocks[0].internalVariables == {}
    assert flow.blocks[0].connectedTo == []
    assert flow.blocks[0].connectedToReferences == []
    assert flow.blocks[0].placedID == 1


def test_flow_encode(flow):
    encoded_flow = flow.encode()
    assert encoded_flow["name"] == "Test Flow"
    assert encoded_flow["savedID"] == "1234"
    assert encoded_flow["path"] == "/path/to/flow.json"
    assert encoded_flow["remote"] == "test_remote"
    assert encoded_flow["currentExecuting"] == 1
    assert encoded_flow["status"] == "RUNNING"
    assert encoded_flow["date"] == "2022-01-01 12:00:00"
    assert encoded_flow["molstarState"] == {}
    assert encoded_flow["terminalOutput"] == ["Test output"]
    assert len(encoded_flow["blocks"]) == 1
    assert encoded_flow["blocks"][0]["id"] == "test_block"
    assert encoded_flow["blocks"][0]["name"] == "Test Block"
    assert encoded_flow["blocks"][0]["inputs"] == {}
    assert encoded_flow["blocks"][0]["outputs"] == {}
    assert encoded_flow["blocks"][0]["internalVariables"] == {}
    assert encoded_flow["blocks"][0]["connectedTo"] == []
    assert encoded_flow["blocks"][0]["connectedToReferences"] == []
    assert encoded_flow["blocks"][0]["placedID"] == 1


def test_flow_write(tmpdir, flow):
    flow.path = os.path.join(tmpdir, "test_flow.json")
    encoded_flow = flow.write()
    assert os.path.exists(flow.path)
    with open(flow.path, "r") as f:
        saved_flow = json.load(f)
    assert saved_flow == encoded_flow


def test_flow_read(tmpdir, flow_data):
    flow_path = os.path.join(tmpdir, "test_flow.json")
    with open(flow_path, "w") as f:
        json.dump(flow_data, f)
    read_flow = Flow.read(flow_path)
    assert read_flow.name == "Test Flow"
    assert read_flow.savedID == "1234"
    assert read_flow.path == "/path/to/flow.json"
    assert read_flow.remote == "test_remote"
    assert read_flow.currentExecuting == 1
    assert read_flow.status == Flow.FlowStatus.RUNNING
    assert read_flow.date == "2022-01-01 12:00:00"
    assert read_flow.molstarState == {}
    assert read_flow.terminalOutput == ["Test output"]
    assert len(read_flow.blocks) == 1
    assert isinstance(read_flow.blocks[0], Block)
    assert read_flow.blocks[0].id == "test_block"
    assert read_flow.blocks[0].name == "Test Block"
    assert read_flow.blocks[0].inputs == {}
    assert read_flow.blocks[0].outputs == {}
    assert read_flow.blocks[0].internalVariables == {}
    assert read_flow.blocks[0].connectedTo == []
    assert read_flow.blocks[0].connectedToReferences == []
    assert read_flow.blocks[0].placedID == 1


def test_flow_find_block_by_id(flow):
    block = flow.findBlockByID("test_block")
    assert isinstance(block, Block)
    assert block.id == "test_block"
    with pytest.raises(Exception):
        flow.findBlockByID("non_existent_block")


def test_flow_find_block_by_placed_id(flow):
    block = flow.findBlockByPlacedID(1)
    assert isinstance(block, Block)
    assert block.placedID == 1
    with pytest.raises(Exception):
        flow.findBlockByPlacedID(2)


def test_flow_run_previous_blocks(plugin_manager, flow):
    flow._pluginManager = plugin_manager
    with pytest.raises(Exception):
        flow._runPreviousBlocks(1, resetRemoteBlock=False)