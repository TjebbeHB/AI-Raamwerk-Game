# Back-up: The Golem Below 2.1 (top-down voxel)

Deze map bevat de volledige vorige versie van het spel (top-down voxelexpeditie met veertien poorten, het Engelstalige vijfkamer-avontuur via `/?story` en de oorspronkelijke workshop op `/workshop.html`), zoals die stond vóór de 3D-herbouw.

## Starten

Vanuit deze map, met de `node_modules` van de hoofdmap:

```bash
cd backup/golem-below-2.1
PORT=5174 GOLEM_DATA_FILE=../../data/golem-sessions-2.1.json node scripts/build.cjs --client && PORT=5174 GOLEM_DATA_FILE=../../data/golem-sessions-2.1.json node server.js
```

Open daarna `http://localhost:5174`.
