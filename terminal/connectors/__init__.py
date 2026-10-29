from typing import Protocol

class ExchangeConnector(Protocol):
    name: str
    url: str
    def normalize(self, payload: dict) -> list[dict]: ...
