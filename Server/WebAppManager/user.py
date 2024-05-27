# Important! Type your code!
import typing

# Basic python imports
import os
import datetime

# Flask login library which provides UserMixin
import flask_login


class HorusUser(flask_login.UserMixin):
    """
    User class for the web application

    It embeds the flask_login.UserMixin class to provide
    the necessary methods for the user management.
    """

    email: str
    """
    The user's email.
    """

    is_authenticated: bool
    """
    This property should return True if the user is authenticated,
    i.e. they have provided valid credentials.
    (Only authenticated users will fulfill the criteria of login_required.)
    """

    # Override the UserMixin property to use the "activated" field
    # is_active: bool
    activated: bool
    """
    This property should return True if this is an active user - 
    in addition to being authenticated,
    they also have activated their account, not been suspended,
    or any condition your application has for rejecting an account.
    Inactive accounts may not log in (without being forced of course).
    """

    @property
    def is_active(self) -> bool:
        return self.activated

    isDemo: bool = False
    """
    This property should return True if this is an anonymous user.
    (Actual users should return False instead.)
    """

    appSupportDir: str
    """
    The user's directory.
    """

    flowsDir: str
    """
    The user's flows directory.
    """

    anonymous: bool = False
    """
    For web apps that do not require registration
    """

    admin: bool
    """
    If the user is an admin
    """

    email: str
    """
    User email
    """

    id: int
    """
    User ID
    """

    registrationDate: datetime.datetime
    """
    Datetime when the user registered
    """

    lastLogin: datetime.datetime
    """
    Datetime of user's last login
    """

    group: str
    """
    User group
    """

    def __init__(self, userDict: typing.Dict[str, typing.Any], appSupportDir: str) -> None:
        """
        :param userDict: The user dictionary from the database.
        :param appSupportDir: The users directory.
        """

        id = userDict.get("id")

        if id is None:
            raise Exception("User does not have an id")

        self.id = int(id)

        email = userDict.get("email")

        if email is None:
            raise Exception("User does not have an email")

        self.email = email

        self.activated = userDict.get("activated", False)
        self.registrationDate = typing.cast(datetime.datetime, userDict.get("registration_date"))
        self.lastLogin = typing.cast(datetime.datetime, userDict.get("last_login"))
        self.admin = userDict.get("admin", False)
        self.group = userDict.get("group", 0)

        if self.email is None:
            raise Exception("User does not have an email")

        # Generate the user support directory
        self.appSupportDir = os.path.abspath(
            os.path.join(appSupportDir, self.email.split("@")[0])
        )
        self.flowsDir = os.path.join(self.appSupportDir, "flows")

        # Create the user folder if it does not exist
        if not os.path.exists(self.appSupportDir):
            os.makedirs(self.appSupportDir, exist_ok=True)

        # Same for the flows directory
        if not os.path.exists(self.flowsDir):
            os.makedirs(self.flowsDir, exist_ok=True)

        super().__init__()

    def get_id(self):  # pylint: disable=useless-parent-delegation
        """
        This method must return a str that uniquely identifies this user,
        and can be used to load the user from the user_loader callback.
        Note that this must be a str - if the ID is natively an int or
        some other type, you will need to convert it to str.
        """

        return super().get_id()

    @classmethod
    def demoUser(cls) -> "HorusUser":
        """
        Create a new demo user
        """

        demoUser = HorusUser(
            {
                "id": -1,
                "email": f"demo_{os.urandom(8).hex()}@demohorus.com",
                "activated": True,
                "registration_date": None,
                "last_login": None,
                "admin": False,
                "group": None,
            },
            "/tmp",
        )

        demoUser.isDemo = True
        demoUser.activated = True

        return demoUser

    @classmethod
    def anonymousUser(cls, appSupportDir: str, id: typing.Optional[int] = None) -> "HorusUser":
        """
        Create a new anonymous user
        """

        import random

        id = id if id is not None else random.randint(1, 1000000)

        anonyUser = HorusUser(
            {
                "id": id,
                "email": f"anonymous_{id}@anonyuser.com",
                "activated": True,
                "registration_date": None,
                "last_login": None,
                "admin": False,
                "group": None,
            },
            appSupportDir,
        )

        anonyUser.activated = True
        anonyUser.anonymous = True

        return anonyUser

    def toDict(self) -> dict[str, typing.Any]:
        """
        Convert the user to a dictionary
        """

        return {
            "id": self.id,
            "email": self.email,
            "activated": self.activated,
            "registration_date": self.registrationDate,
            "last_login": self.lastLogin,
            "admin": self.admin,
            "group": self.group,
        }
