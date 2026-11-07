import logging
from typing import Optional
from neo4j import GraphDatabase, Driver
from app.core.config import settings

logger = logging.getLogger("nettrace.neo4j")

class Neo4jConnector:
    def __init__(self):
        self.driver: Optional[Driver] = None
        self.is_connected: bool = False
        self._init_connection()

    def _init_connection(self):
        if not settings.USE_NEO4J:
            logger.info("USE_NEO4J is false. Operating in NetworkX in-memory mode.")
            return

        try:
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            # Verify connectivity
            self.driver.verify_connectivity()
            self.is_connected = True
            logger.info(f"Successfully connected to Neo4j at {settings.NEO4J_URI}")
            self.init_schema()
        except Exception as e:
            logger.warning(f"Neo4j connection could not be established ({e}). Link analysis will run using NetworkX.")
            self.is_connected = False

    def init_schema(self):
        if not self.is_connected or not self.driver:
            return
        try:
            with self.driver.session() as session:
                # Create constraints & indexes
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:PhoneNumber) REQUIRE p.number IS UNIQUE")
                session.run("CREATE INDEX IF NOT EXISTS FOR (p:PhoneNumber) ON (p.case_id)")
                session.run("CREATE INDEX IF NOT EXISTS FOR ()-[r:COMMUNICATED]-() ON (r.case_id)")
                logger.info("Neo4j constraints and indices initialized.")
        except Exception as e:
            logger.error(f"Error creating Neo4j schema: {e}")

    def close(self):
        if self.driver:
            self.driver.close()
            self.is_connected = False

    def get_session(self):
        if self.is_connected and self.driver:
            return self.driver.session()
        return None

neo4j_client = Neo4jConnector()
