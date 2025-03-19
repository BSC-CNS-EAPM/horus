import pytest
from unittest.mock import patch, MagicMock
from HorusAPI import PluginVariable, PluginBlock, VariableTypes, VariableList, VariableGroup


def test_disabled_variables_output():

    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
        disabled=True,
    )

    def testBlock(block: PluginBlock):
        block.setOutput("test", "modified")

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, outputs=[disabled_variable]
    )

    # Run the block
    test_block()

    assert disabled_variable.value == "original"
    assert test_block.outputs["test"] == "original"


def test_disabled_variables():

    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
        disabled=True,
    )

    def testBlock(block: PluginBlock):
        pass

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, variables=[disabled_variable]
    )

    new_values = {"test": "modified"}

    test_block._updateVariables(new_values)

    assert disabled_variable.value == "original"
    assert test_block.variables["test"] == "original"


def test_disabled_variables_input():

    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
        disabled=True,
    )

    def testBlock(block: PluginBlock):
        pass

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, inputs=[disabled_variable]
    )

    new_values = {"test": "modified"}

    test_block._updateInputs(new_values)

    assert disabled_variable.value == "original"
    assert test_block.inputs["test"] == "original"


def test_disabled_variables_list_one_inside():

    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
        disabled=True,
    )

    not_disabled_variable = PluginVariable(
        id="test_2",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    second_disabled_variable = PluginVariable(
        id="test_3",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original_3",
        disabled=True,
    )

    new_values = {
        "var_list": [
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "original", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "original", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
        ]
    }

    original = [
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
    ]

    expected = [
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
    ]

    list_with_disabled = VariableList(
        id="var_list",
        name="test",
        description="test",
        prototypes=[disabled_variable, not_disabled_variable, second_disabled_variable],
        defaultValue=original,
    )

    def testBlock(block: PluginBlock):
        pass

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, variables=[list_with_disabled]
    )

    test_block._updateVariables(new_values)

    assert test_block.variables[list_with_disabled.id] == expected
    assert test_block.variables["var_list"] == expected


def test_disabled_variables_list_all():
    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    not_disabled_variable = PluginVariable(
        id="test_2",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    second_disabled_variable = PluginVariable(
        id="test_3",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original_3",
    )

    list_with_disabled = VariableList(
        id="var_list",
        name="test",
        description="test",
        prototypes=[disabled_variable, not_disabled_variable, second_disabled_variable],
        disabled=True,
    )

    def testBlock(block: PluginBlock):
        pass

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, variables=[list_with_disabled]
    )

    new_values = {
        "var_list": [
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "original", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "original", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
        ]
    }

    expected = [
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
    ]

    test_block._updateVariables(new_values)

    assert list_with_disabled.value is None
    assert test_block.variables["var_list"] is None


def test_disabled_variables_list_all_with_default():
    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    not_disabled_variable = PluginVariable(
        id="test_2",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    second_disabled_variable = PluginVariable(
        id="test_3",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original_3",
    )

    list_with_disabled = VariableList(
        id="var_list",
        name="test",
        description="test",
        prototypes=[disabled_variable, not_disabled_variable, second_disabled_variable],
        disabled=True,
    )

    expected = [
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
    ]

    list_with_disabled.defaultValue = expected
    list_with_disabled.value = expected

    def testBlock(block: PluginBlock):
        pass

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, variables=[list_with_disabled]
    )

    new_values = {
        "var_list": [
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "original", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "original", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
        ]
    }

    test_block._updateVariables(new_values)

    assert list_with_disabled.value == expected
    assert test_block.variables["var_list"] == expected


def test_disabled_variables_output_list():
    disabled_variable = PluginVariable(
        id="test",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    not_disabled_variable = PluginVariable(
        id="test_2",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original",
    )

    second_disabled_variable = PluginVariable(
        id="test_3",
        name="test",
        description="test",
        type=VariableTypes.STRING,
        defaultValue="original_3",
    )

    list_with_disabled = VariableList(
        id="var_list",
        name="test",
        description="test",
        prototypes=[disabled_variable, not_disabled_variable, second_disabled_variable],
        disabled=True,
    )

    expected = [
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "original", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
        {"test": "original", "test_2": "modified", "test_3": "original_3"},
    ]

    list_with_disabled.defaultValue = expected
    list_with_disabled.value = expected

    new_values = {
        "var_list": [
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "original", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "original", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "modfied_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "original", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "original", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
            {"test": "modified", "test_2": "modified", "test_3": "original_3"},
        ]
    }

    def testBlock(block: PluginBlock):
        block.setOutput("var_list", new_values)

    test_block = PluginBlock(
        name="Test", description="test", action=testBlock, outputs=[list_with_disabled]
    )

    test_block._updateVariables(new_values)

    assert list_with_disabled.value == expected
    assert test_block.outputs["var_list"] == expected


def test_minimal_variable_is_minimal():
    variable = PluginVariable(
        id="test",
        name="Test",
        description="Test",
        defaultValue=0,
        type=VariableTypes.FLOAT,
        disabled=True,
        category="Test",
        allowedValues=[0, 1, 2],
    )

    minimalVar = variable.toDict(minimal=True)
    fullVar = variable.toDict()

    assert minimalVar != fullVar
    assert minimalVar.get("name") is None
    assert minimalVar.get("description") is None
    assert minimalVar.get("defaultValue") is None
    assert minimalVar.get("disabled") is None
    assert minimalVar.get("category") is None
    assert minimalVar.get("allowedValues") is None


def test_varDict_default_value_float_0():

    # Test for an issue where values of 0
    # would return the defaultValue instead
    # of the actual (0) value
    variable = PluginVariable(
        id="test",
        name="Test",
        description="Test",
        defaultValue=40,
        type=VariableTypes.FLOAT,
    )

    variable.value = 0

    minVar = variable.toDict()

    assert minVar["value"] == 0
    assert minVar["value"] != 40
