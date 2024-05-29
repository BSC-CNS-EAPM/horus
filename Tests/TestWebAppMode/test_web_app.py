# tests/test_ExtraField.py
from typing import Any, Dict, cast
import pytest
from HorusAPI import VariableTypes
from Server.WebAppManager.webapp_manager import (
    ExtraField,
    DefaultQuotas,
    DatabaseConfig,
    UserManagement,
    Auth,
    MailServer,
    FileManagement,
    AnonymousQuotas,
)


def test_extra_field_instantiation_valid() -> None:
    raw_extra_field = {
        "id": "test_field",
        "name": "Test field",
        "description": "Test description",
        "type": "string",
        "allowedValues": ["value1", "value2"],
    }
    extra_field = ExtraField(raw_extra_field)
    assert extra_field.id == "test_field"
    assert extra_field.name == "Test field"
    assert extra_field.description == "Test description"
    assert extra_field.type == VariableTypes.STRING.value
    assert extra_field.allowedValues == ["value1", "value2"]


def test_extra_field_instantiation_missing_required_fields() -> None:
    with pytest.raises(ValueError):
        ExtraField({})


def test_extra_field_instantiation_invalid_type() -> None:
    with pytest.raises(ValueError):
        ExtraField({"name": "test_field", "type": "invalid_type"})


def test_extra_field_instantiation_optional_fields() -> None:
    raw_extra_field = {"id": "test_field", "name": "Test field", "type": "string"}
    extra_field = ExtraField(raw_extra_field)
    assert extra_field.id == "test_field"
    assert extra_field.name == "Test field"
    assert extra_field.description is None
    assert extra_field.type == VariableTypes.STRING.value
    assert extra_field.allowedValues is None


@pytest.fixture
def raw_extra_field() -> Dict[str, Any]:
    return {
        "id": "age",
        "name": "Age",
        "description": "User's age",
        "type": "integer",
        "allowedValues": [str(i) for i in range(18, 101)],
    }


def test_extra_field_instantiation(raw_extra_field: Dict[str, Any]):
    extra_field = ExtraField(raw_extra_field)
    assert extra_field.name == "Age"
    assert extra_field.description == "User's age"
    assert extra_field.type == VariableTypes.INTEGER.value
    assert extra_field.allowedValues == [str(i) for i in range(18, 101)]


def test_extra_field_missing_name():
    with pytest.raises(ValueError):
        ExtraField({})


def test_extra_field_invalid_type(raw_extra_field: Dict[str, Any]):
    raw_extra_field["type"] = "InvalidType"
    with pytest.raises(ValueError):
        ExtraField(raw_extra_field)


def test_extra_field_optional_fields():
    raw_extra_field = {"id": "height", "name": "Height", "type": "float"}
    extra_field = ExtraField(raw_extra_field)
    assert extra_field.name == "Height"
    assert extra_field.description is None
    assert extra_field.type == VariableTypes.FLOAT.value
    assert extra_field.allowedValues is None


def test_default_quotas_valid_input():
    raw_data = {
        "maxStorage": 200,
        "maxFlows": 15,
        "maxTemplates": 15,
        "maxTime": 20,
        "resetTime": 30,
    }
    default_quotas = DefaultQuotas(raw_data)
    assert default_quotas.maxStorage == 200
    assert default_quotas.maxFlows == 15
    assert default_quotas.maxTime == 20
    assert default_quotas.resetTime == 30
    assert default_quotas.maxTemplates == 15


def test_default_quotas_missing_fields():
    raw_data = {}  # No fields provided, should assign default values
    default_quotas = DefaultQuotas(raw_data)
    assert default_quotas.maxStorage == 100  # Default value
    assert default_quotas.maxFlows == 10  # Default value
    assert default_quotas.maxTime == 10  # Default value
    assert default_quotas.resetTime == 30  # Default value


def test_default_quotas_optional_fields():
    raw_data = {"maxStorage": 200, "maxFlows": 15}
    default_quotas = DefaultQuotas(raw_data)
    assert default_quotas.maxStorage == 200
    assert default_quotas.maxFlows == 15
    assert default_quotas.maxTime == 10  # Default value
    assert default_quotas.resetTime == 30  # Default value
    assert default_quotas.maxTemplates == 10  # Default value


def test_auth_valid_input():
    raw_data = {"user": "username", "password": "securepassword"}
    auth = Auth(raw_data)
    assert auth.user == "username"
    assert auth.password == "securepassword"


def test_auth_missing_user():
    with pytest.raises(ValueError, match="Missing mail server authentication user"):
        Auth({"password": "securepassword"})


def test_auth_missing_password():
    with pytest.raises(ValueError, match="Missing mail server authentication password"):
        Auth({"user": "username"})


def test_mail_server_valid_input():
    raw_data = {
        "host": "smtp.example.com",
        "port": 587,
        "secure": True,
        "auth": {"user": "username", "password": "securepassword"},
    }
    mail_server = MailServer(raw_data)
    assert mail_server.host == "smtp.example.com"
    assert mail_server.port == 587
    assert mail_server.secure == True
    assert mail_server.auth.user == "username"
    assert mail_server.auth.password == "securepassword"


def test_mail_server_missing_host():
    with pytest.raises(ValueError, match="Missing mail server host"):
        MailServer(
            {
                "port": 587,
                "secure": True,
                "auth": {"user": "username", "password": "securepassword"},
            }
        )


def test_mail_server_missing_auth():
    with pytest.raises(ValueError, match="Missing mail server auth"):
        MailServer({"host": "smtp.example.com", "port": 587, "secure": True})


def test_mail_server_invalid_auth():
    with pytest.raises(ValueError, match="Missing mail server authentication user"):
        MailServer(
            {
                "host": "smtp.example.com",
                "port": 587,
                "secure": True,
                "auth": {"password": "securepassword"},
            }
        )


def test_user_management_valid_input():
    raw_data = {
        "appSupportDir": "data",
        "requireRegistration": True,
        "requireActivation": True,
        "mailServer": {
            "host": "smtp.example.com",
            "port": 587,
            "secure": True,
            "auth": {"user": "username", "password": "securepassword"},
        },
        "database": {"path": "users.db"},
    }
    user_management = UserManagement(raw_data)
    assert user_management.appSupportDir == "data"
    assert user_management.requireRegistration == True
    assert user_management.requireActivation == True
    assert cast(MailServer, user_management.mailServer).host == "smtp.example.com"
    assert cast(MailServer, user_management.mailServer).auth.user == "username"
    assert cast(DatabaseConfig, user_management.database).path == "users.db"


def test_user_management_missing_fields():
    management = UserManagement({})

    # Should apply automatically default "no-user management"
    assert management.appSupportDir == "users_data"
    assert management.requireRegistration == False
    assert management.requireActivation == False
    assert management.mailServer is None
    assert management.database is None


def test_user_management_optional_fields():
    raw_data = {"appSupportDir": "data", "requireRegistration": True}
    with pytest.raises(
        ValueError, match="Missing database configuration. Please check the configuration file."
    ):
        UserManagement(raw_data)


def test_user_management_invalid_configuration():
    with pytest.raises(
        ValueError,
        match="If you require users to activate their accounts, you must require registration",
    ):
        UserManagement(
            {"appSupportDir": "data", "requireRegistration": False, "requireActivation": True}
        )


def test_database_valid_input():
    raw_data = {
        "path": "users.db",
        "extraFields": [
            {"id": "field1", "name": "field1", "type": "string"},
            {"id": "field1", "name": "field2", "type": "integer"},
        ],
        "defaultQuotas": {
            "maxStorage": 200,
            "maxFlows": 15,
            "maxTemplates": 15,
            "maxTime": 20,
            "resetTime": 30,
        },
    }
    database = DatabaseConfig(raw_data)
    assert database.path == "users.db"
    assert len(database.extraFields) == 2
    assert cast(DefaultQuotas, database.defaultQuotas).maxStorage == 200
    assert cast(DefaultQuotas, database.defaultQuotas).maxFlows == 15
    assert cast(DefaultQuotas, database.defaultQuotas).maxTime == 20
    assert cast(DefaultQuotas, database.defaultQuotas).resetTime == 30
    assert cast(DefaultQuotas, database.defaultQuotas).maxTemplates == 15


def test_database_missing_fields():
    db = DatabaseConfig({})

    assert db.path == "horus_users.db"
    assert db.extraFields == []
    assert db.defaultQuotas is None


def test_database_optional_fields():
    raw_data = {
        "path": "users.db",
        "extraFields": [{"id": "field1", "name": "field1", "type": "string"}],
    }
    database = DatabaseConfig(raw_data)
    assert database.path == "users.db"
    assert len(database.extraFields) == 1
    assert database.defaultQuotas is None


def test_database_invalid_extra_field_type():
    with pytest.raises(
        ValueError,
        match="Invalid type for extra field field1. Please check the configuration file.",
    ):
        DatabaseConfig(
            {
                "path": "users.db",
                "extraFields": [{"id": "field1", "name": "field1", "type": "invalid"}],
            }
        )


def test_extra_field_to_dict():
    raw_extra_field = {
        "id": "age",
        "name": "Age",
        "description": "User's age",
        "type": "integer",
        "allowedValues": [str(i) for i in range(18, 101)],
    }
    extra_field = ExtraField(raw_extra_field)
    assert extra_field.toDict() == raw_extra_field


def test_scret_key_database():
    raw_database = {
        "path": "users.db",
        "secretKey": "secret",
        "extraFields": [
            {"id": "field1", "name": "field1", "type": "string"},
            {"id": "field1", "name": "field2", "type": "integer"},
        ],
        "defaultQuotas": {
            "maxStorage": 200,
            "maxFlows": 15,
            "maxTemplates": 15,
            "maxTime": 20,
            "resetTime": 30,
        },
    }

    db = DatabaseConfig(raw_database)

    assert db.secretKey == "secret"


def test_no_scret_key_database():
    raw_database = {
        "path": "users.db",
        "extraFields": [
            {"id": "field1", "name": "field1", "type": "string"},
            {"id": "field1", "name": "field2", "type": "integer"},
        ],
        "defaultQuotas": {
            "maxStorage": 200,
            "maxFlows": 15,
            "maxTemplates": 15,
            "maxTime": 20,
            "resetTime": 30,
        },
    }

    db = DatabaseConfig(raw_database)

    assert db.secretKey is not None


def test_file_management_initialization():
    raw_file_manager = {
        "allowUpload": True,
        "maxUploadSize": 1000,
        "allowDownload": True,
        "allowDelete": False,
        "allowNewFolder": True,
    }
    file_manager = FileManagement(raw_file_manager)
    assert file_manager.allowUpload == True
    assert file_manager.maxUploadSize == 1000
    assert file_manager.allowDownload == True
    assert file_manager.allowDelete == False
    assert file_manager.allowNewFolder == True


def test_file_management_initialization_empty():
    raw_file_manager = {
        "allowUpload": True,
        "maxUploadSize": 1000,
        "allowDownload": True,
        "allowDelete": False,
        "allowNewFolder": True,
    }
    file_manager = FileManagement(raw_file_manager)
    assert file_manager.allowUpload == True
    assert file_manager.maxUploadSize == 1000
    assert file_manager.allowDownload == True
    assert file_manager.allowDelete == False
    assert file_manager.allowNewFolder == True


def test_anonymous_quotas_initialization():
    raw_anonymous_quotas = {
        "maxFlows": 20,
        "maxStorage": 1000,
        "maxTemplates": 15,
        "maxTime": 200,
    }
    quotas = AnonymousQuotas(raw_anonymous_quotas)
    assert quotas.maxFlows == 20
    assert quotas.maxStorage == 1000
    assert quotas.maxTime == 200
    assert quotas.maxTemplates == 15


def test_user_management_registration_activation_requirement():
    # Test when activation is required without registration
    with pytest.raises(ValueError):
        UserManagement({"requireActivation": True})

    # Test when activation is required with registration but mail server is missing
    with pytest.raises(ValueError):
        UserManagement({"requireActivation": True, "requireRegistration": True})

    # Test when demo user is allowed without registration
    with pytest.raises(ValueError):
        UserManagement({"allowDemoUser": True})

    # Test when anonymous quotas are set with registration
    with pytest.raises(ValueError):
        UserManagement({"requireRegistration": True, "anonymousQuotas": {"maxFlows": 10}})

    # Test when all requirements are met
    raw_user_management = {
        "requireRegistration": True,
        "requireActivation": True,
        "mailServer": {
            "host": "example.com",
            "port": 587,
            "auth": {"user": "mymail@mail.com", "password": "mypassword123"},
        },
        "database": {"path": "users.db"},
        "fileManagement": {},
    }
    user_management = UserManagement(raw_user_management)
    assert user_management.requireRegistration == True
    assert user_management.requireActivation == True
    assert isinstance(user_management.mailServer, MailServer)
    assert isinstance(user_management.database, DatabaseConfig)
    assert isinstance(user_management.fileManagement, FileManagement)
