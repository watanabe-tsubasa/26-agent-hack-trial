# Cosmos DB policies

- agent_events: AI agent event log, TTL 14 days, partition key /entityId
- report_search_documents: admin RAG index, partition key /facilityId, vector path /embedding, 1536 dimensions, cosine