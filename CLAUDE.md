# CLAUDE.md

This project uses an **agent knowledge base** in [`agent/`](agent/agent.md).

ALWAYS read [`agent/agent.md`](agent/agent.md) first and follow its routing table to
the file relevant to your task (architecture, setup, api, components, data,
conventions, tests, errors, secrets).

Before changing a module, consult [`agent/graph/`](agent/graph/graph.md) for
dependency/impact analysis.

After making changes, keep [`agent/state.md`](agent/state.md) updated and append an ADR
to [`agent/decisions.md`](agent/decisions.md) for notable decisions. Never commit
secrets — see [`agent/secrets.md`](agent/secrets.md).
