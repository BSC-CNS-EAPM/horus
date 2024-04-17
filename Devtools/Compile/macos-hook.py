import sys
import os

if sys.platform == "darwin":
    os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
    os.environ["DISABLE_SPRING"] = "YES"

    os.putenv("OBJC_DISABLE_INITIALIZE_FORK_SAFETY", "YES")
    os.putenv("DISABLE_SPRING", "YES")

    os.system("export OBJC_DISABLE_INITIALIZE_FORK_SAFETY='YES'")
    os.system("export DISABLE_SPRING='YES'")
