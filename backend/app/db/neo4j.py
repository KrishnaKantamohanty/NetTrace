import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("nettrace.neo4j")

try:
    from neo4j import GraphDatabase, Driver
    NEO4J_AVAILABLE = True
except ImportError:
    GraphDatabase = None
    Driver = None
    NEO4J_AVAILABLE = False
    logger.warning("neo4j driver package is not installed. Running in NetworkX graph mode.")

class Neo4jConnector:
    def __init__(self):
        self.driver: Optional[Any] = None
        self.is_connected: bool = False
        self._init_connection()

    def _init_connection(self):
        if not settings.USE_NEO4J:
            logger.info("USE_NEO4J is disabled. Operating in NetworkX in-memory mode.")
            return

        if not NEO4J_AVAILABLE:
            logger.warning("Neo4j driver not available. Operating in NetworkX mode.")
            self.is_connected = False
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
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:PhoneNumber) REQUIRE p.number IS UNIQUE")
                session.run("CREATE INDEX IF NOT EXISTS FOR (p:PhoneNumber) ON (p.case_id)")
                session.run("CREATE INDEX IF NOT EXISTS FOR ()-[r:COMMUNICATED]-() ON (r.case_id)")
                logger.info("Neo4j constraints and indices initialized.")
        except Exception as e:
            logger.error(f"Error creating Neo4j schema: {e}")

    def clear_case_graph(self, case_id: str):
        """Cleans up all nodes and relationships associated with a specific case."""
        if not self.is_connected or not self.driver:
            return False
        try:
            with self.driver.session() as session:
                session.run(
                    "MATCH (p:PhoneNumber {case_id: $case_id}) DETACH DELETE p",
                    case_id=case_id
                )
                session.run(
                    "MATCH ()-[r:COMMUNICATED {case_id: $case_id}]-() DELETE r",
                    case_id=case_id
                )
            logger.info(f"Cleared Neo4j graph nodes for case {case_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to clear case graph in Neo4j for {case_id}: {e}")
            return False

    def close(self):
        if self.driver:
            self.driver.close()
            self.is_connected = False

    def get_session(self):
        if self.is_connected and self.driver:
            return self.driver.session()
        return None

neo4j_client = Neo4jConnector()
