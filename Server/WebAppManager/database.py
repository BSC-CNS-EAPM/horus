# Types
import typing

# Logging
import logging

# Standard imports
import os
import datetime

# json for serialization
import json

# Werkzeug utilities
from werkzeug.security import generate_password_hash, check_password_hash

# Database management with SQLite and SQLAlchemy
import sqlalchemy

# Horus imports
from HorusAPI import VariableTypes
from Server.FileExplorer import FileExplorer

if typing.TYPE_CHECKING:
    from .webapp_manager import WebAppManager, DatabaseConfig
    from .user import HorusUser
    from Server.FlowManager import Flow


class UserError(Exception):
    """
    Base class for user management errors
    """


class Database:
    """
    User database management with SQLite and SQLAlchemy
    """

    dbConfig: "DatabaseConfig"
    """
    Configuration for the database
    """

    webAppManager: "WebAppManager"
    """
    A shared instance of the web app manager
    """

    VALIDATION_MAIL_EXPIRATION = 60 * 60 * 24
    """
    The expiration time for the validation mail in seconds
    """

    def __init__(self, config: "WebAppManager") -> None:
        self.webAppManager = config
        dbConfig = config.userManagement.database

        if not dbConfig:
            raise ValueError("Database configuration is missing.")

        self.dbConfig = dbConfig

        # Start the database engine
        self._startEngine(requireActivation=config.userManagement.requireActivation)

    def _startEngine(self, requireActivation) -> None:

        # Check if the database file exists
        if not os.path.isfile(self.dbConfig.path):
            # If the path contains multiple folders, create them as needed
            if "/" in self.dbConfig.path:
                logging.getLogger("Horus").info(
                    "Creating folders for database at %s", self.dbConfig.path
                )
                os.makedirs(os.path.dirname(self.dbConfig.path), exist_ok=True)

        # Start the engine
        self.engine = sqlalchemy.create_engine(f"sqlite:///{self.dbConfig.path}")

        self.metadata = sqlalchemy.MetaData()
        self.users = sqlalchemy.Table(
            "users",
            self.metadata,
            sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, unique=True),
            sqlalchemy.Column("email", sqlalchemy.String, unique=True),
            sqlalchemy.Column("password", sqlalchemy.String),
            sqlalchemy.Column(
                "activated",
                sqlalchemy.Boolean,
                default=not requireActivation,
            ),
            sqlalchemy.Column("registration_date", sqlalchemy.DateTime),
            sqlalchemy.Column("last_login", sqlalchemy.DateTime),
            sqlalchemy.Column("admin", sqlalchemy.Boolean),
            sqlalchemy.Column(
                "group",
                sqlalchemy.String,
                sqlalchemy.ForeignKey("groups.group"),
                default="default",
            ),
            sqlalchemy.Column(
                "maxStorage",
                sqlalchemy.Integer,
                default=(
                    self.dbConfig.defaultQuotas.maxStorage if self.dbConfig.defaultQuotas else 0
                ),
            ),
            sqlalchemy.Column(
                "maxFlows",
                sqlalchemy.Integer,
                default=(
                    self.dbConfig.defaultQuotas.maxFlows if self.dbConfig.defaultQuotas else 0
                ),
            ),
            sqlalchemy.Column(
                "maxTemplates",
                sqlalchemy.Integer,
                default=(
                    self.dbConfig.defaultQuotas.maxTemplates if self.dbConfig.defaultQuotas else 0
                ),
            ),
            sqlalchemy.Column(
                "maxTime",
                sqlalchemy.Integer,
                default=self.dbConfig.defaultQuotas.maxTime if self.dbConfig.defaultQuotas else 0,
            ),
        )

        # Append the extra fields to the table
        for extraField in self.dbConfig.extraFields:
            self.users.append_column(
                sqlalchemy.Column(
                    extraField.id, self._pluginVariableTypeToColumn(extraField.type)
                )
            )

        # Create another table for the sent flows
        self.flows = sqlalchemy.Table(
            "flows",
            self.metadata,
            # Each flow has a unique ID
            sqlalchemy.Column(
                "flow_id",
                sqlalchemy.String,
                unique=True,
                primary_key=True,
            ),
            # Each flow is associated with the user who sent it
            sqlalchemy.Column(
                "id",
                sqlalchemy.Integer,
                sqlalchemy.ForeignKey("users.id"),
            ),
            # The time the flow took to execute, this is important for the quotas
            sqlalchemy.Column("time", sqlalchemy.Float, default=0),
            # The size that the flow is taking, also important for the quotas
            sqlalchemy.Column("size", sqlalchemy.Integer, default=0),
            # If the flow was deleted adn therefore should not be counted in the quotas
            sqlalchemy.Column("deleted", sqlalchemy.Boolean, default=False),
        )

        # Create another table with the blocks-per-group
        self.groups = sqlalchemy.Table(
            "groups",
            self.metadata,
            # Each flow has a unique ID
            sqlalchemy.Column(
                "group",
                sqlalchemy.String,
                unique=True,
                primary_key=True,
            ),
            # Serialized block IDs that are from the group
            sqlalchemy.Column("blocks", sqlalchemy.String, nullable=True, default=None),
            # Serialized extensions that are from the group
            sqlalchemy.Column("extensions", sqlalchemy.String, nullable=True, default=None),
        )

        # Create the tables
        self.metadata.create_all(self.engine)

        # Create automatically the default group
        self.createGroup("default")

        logging.getLogger("Horus").info("Database loaded at %s", self.dbConfig.path)

    def _pluginVariableTypeToColumn(self, pluginVariable: str) -> type:
        """
        Converts a plugin variable type to a SQLAlchemy column type

        :param pluginVariable: The plugin variable type
        :return: The SQLAlchemy column type
        """
        if pluginVariable == VariableTypes.STRING.value:
            return sqlalchemy.String
        elif pluginVariable == VariableTypes.INTEGER.value:
            return sqlalchemy.Integer
        elif pluginVariable == VariableTypes.BOOLEAN.value:
            return sqlalchemy.Boolean
        elif pluginVariable == VariableTypes.FLOAT.value:
            return sqlalchemy.Float
        elif pluginVariable == VariableTypes.STRING_LIST.value:
            return sqlalchemy.String
        else:
            raise ValueError(f"Unsupported plugin variable type as DB column: {pluginVariable}")

    def registerUser(self, formData: typing.Dict[str, typing.Any]) -> str:
        """
        Registers a user in the database with the given form data
        """

        # Always lowercase the email, and sanitize it
        formData["email"] = sanitizeStringForDatabase(formData["email"].lower())

        # Check if the user already exists
        self._verifyUserExistsAndRemoveIfActivation(formData["email"])

        # Add the registration date
        formData["registration_date"] = datetime.datetime.now()

        self._validatePassword(formData["password"])

        # Hash the password
        formData["password"] = self.hashPassword(formData["password"])

        # If activation is required, send an email to the user
        if self.webAppManager.userManagement.requireActivation:
            if not self.webAppManager.userManagement.mailServer:
                raise ValueError("Mail server is not configured")

            self.webAppManager.userManagement.mailServer.sendActivationMail(
                formData["email"], self.dbConfig.secretKey
            )

        # If its the first user, make it admin
        if len(self.getAllUsers()) == 0:
            formData["admin"] = True

        # Insert the user into the database if everything went well
        try:
            with self.engine.connect() as connection:
                connection.execute(self.users.insert().values(formData))
                connection.commit()
        except Exception as e:
            logging.getLogger("Horus").error("Error registering user: %s", e)
            raise UserError("Error registering user. Try again later.") from e

        logging.getLogger("Horus").info("Successfully registered user: %s", formData["email"])

        message = "User registered successfully."

        if self.webAppManager.userManagement.requireActivation:
            message = "Check your email to activate your account."

        return message

    def _verifyUserExistsAndRemoveIfActivation(self, email: str):
        """
        Verify if a user mail exists in the database. Will raise an error if it does.
        When using "requireActivation", if the user is not activated
        and more than 24h have passed. The user will be removed, and the registration
        process can continue

        Raises
        ------
        UserError on user existing
        """

        # Get the user mail
        user = self.getUser(mail=email)

        if user is None:
            # The user does not exist
            return

        # If we require activation, veirfy that the user is activated
        if self.webAppManager.userManagement.requireActivation:
            if not user.activated and user.registrationDate:
                elapsedSinceRegister = (
                    datetime.datetime.now() - user.registrationDate
                ).total_seconds()
                # If 24h have passed without the user activating
                if elapsedSinceRegister > (24 * 3600):
                    # Delete the user and allow for registration
                    self.deleteUser(email)
                    return

        raise UserError("User already exists")

    def resetPassword(self, mail: str) -> str:
        """
        Resets the password of a user in the database with the given email
        """

        message = "Check your email to reset your password."

        # Check if the user exists
        if self.getUser(mail=mail) and self.webAppManager.userManagement.mailServer:
            # Send an email to the user
            self.webAppManager.userManagement.mailServer.sendResetPasswordMail(
                mail, self.dbConfig.secretKey
            )

        # Return good message even when failed to spoof the user / hacker
        return message

    def confirmResetPassword(self, token: str, newPassword: str):
        """
        Given a correct token and a new password, resets the password of the user
        """

        if not self.webAppManager.userManagement.mailServer:
            raise ValueError("Mail server is not configured")

        mail = self.webAppManager.userManagement.mailServer.validateToken(
            token, self.dbConfig.secretKey, self.VALIDATION_MAIL_EXPIRATION
        )

        self._validatePassword(newPassword)

        # Hash the password
        newPassword = self.hashPassword(newPassword)

        # Update the user's password
        with self.engine.connect() as connection:
            connection.execute(
                self.users.update().where(self.users.c.email == mail).values(password=newPassword)
            )
            connection.commit()

        logging.getLogger("Horus").info("Successfully reset password for user: %s", mail)

    def activateUser(self, token: str):
        """
        Activates a user in the database with the given email and token
        """

        if not self.webAppManager.userManagement.mailServer:
            raise ValueError("Mail server is not configured")

        # Check if the token is valid for the user
        mail = self.webAppManager.userManagement.mailServer.validateToken(
            token,
            self.dbConfig.secretKey,
            self.VALIDATION_MAIL_EXPIRATION,
        )

        # Activate the user
        with self.engine.connect() as connection:
            connection.execute(
                self.users.update().where(self.users.c.email == mail).values(activated=True)
            )
            connection.commit()

        logging.getLogger("Horus").info("Successfully activated user: %s", mail)

    def deleteUser(self, mail: str):
        """
        Removes user from the database
        """

        with self.engine.connect() as connection:
            connection.execute(self.users.delete().where(self.users.c.email == mail))
            connection.commit()

        logging.getLogger("Horus").info("Successfully deleted user: %s", mail)

    def getUser(
        self, id: typing.Optional[int] = None, mail: typing.Optional[str] = None
    ) -> typing.Union[None, "HorusUser"]:
        """
        Retrieves a user from the database by ID or email

        :param id: The ID of the user
        :param mail: The email of the user
        :return: The HorusUser instance
        """
        with self.engine.connect() as connection:
            if id is not None:
                result = connection.execute(self.users.select().where(self.users.c.id == id))
            elif mail is not None:
                result = connection.execute(self.users.select().where(self.users.c.email == mail))
            else:
                raise ValueError("Either 'id' or 'mail' parameter must be provided.")

            row = result.fetchone()

            if row is None:
                return None

            # Convert the row to a dictionary for easier manipulation
            userDict = row._asdict()

            from Server.WebAppManager import HorusUser

            return HorusUser(
                userDict, appSupportDir=self.webAppManager.userManagement.appSupportDir
            )

    def getAllUsers(self) -> typing.List[typing.Dict[str, str]]:
        """
        Retrieves all users from the database

        :return: A list of all users as dictionaries
        """

        with self.engine.connect() as connection:
            result = connection.execute(self.users.select()).fetchall()
            dictResult = []
            for row in result:
                dictResult.append(row._asdict())

            return dictResult

    def loginUser(self, mail: str, password: str) -> "HorusUser":
        """
        Logs a user in by email and password

        :param mail: The email of the user
        :param password: The password of the user
        :return: The user data as a dictionary or None if the user does not exist
        """

        # Always lowercase the email
        mail = sanitizeStringForDatabase(mail.lower())

        # Get the user
        dbUser: typing.Optional[sqlalchemy.engine.row.Row[typing.Any]] = None
        with self.engine.connect() as connection:
            dbUser = connection.execute(
                self.users.select().where((self.users.c.email == mail))
            ).fetchone()

        # Verify the password
        if dbUser is None or not check_password_hash(dbUser.password, password):
            raise UserError("Wrong email or password")

        # If the user is not activated, return None
        if not dbUser.activated:
            raise UserError("User is not activated")

        # Convert the row to a dictionary for easier manipulation
        userDict = dbUser._asdict()

        # If everithing wen well, update the last login date
        with self.engine.connect() as connection:
            connection.execute(
                self.users.update()
                .where(self.users.c.email == mail)
                .values(last_login=datetime.datetime.now())
            )
            connection.commit()

        from Server.WebAppManager import HorusUser

        # Return the instantiated User
        return HorusUser(userDict, appSupportDir=self.webAppManager.userManagement.appSupportDir)

    def hashPassword(self, password: str) -> str:
        """
        Hashes a password using the configured hashing algorithm
        """

        # Hash the password
        return generate_password_hash(password, method="pbkdf2:sha256", salt_length=8)

    def _validatePassword(self, password: str):
        """
        Validates the minimum password requirements.

        Raises
        ------
        UserError if the password does not meet requirements
        """

        validated = True

        # Verify length
        if len(password) < 8:
            validated = False

        # Check that it has at least one special character
        if not any(not c.isalnum() for c in password):
            validated = False

        # Check that it has at least one letter
        if not any(c.isalpha() for c in password):
            validated = False

        # Check that it has at least one letter
        if not any(not c.isdigit() for c in password):
            validated = False

        if not validated:
            raise UserError(
                "Password must be at least 8 characters long and has to include at least one number, one letter and a special character."
            )

    def _getUserQuotas(self, userID: int) -> typing.Dict[str, typing.Any]:
        """
        Retrieves the quotas of a user from the database
        """

        with self.engine.connect() as connection:
            result = connection.execute(
                self.users.select().where(self.users.c.id == userID)
            ).fetchone()

            if result is None:
                raise UserError("User does not exist")

            # If any of the quotas is 0, it means that the user has no quotas for that
            # specific field, so we set it to None
            result = result._asdict()

            for key in ["maxStorage", "maxFlows", "maxTemplates", "maxTime"]:
                if result[key] == 0:
                    result[key] = None

            return result

    def _getUserFlows(self, userID: int) -> typing.List[typing.Dict[str, typing.Any]]:
        """
        Retrieves the flows of a user from the database
        """

        with self.engine.connect() as connection:
            # Select all the flows of the user that are not deleted
            result = connection.execute(
                self.flows.select().where(
                    sqlalchemy.and_(
                        self.flows.c.id == userID,
                        self.flows.c.deleted == False,  # pylint: disable=singleton-comparison
                    )
                )
            ).fetchall()

            if result is None:
                return []

            dictResult = []
            for row in result:
                dictResult.append(row._asdict())

            return dictResult

    def getUserCurrentQuotasForDisplayOnUserPage(
        self, user: "HorusUser"
    ) -> typing.Dict[str, typing.Any]:
        """
        Returns a dictionary with
        - The current storage used by the user
        - The maximum storage allowed for the user
        - The current number of flows executed by the user
        - The maximum number of flows allowed for the user
        - The current time used by the user
        - The maximum time allowed for the user

        In the form:
        {
            "currentFlows": 0,
            "maxFlows": 0,
            "currentTemplates": 0,
            "maxTemplates": 0,
            "usedSpace": 0,
            "maxSpace": 0,
            "usedHours": 0,
            "maxHours": 0
        }

        :param user: The user
        :return: A dictionary with the current quotas
        """

        quotas = self._getUserQuotas(user.id)

        # Get all the flows of the user from the DB (mainly for the time)
        userFlows = self._getUserFlows(user.id)

        return {
            "currentFlows": len(os.listdir(user.flowsDir)),
            "maxFlows": quotas["maxFlows"],
            "currentTemplates": len(os.listdir(os.path.join(user.appSupportDir, "templates"))),
            "maxTemplates": quotas["maxTemplates"],
            "usedSpace": FileExplorer.computePathSize(user.flowsDir),
            "maxSpace": quotas["maxStorage"],
            "usedHours": sum([flow["time"] for flow in userFlows]),
            "maxHours": quotas["maxTime"],
        }

    def hasReachedQuota(
        self, user: "HorusUser", verify: typing.Optional[list[str]] = None
    ) -> tuple[bool, str]:
        """
        Checks if the user has reached the quotas

        :params:
        user: HorusUser -> The user to verify
        verify: list[str] -> A list of the cutoas to verify, by default, all of them. The list has to be
        of the form ["maxFlows", "maxTemplates"]...
        """

        # Get the user quotas
        quotas = self._getUserQuotas(user.id)

        # Get all the flows of the user
        userFlows = self._getUserFlows(user.id)

        # Set all to verify when verify is not provided
        if verify is None:
            verify = ["maxFlows", "maxTemplates", "maxStorage", "maxTime"]

        # If the user has reached the maximum number of flows
        # Use always the quantity of folders instead of the database,
        # as a flow can be removed manually by an admin
        if "maxFlows" in verify and quotas["maxFlows"] is not None:
            # Check within the user directory also for the
            # number of simulations (directories)
            if len(os.listdir(user.flowsDir)) >= quotas["maxFlows"]:
                return True, f"You have reached your limit of flows ({quotas['maxFlows']})"

        # If the user has reached the maximum number of templates
        if "maxTemplates" in verify and quotas["maxTemplates"] is not None:
            # Check within the user directory also for the
            # number of simulations (directories)
            if (
                len(os.listdir(os.path.join(user.appSupportDir, "templates")))
                >= quotas["maxTemplates"]
            ):
                return (
                    True,
                    f"You have reached your limit of templates ({quotas['maxTemplates']})",
                )

        # If the user has reached the maximum storage
        # For so, check the actual size of the folder instead
        # of the DB data
        if "maxStorage" in verify and quotas["maxStorage"] is not None:
            if FileExplorer.computePathSize(user.flowsDir) >= quotas["maxStorage"]:
                return True, f"You have reached your storage quota of {quotas['maxStorage']} MB"

        # If the user has reached the maximum time
        # This has to come from the DB
        if "maxTime" in verify and quotas["maxTime"] is not None:
            if sum([flow["time"] for flow in userFlows]) >= quotas["maxTime"]:
                return (
                    True,
                    f"You have reached your limit of computational time of {quotas['maxTime']} hours",
                )

        return False, ""

    def registerFlowForUser(self, user: "HorusUser", flow: "Flow"):
        """
        Registers a flow for a user

        :param user: The user that executed the flow
        :param flow: The flow that was executed
        """

        # Insert the flow into the database
        with self.engine.connect() as connection:
            # Skip if the flow ID is already in the database
            if connection.execute(
                self.flows.select().where(self.flows.c.flow_id == flow.savedID)
            ).fetchone():
                return

            connection.execute(
                self.flows.insert().values(
                    flow_id=flow.savedID,
                    id=user.id,
                    time=0,
                    size=0,
                )
            )
            connection.commit()

    def updateFlowForUser(self, flow: "Flow"):
        """
        Updates a flow for a user

        :param user: The user that executed the flow
        :param flow: The flow that was executed
        """

        # If the time or the size are not set, do not update the flow
        if flow.startedTime is None or flow.finishedTime is None or flow.size is None:
            logging.getLogger("Horus").critical(
                "Flow time and size are not set. The flow cannot be updated in the database."
            )
            raise ValueError("Flow time and size are not set.")

        # Compute the elapsed time
        elapsed = (flow.finishedTime - flow.startedTime).total_seconds()

        # Convert the elapsed time to hours
        elapsed = elapsed / 3600

        # If the flow already exists in the database, sum the time
        # to the existing time. The size does not need to be summed
        # here because the flow size is computed for the whole folder everytime
        # the flow ends automatically
        with self.engine.connect() as connection:
            result = connection.execute(
                self.flows.select().where(self.flows.c.flow_id == flow.savedID)
            ).fetchone()

            if result is None:
                # Insert the flow into the database
                raise ValueError(
                    f"Flow {flow.path} tried to update into the"
                    + "database but does not exist in it."
                )
            else:
                # By default, the time is 0, so we can just add the elapsed time
                elapsed += result.time

                # Update the flow in the database
                connection.execute(
                    self.flows.update()
                    .where(self.flows.c.flow_id == flow.savedID)
                    .values(time=elapsed, size=flow.size)
                )

            connection.commit()

    def removeFlowForUser(self, flow: "Flow"):
        """
        Removes a flow from the user's flows quotas (sets the deleted flag to True)

        :param user: The user that executed the flow
        :param flow: The flow that was executed
        """

        # Remove the flow from the database
        with self.engine.connect() as connection:
            connection.execute(
                self.flows.update()
                .where(self.flows.c.flow_id == flow.savedID)
                .values(deleted=True)
            )
            connection.commit()

    def dumpDatabase(self):
        """
        Dumps the database as a JSON object
        """

        database = {}
        with self.engine.connect() as connection:
            result = connection.execute(self.users.select()).fetchall()
            dictResult = []
            for row in result:
                dictUser = row._asdict()
                # Remove the password
                dictUser.pop("password")
                dictResult.append(dictUser)

            database["users"] = dictResult

            result = connection.execute(self.flows.select()).fetchall()
            dictResult = []

            for row in result:
                dictResult.append(row._asdict())

            database["flows"] = dictResult

            result = connection.execute(self.groups.select()).fetchall()
            dictResult = []

            for row in result:
                dictResult.append(row._asdict())

            database["groups"] = dictResult

        return database

    def updateUser(self, userID: int, values: typing.Dict[str, typing.Any]):
        """
        Updates a user in the database

        :param: userID -> The ID of the user
        :param: values -> A dictionary with the form {column: value} to update the database
        """

        # Set the allowed "udpatable columns
        allowedColumns = [
            "activated",
            "group",
            "admin",
            "maxFlows",
            "maxTemplates",
            "maxStorage",
            "maxTime",
        ]
        parsedValues = {k: v for k, v in values.items() if k in allowedColumns}

        with self.engine.connect() as connection:
            connection.execute(
                self.users.update().where(self.users.c.id == userID).values(parsedValues)
            )
            connection.commit()

            logging.getLogger("Horus").info(
                "Successfully updated user: %s with %s", userID, parsedValues
            )

    def createGroup(self, group: str):
        """
        Createas a group in the database

        :param: group -> The name of the group
        """

        group = sanitizeStringForDatabase(group).lower()

        # Insert the group into the database
        with self.engine.connect() as connection:
            # Skip if the group is already in the database
            if connection.execute(
                self.groups.select().where(self.groups.c.group == group)
            ).fetchone():
                return

            connection.execute(
                self.groups.insert().values(
                    group=group,
                )
            )
            connection.commit()

    def deleteGroup(self, group: str):
        """
        Createas a group in the database

        :param: group -> The name of the group
        """

        group = sanitizeStringForDatabase(group).lower()

        if group == "default":
            raise ValueError("Cannot remove the 'default' group.")

        with self.engine.connect() as connection:
            # Delete the group
            connection.execute(self.groups.delete().where(self.groups.c.group == group))

            # Update users to the "default" group where they were in the deleted group
            connection.execute(
                self.users.update().where(self.users.c.group == group).values(group="default")
            )
            connection.commit()

        logging.getLogger("Horus").info(
            f"Successfully removed group '{group}' and assigned 'default' to users."
        )

    def setBlocksToGroup(self, blockID: list[str], group: str):
        """
        Updates a user in the database

        :param: blockID -> The ID of the block
        :param: group -> The ID of the group
        """

        blockID = [sanitizeStringForDatabase(b) for b in blockID]
        group = sanitizeStringForDatabase(group)

        # Serialize the string
        if len(blockID) == 0:
            serializedBlocks = None
        else:
            serializedBlocks = json.dumps(blockID)

        with self.engine.connect() as connection:
            connection.execute(
                self.groups.update()
                .where(self.groups.c.group == group)
                .values(blocks=serializedBlocks)
            )
            connection.commit()

            logging.getLogger("Horus").info(
                "Successfully modified group '%s' with blocks '%s'", group, serializedBlocks
            )

    def setExtensionsToGroup(self, extensionsID: list[str], group: str):
        """
        Updates the group extensions in the database

        :param: blockID -> The ID of the extension
        :param: group -> The ID of the group
        """

        extensionsID = [sanitizeStringForDatabase(e) for e in extensionsID]
        group = sanitizeStringForDatabase(group)

        # Serialize the string
        if len(extensionsID) == 0:
            serializedExtensions = None
        else:
            serializedExtensions = json.dumps(extensionsID)

        with self.engine.connect() as connection:
            connection.execute(
                self.groups.update()
                .where(self.groups.c.group == group)
                .values(extensions=serializedExtensions)
            )
            connection.commit()

            logging.getLogger("Horus").info(
                "Successfully modified group '%s' extensions with '%s'",
                group,
                serializedExtensions,
            )

    def getBlocksFromGroup(self, group: str) -> list[str]:
        """
        Retrieves the list of block IDs for a given group from the database

        :param group: The ID of the group
        :return: List of block IDs
        """
        group = sanitizeStringForDatabase(group)

        with self.engine.connect() as connection:
            stmt = sqlalchemy.select(self.groups.c.blocks).where(self.groups.c.group == group)
            result = connection.execute(stmt).scalar()

        if result is None:
            blocks = []
        else:
            try:
                blocks = json.loads(result)
            except json.JSONDecodeError as e:
                logging.getLogger("Horus").error(
                    "Failed to decode blocks for group %s: %s", group, str(e)
                )
                blocks = []

        return blocks

    def getExtensionsFromGroup(self, group: str) -> list[str]:
        """
        Retrieves the list of extensions IDs for a given group from the database

        :param group: The ID of the group
        :return: List of extension IDs
        """
        group = sanitizeStringForDatabase(group)

        with self.engine.connect() as connection:
            stmt = sqlalchemy.select(self.groups.c.extensions).where(self.groups.c.group == group)
            result = connection.execute(stmt).scalar()

        if result is None:
            extensions = []
        else:
            try:
                extensions = json.loads(result)
            except json.JSONDecodeError as e:
                logging.getLogger("Horus").error(
                    "Failed to decode blocks for group %s: %s", group, str(e)
                )
                extensions = []

        return extensions


def sanitizeStringForDatabase(string: str) -> str:
    """
    Sanizites a string (no spaces, no commas...)
    """

    string = string.replace(" ", "_")
    string = string.replace(",", "_")
    string = string.replace("'", "_")
    string = string.replace('"', "_")
    string = string.replace("\\", "_")
    string = string.replace("/", "_")

    return string
