# Types
import typing

# Logging
import logging

# Standard imports
import os
import datetime

# Werkzeug utilities
from werkzeug.security import generate_password_hash, check_password_hash

# Database management with SQLite and SQLAlchemy
import sqlalchemy

# Horus imports
from HorusAPI import VariableTypes

if typing.TYPE_CHECKING:
    from .webapp_manager import WebAppManager, DatabaseConfig, MailServer
    from .user import HorusUser


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
            sqlalchemy.Column("group", sqlalchemy.Integer),
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
            # Each flow is associated with the user who sent it
            sqlalchemy.Column(
                "id",
                sqlalchemy.Integer,
                sqlalchemy.ForeignKey("users.id"),
                primary_key=True,
                unique=True,
            ),
            # Each flow has a unique ID
            sqlalchemy.Column("flow_id", sqlalchemy.String, unique=True),
            # The time the flow took to execute, this is important for the quotas
            sqlalchemy.Column("time", sqlalchemy.Integer),
            # The size that the flow is taking, also important for the quotas
            sqlalchemy.Column("size", sqlalchemy.Integer),
        )

        # Create the tables
        self.metadata.create_all(self.engine)

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

        # Check if the user already exists
        if self.getUser(mail=formData["email"]) is not None:
            raise UserError("User already exists")

        # Add the registration date
        formData["registration_date"] = datetime.datetime.now()

        # Hash the password
        formData["password"] = self.hashPassword(formData["password"])

        if not self._validatePassword(formData["password"]):
            raise UserError(
                "Password does not meet the requirements. It must be at least 8 characters long."
            )

        if not self.webAppManager.userManagement.mailServer:
            raise ValueError("Mail server is not configured")

        # If activation is required, send an email to the user
        if self.webAppManager.userManagement.requireActivation:
            self.webAppManager.userManagement.mailServer.sendActivationMail(
                formData["email"], self.dbConfig.secretKey
            )

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

    def resetPassword(self, mail: str) -> str:
        """
        Resets the password of a user in the database with the given email
        """

        # Check if the user already exists
        if self.getUser(mail=mail) is None:
            raise UserError("User does not exist")

        if not self.webAppManager.userManagement.mailServer:
            raise ValueError("Mail server is not configured")

        # Send an email to the user
        self.webAppManager.userManagement.mailServer.sendResetPasswordMail(
            mail, self.dbConfig.secretKey
        )

        return "Check your email to reset your password."

    def confirmResetPassword(self, token: str, newPassword: str):
        """
        Given a correct token and a new password, resets the password of the user
        """

        if not self.webAppManager.userManagement.mailServer:
            raise ValueError("Mail server is not configured")

        mail = self.webAppManager.userManagement.mailServer.validateToken(
            token, self.dbConfig.secretKey, self.VALIDATION_MAIL_EXPIRATION
        )

        if not self._validatePassword(newPassword):
            raise UserError(
                "Password does not meet the requirements. It must be at least 8 characters long."
            )

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

    def loginUser(self, mail: str, password: str) -> typing.Union[None, "HorusUser"]:
        """
        Logs a user in by email and password

        :param mail: The email of the user
        :param password: The password of the user
        :return: The user data as a dictionary or None if the user does not exist
        """

        # Get the user
        dbUser: typing.Optional[sqlalchemy.engine.row.Row[typing.Any]] = None
        with self.engine.connect() as connection:
            dbUser = connection.execute(
                self.users.select().where((self.users.c.email == mail))
            ).fetchone()

        if dbUser is None:
            raise UserError("User does not exist")

        # Verify the password
        if not check_password_hash(dbUser.password, password):
            return None

        # If the user is not activated, return None
        if not dbUser.activated:
            raise UserError("User is not activated")

        # Convert the row to a dictionary for easier manipulation
        userDict = dbUser._asdict()

        from Server.WebAppManager import HorusUser

        # Return the instantiated User
        return HorusUser(userDict, appSupportDir=self.webAppManager.userManagement.appSupportDir)

    def hashPassword(self, password: str) -> str:
        """
        Hashes a password using the configured hashing algorithm
        """

        # Hash the password
        return generate_password_hash(password, method="pbkdf2:sha256", salt_length=8)

    def _validatePassword(self, password: str) -> bool:
        """
        Validates the minimum password requirements
        """

        if len(password) < 8:
            return False

        return True
