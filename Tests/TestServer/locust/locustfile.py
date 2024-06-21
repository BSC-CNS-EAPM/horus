from locust import HttpUser, task, between


class HorusUser(HttpUser):
    @task(2)
    def test_horus_server_gets(self):
        self.client.get("/")
        self.client.get("/api/plugins/list")
        self.client.get("/api/plugins/listpages")
        self.client.get("/api/plugins/listblocks")
        self.client.get("/api/internal")
        self.client.get("/api/templates")
        self.client.get("/api/recentflows")
        self.client.get("/api/version")
        self.client.get("/api/remotes/list")
        self.client.get("/api/remotes/names")
        self.client.get("/api/settings")

    # Quite heavy plugin. Its recommended to test it for the generation of PDBs
    @task(1)
    def test_horus_server_xna_plugins(self):

        genera_xna = {
            "sequence1": "AAAAGGGGTTTT",
            "sequence2": None,
            "dnaType1": "DNA",
            "dnaType2": None,
            "singleStrand": True,
        }

        self.client.post("/plugins/pages/xna-hub.xnaeditor/api/sequence", json=genera_xna)
