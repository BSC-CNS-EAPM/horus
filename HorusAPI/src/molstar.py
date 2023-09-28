from .utils import SingletonMeta


class MolstarAPI(metaclass=SingletonMeta):
    def __init__(self, socketio) -> None:
        self.socketio = socketio

    def addPDB(self, pdb: str, label: str = "PDB") -> None:
        """
        Adds the given PDB string to Mol*
        """

        data = {"pdb": pdb, "label": label}

        self.socketio.emit("loadPDB", data)
