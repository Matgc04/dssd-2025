import requests

BONITA_BASE = "http://localhost:8080/bonita"

class Bonita:
    def __init__(self):
        self.s = requests.Session()
        self.api_token = None

    def login(self):
        # login técnica (usuario “API”) -> cookie de sesión
        r = self.s.post(f"{BONITA_BASE}/loginservice", data={
            "username": 'walter.bates',
            "password": 'bpm',
            "redirect": "false"
        })
        r.raise_for_status()
        self.api_token = self.s.cookies.get("X-Bonita-API-Token")
        self.s.headers.update({"X-Bonita-API-Token": self.api_token})

    def _ensure_login(self):
        if not self.api_token:
            self.login()

    def get_enabled_process_id(self):
        self._ensure_login()
        r = self.s.get(
            f"{BONITA_BASE}/API/bpm/process",
            params={"f": [f"name=ProjectPlanning", "activationState=ENABLED"]}
        )
        r.raise_for_status()
        return r.json()[0]["id"]

    def start_case(self, variables):
        """variables: lista de dicts [{name, value, type}]"""
        self._ensure_login()
        pid = self.get_enabled_process_id()
        r = self.s.post(
            f"{BONITA_BASE}/API/bpm/process/{pid}/instantiation",
            json={"variables": variables}
        )
        r.raise_for_status()
        return r.json()["caseId"]

    def set_variable(self, case_id, name, value, vtype):
        self._ensure_login()
        payload = {"value": value, "type": vtype, "name": name}
        r = self.s.put(
            f"{BONITA_BASE}/API/bpm/caseVariable/{case_id}/{name}",
            json=payload
        )
        r.raise_for_status()
        return True

    def get_variable(self, case_id, name):
        self._ensure_login()
        r = self.s.get(f"{BONITA_BASE}/API/bpm/caseVariable/{case_id}/{name}")
        r.raise_for_status()
        return r.json()
