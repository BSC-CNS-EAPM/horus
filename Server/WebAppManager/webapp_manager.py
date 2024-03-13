# Typing
from typing import Optional, List, Dict, Any

# Basic tools
import os
import shutil
import atexit
import datetime

# Loggin
import logging

# JSON for loading the configuration file
import json

# socket for knowing the external ip adress
import socket

# Mail server
import smtplib
from email.mime.text import MIMEText

# User folder deletion intervals
from apscheduler.schedulers.background import BackgroundScheduler

# Generating the token in case the secret key is missing
import secrets
import itsdangerous

# HorusAPI
from HorusAPI import VariableTypes

# Database
from .database import Database


class ExtraField:
    """
    Extra fields for the database during the user registration process.

    Extra fields behave like PluginVariables, but are not associated with a plugin.
    """

    id: str
    """
    The ID of the extra field
    """

    name: str
    """
    The name of the extra field
    """

    description: Optional[str]
    """
    A description of the extra field
    """

    type: VariableTypes
    """
    The VariableType of the extra field
    """

    allowedValues: Optional[List[str]]
    """
    A list of allowed values for the extra field. Only applicable to certain types
    """

    def __init__(self, rawExtraField: Dict[str, Any]) -> None:
        self.id = rawExtraField.get("id", None)
        if self.id is None:
            raise ValueError("Missing ID for extra field. Please check the configuration file.")

        self.name = rawExtraField.get("name", None)
        self.description = rawExtraField.get("description", None)
        self.type = rawExtraField.get("type", None)

        if not self.name or not self.type:
            raise ValueError(
                "Missing name or type for extra field. Please check the configuration file."
            )

        if self.type not in [str(_type) for _type in VariableTypes.getTypes()]:
            raise ValueError(
                f"Invalid type for extra field {self.name}. Please check the configuration file."
            )

        self.allowedValues = rawExtraField.get("allowedValues", None)

    def toDict(self) -> Dict[str, Any]:
        """
        Converts the extra field to a dictionary
        """

        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "type": self.type,
            "allowedValues": self.allowedValues,
        }


class DefaultQuotas:
    """
    Default storage, flow, and computation hours quotas for users.
    Can be overriden per-user in the Admin panel.
    """

    maxStorage: int
    """
    The maximum storage for the user in MB
    """

    maxFlows: int
    """
    The maximum number of flows for the user
    """

    maxTime: int
    """
    The maximum computational hours for the user
    """

    resetTime: int
    """
    The time in days to reset the user's quotas
    """

    def __init__(self, rawDefaultQuotas: Dict[str, Any]) -> None:
        self.maxStorage = rawDefaultQuotas.get("maxStorage", 100)
        self.maxFlows = rawDefaultQuotas.get("maxFlows", 10)
        self.maxTime = rawDefaultQuotas.get("maxTime", 10)
        self.resetTime = rawDefaultQuotas.get("resetTime", 30)


class DatabaseConfig:
    """
    Database information for the user management system
    """

    path: str
    """
    The path to the database file
    """

    secretKey: str
    """
    The secret key for hashing the user's password, tokens and activation codes
    """

    extraFields: List[ExtraField]
    """
    Extra fields for the database during the user registration process
    """

    defaultQuotas: Optional[DefaultQuotas]
    """
    Maximum storage, flows, and time for users. If none, there are no quotas
    """

    def __init__(self, rawDatabase: Dict[str, Any]) -> None:
        self.path = rawDatabase.get("path", "horus_users.db")
        self.secretKey = rawDatabase.get("secretKey", None)

        if not self.secretKey:

            self.secretKey = secrets.token_urlsafe(16)

            logging.getLogger("Horus").warning(
                "Missing secret key for the database. "
                + "Please check the configuration file. "
                + "A random secret key will be used: %s",
                self.secretKey,
            )

        rawExtraFields = rawDatabase.get("extraFields", [])
        self.extraFields = [ExtraField(extraField) for extraField in rawExtraFields]
        rawDefaultQuotas = rawDatabase.get("defaultQuotas", None)
        self.defaultQuotas = DefaultQuotas(rawDefaultQuotas) if rawDefaultQuotas else None


class Auth:
    """
    Authentication information for the mail server service
    """

    user: str
    """
    The user name for the mail server
    """

    password: str
    """
    The password for the mail server
    """

    def __init__(self, rawAuth: Dict[str, Any]) -> None:
        """
        Initializes the Auth object

        :param rawAuth: The raw authentication JSON information from the configuration file
        """

        user = rawAuth.get("user")
        if not user:
            raise ValueError(
                "Missing mail server authentication user. Please check the configuration file."
            )

        password = rawAuth.get("password")
        if not password:
            raise ValueError(
                "Missing mail server authentication password. "
                + "Please check the configuration file."
            )

        self.user = user
        self.password = password


class MailServer:
    """
    If the user management system requires registration,
    the mail server information is handled here
    """

    host: str
    """
    Mail service host
    """

    port: int
    """
    Mail service port    
    """

    secure: bool
    """
    Whether the mail service is secure
    """

    auth: Auth
    """
    Authentication information for the mail server service such as user and password
    """

    activateSubject: str
    """
    The subject of the email for activating the account
    """

    activateBody: str
    """
    The body of the email for activating the account as an HTML string
    """

    resetSubject: str
    """
    The subject of the email for resetting the password
    """

    resetBody: str
    """
    The body of the email for resetting the account password as an HTML string
    """

    externalURL: str
    """
    External URL to generate links to
    """

    TOKEN_SALT: str = "email-confirm"
    """
    The salt for the token
    """

    def __init__(self, rawMailServer: Dict[str, Any], externalURL: Optional[str] = None) -> None:

        if externalURL is None:
            externalURL = socket.gethostbyname(socket.gethostname())
            logging.getLogger("Horus").warning(
                "Missing external URL. Please check the configuration file. "
                + "Using external ip address (%s) as the external URL.",
                externalURL,
            )

        host = rawMailServer.get("host")
        if not host:
            raise ValueError("Missing mail server host. Please check the configuration file.")

        port = rawMailServer.get("port", 587)
        secure = rawMailServer.get("secure", False)
        rawAuth = rawMailServer.get("auth")

        if not rawAuth:
            raise ValueError("Missing mail server auth. Please check the configuration file.")

        self.activateSubject = rawMailServer.get("activateSubject", "Horus Account Activation")
        self.activateBody = rawMailServer.get("activateBody", "Your activation link is: %link%")
        self.resetSubject = rawMailServer.get("resetSubject", "Horus Password Reset")
        self.resetBody = rawMailServer.get("resetBody", "Your password reset link is: %link%")

        self.externalURL = externalURL
        self.host = host
        self.port = port
        self.secure = secure
        self.auth = Auth(rawAuth)

    def _sendMail(self, to: str, subject: str, body: str) -> None:
        """
        Sends an email using the mail server information

        :param to: The email address to send the email to
        :param subject: The subject of the email
        :param body: The body of the email
        """

        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = self.auth.user
        msg["To"] = to
        try:
            with smtplib.SMTP_SSL(host=self.host, port=self.port) as mailServer:
                mailServer.login(self.auth.user, self.auth.password)
                mailServer.sendmail(self.auth.user, to, msg.as_string())

                logging.getLogger("Horus").debug("Sent email to %s", to)
        except Exception as e:
            raise Exception(f"Error sending activation email to {to}: {e}") from e

    def sendActivationMail(self, to: str, secretKey: str) -> None:
        """
        Sends an activation email to the user

        :param to: The email address to send the email to
        :param activationCode: The activation code to send to the user
        """

        activationCode = self._generateToken(to, secretKey)

        activationLink = f"{self.externalURL}/users/activate?token={activationCode}"

        subject = self.activateSubject if self.activateSubject else "Horus Account Activation"
        body = (
            self.activateBody.replace("%link%", activationLink)
            if self.activateBody
            else f"Your activation link is: {activationLink}"
        )

        self._sendMail(to, subject, body)

    def sendResetPasswordMail(self, to: str, secretKey: str) -> None:
        """
        Sends a reset password email to the user

        :param to: The email address to send the email to
        :param secretKey: The secret key to use for token generation
        """

        resetLink = f"{self.externalURL}/users/reset?token={self._generateToken(to, secretKey)}"

        subject = self.resetSubject if self.resetSubject else "Horus Password Reset"
        body = (
            self.resetBody.replace("%link%", resetLink)
            if self.resetBody
            else f"Your password reset link is: {resetLink}"
        )

        self._sendMail(to, subject, body)

    @classmethod
    def _generateToken(cls, email: str, secretKey: str) -> str:
        """
        Generates a token for the user. The token is used to verify the user's email address

        :param email: The email address to generate the token for
        :param secretKey: The secret key to use for token generation
        """

        serializer = itsdangerous.URLSafeTimedSerializer(secretKey)
        return str(serializer.dumps(email, salt=cls.TOKEN_SALT))

    @classmethod
    def validateToken(cls, token: str, secretKey: str, expiration: int = 3600) -> str:
        """
        Validates the token for the user. The token is used to verify the user's email address

        :param token: The token to validate
        :param secretKey: The secret key to use for validation
        :param expiration: The expiration time for the token

        :return: The email address if the token is valid
        """

        serializer = itsdangerous.URLSafeTimedSerializer(secretKey)
        try:
            mail = serializer.loads(token, salt=cls.TOKEN_SALT, max_age=expiration)
            return mail
        except itsdangerous.SignatureExpired as e:
            raise ValueError("The token has expired") from e
        except itsdangerous.BadSignature as e:
            raise ValueError("The token is invalid") from e


class UserManagement:
    """
    User management information for the server such as the app support directory,
    whether registration is required, and whether activation is required
    """

    appSupportDir: str
    """
    The user data directory. For each user, a directory will
    be created in this directory to store their data
    """

    requireRegistration: bool
    """
    Whether registration is required to use the server.
    Otherwise, users can use the server without registering.
    Calculations will be done anonymously and will be removed after leaving the page.
    """

    requireActivation: bool
    """
    If registration is required, whether activation is required. 
    If activation is required, users will receive an email with a link to activate their account.
    """

    mailServer: Optional[MailServer]
    """
    If activation is required, the mail server information is stored here
    """

    database: Optional[DatabaseConfig]
    """
    If registration is required, the database information is stored here
    This is also the database controller.
    """

    deleteInterval: int = 0
    """
    The interval in days to delete the user folders. Only applicable on non-registration servers
    Set to 0 to disable
    """

    maxFlowsAnonymous: int = 10
    """
    The maximum number of flows for anonymous users (When not requiring registration)
    """

    def __init__(
        self,
        rawUserManagement: Dict[str, Any],
        externalURL: Optional[str] = None,
    ) -> None:

        if externalURL is None:
            externalURL = socket.gethostbyname(socket.gethostname())
            logging.getLogger("Horus").warning(
                "Missing external URL. Please check the configuration file. "
                + "Using external ip address (%s) as the external URL.",
                externalURL,
            )

        self.appSupportDir = rawUserManagement.get("appSupportDir", "users_data")
        self.requireRegistration = rawUserManagement.get("requireRegistration", False)
        self.requireActivation = rawUserManagement.get("requireActivation", False)
        self.allowDemoUser = rawUserManagement.get("allowDemoUser", False)
        self.deleteInterval = rawUserManagement.get("deleteInterval", 0)
        self.maxFlowsAnonymous = rawUserManagement.get("maxFlowsAnonymous", 10)

        if self.requireActivation and not self.requireRegistration:
            raise ValueError(
                "If you require users to activate their accounts, you must require registration."
            )

        rawMailServer = rawUserManagement.get("mailServer")
        if not rawMailServer and self.requireActivation:
            raise ValueError(
                "If you require users to activate their accounts, "
                + "you must provide mail server configuration in the configuration file."
            )

        # Demo users are only allowed when registration is required
        if not self.requireRegistration and self.allowDemoUser:
            raise ValueError(
                "Demo users are intended for registration only. On non-registration servers,"
                + " everyone is a demo user. Modify the configuration file"
                + " to remove the allowDemoUser option."
            )

        self.mailServer = (
            MailServer(rawMailServer, externalURL=externalURL)  # type: ignore
            if self.requireActivation
            else None
        )

        rawDatabase = rawUserManagement.get("database")
        if not rawDatabase and self.requireRegistration:
            raise ValueError(
                "Missing database configuration. Please check the configuration file."
            )

        self.database = (
            DatabaseConfig(rawDatabase) if self.requireRegistration else None  # type: ignore
        )

        # Start a background task to delete the user folders at a given interval
        self._deleteUserFoldersInterval()

    def _deleteUserFoldersInterval(self) -> None:
        """
        Deletes user folders at a given interval

        :param interval: The interval in days to delete the user folders
        """

        if self.requireRegistration or self.deleteInterval == 0:
            return

        # Start a background task to delete the user folders at a given interval
        def removeFolders():
            for user in os.listdir(self.appSupportDir):
                userPath = os.path.join(self.appSupportDir, user)

                # Convert the folder creation time to elapsed time
                folderAge = datetime.datetime.now() - datetime.datetime.fromtimestamp(
                    os.path.getctime(userPath)
                )

                # Convert the folder age to seconds
                folderAge = folderAge.days

                # If the folder is older than the interval, delete it
                if folderAge < self.deleteInterval:
                    continue

                logging.getLogger("Horus").info(
                    "Deleting old anonymuous user folder: %s", userPath
                )
                shutil.rmtree(userPath)

        # If the server just booted up, delete the folders
        removeFolders()

        scheduler = BackgroundScheduler()
        scheduler.add_job(removeFolders, "interval", days=self.deleteInterval)
        scheduler.start()

        # Shut down the scheduler when the app exits
        atexit.register(lambda: scheduler.shutdown())  # pylint: disable=unnecessary-lambda


class WebAppManager:
    """
    Loads the horus.config.js file which contains information about the server setup
    """

    # Raw config data
    rawConfig: Dict[str, Any]

    # Parsed config data
    host: str
    """
    The host to use for the server
    """

    port: int
    """
    The port to use for the server
    """

    externalURL: str
    """
    External URL to generate links to
    """

    appName: str
    """
    The name of the Web App
    """

    companyName: str
    """
    The name of your company to be displayed in the Web App
    """

    allowRemotes: bool
    """
    Whether to allow remote connections or only local
    """

    userManagement: UserManagement
    """
    User management information for the server such as the app support directory,
    whether registration is required, and whether activation is required
    """

    # Database
    db: Optional[Database] = None
    """
    SQL interface for the user management system
    """

    # Config file path
    HORUS_CONFIG_FILE = "horus.config.json"

    def __init__(self) -> None:
        self.readConfig()

    def readConfig(self) -> None:
        """
        Reads the horus.config.js file and stores the information in the class
        """

        with open(self.HORUS_CONFIG_FILE, "r", encoding="utf-8") as file:
            self.rawConfig: Dict[str, Any] = json.load(file)

        self.host = self.rawConfig.get("host", "localhost")
        self.port = self.rawConfig.get("port", 5000)
        self.externalURL = self.rawConfig.get("externalURL", None)
        self.appName = self.rawConfig.get("appName", "Horus")
        self.companyName = self.rawConfig.get("companyName", "Horus")
        self.allowRemotes = self.rawConfig.get("allowRemotes", True)

        if not self.externalURL:
            raise ValueError("Missing external URL. Please check the configuration file.")

        # Instantiate the user management object
        rawUserManagement = self.rawConfig.get("userManagement")
        if rawUserManagement is None:
            raise ValueError(
                "Missing user management configuration. Please check the configuration file."
            )

        self.userManagement = UserManagement(rawUserManagement, self.externalURL)

    def startDatabase(self) -> None:
        """
        Creates the user database
        """

        if not self.userManagement.requireRegistration:
            return

        logging.getLogger("Horus").info("Starting database...")

        if not self.userManagement.database:
            raise ValueError(
                "Missing database configuration. Please check the configuration file."
            )

        # Create the database
        self.db = Database(self)
