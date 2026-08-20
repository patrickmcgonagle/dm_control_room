# Security

DM Control Room is a local tabletop utility intended for a trusted home/private LAN.

- There is currently no authentication or authorization layer.
- Do not port-forward the app or expose port 8765 directly to the public internet.
- `data/state.json` may contain a Philips Hue application key and campaign information; it is ignored by Git.
- `data/library_config.json` may contain local or network filesystem paths; it is ignored by Git.
- User media and imported character content should remain local unless you have redistribution rights.

If you publish a fork, keep secrets and user-generated content out of commits and release archives.
