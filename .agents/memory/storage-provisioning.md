---
name: App Storage provisioning
description: Replit App Storage requires a provisioned default bucket before the SDK can provide cloud persistence.
---

The `@replit/object-storage` package does not create an App Storage bucket by itself. If the sidecar's default-bucket response has no bucket ID, the cloud store is not provisioned; use the App Storage tool in the Replit Project Editor before treating submissions as durable across deployments.

**Why:** This project had the SDK installed and a responding sidecar, but no default bucket ID. The Agent-visible integrations did not include an App Storage setup connector.

**How to apply:** Check only bucket availability metadata before changing the contact store. Until a bucket exists, keep the current fallback operational and disclose that local writes may not persist across deployments. Do not initialize an empty cloud object at startup when local submissions may already exist.