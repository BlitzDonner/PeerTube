# Blitz & Donner Fork von PeerTube

Fork von `Chocobozzz/PeerTube` für video.blitzdonner.swiss. Enthält genau eine Änderung
(Aufgabe #A1L, Upstream-Issue #7262): **Thumbnails im Seitenverhältnis des Videos**.

## Die Änderung

- Neues Thumbnail-Seitenverhältnis `'original'`. In `thumbnails.sizes` ist bei diesem Wert
  `width`/`height` ein Begrenzungsrahmen; die echte Grösse folgt dem Video
  (9:16 im Rahmen 1920 ergibt 1080x1920). Default-Konfig: Rahmen 480 und 1920.
- Erzeugung aus dem Video zieht für `'original'` ein eigenes Standbild (kein Rand, kein
  Beschnitt). Die bisherigen 16:9-Thumbnails bleiben unverändert, `thumbnailPath` und
  `previewPath` der API ebenfalls.
- Die API liefert die neuen Bilder im Feld `thumbnails` mit `aspectRatio: 'original'`.
- Player/Embed: Das Poster nimmt das `'original'`-Bild, sonst wie bisher 16:9.
- Playlists bekommen keine `'original'`-Grössen.
- Nachziehen bestehender Videos: `npm run create-original-thumbnails -- --all-videos
  [--dry-run] [--limit N] [--force]` (Logik im Kopf von `server/scripts/create-original-thumbnails.ts`).

Branch-Schema: `bd/<upstream-tag>-hochformat`, Image-Tag `blitzdonner/peertube:<upstream-tag>-bd<n>`.

## Bei jedem PeerTube-Update neu aufsetzen

```bash
cd /Users/maxgilgen/Enterprise/worktrees/bd-intern-peertube-fork
git fetch upstream tag vX.Y.Z --no-tags
git checkout -b bd/vX.Y.Z-hochformat vX.Y.Z
git cherry-pick <commits von bd/<alter-tag>-hochformat, die nicht Upstream sind>
# Konflikte sind nur in server/core/lib/thumbnail.ts und
# client/src/standalone/player/src/peertube-player.ts zu erwarten
corepack pnpm install --frozen-lockfile --ignore-scripts
npx tsc -b server/tsconfig.json && npx tsc -b packages/tests/tsconfig.json
npx mocha --exit packages/tests/dist/core-utils/image.js
(cd client && npx tsc --noEmit -p src/standalone/player/tsconfig.json)
git push -u origin bd/vX.Y.Z-hochformat
```

Ist die Änderung upstream gemerged, entfällt der Fork: zurück auf `chocobozzz/peertube:<tag>`.

## Image bauen (auf dem bd-studio, arm64)

```bash
cd ~/peertube-fork-build && git fetch origin && git checkout origin/bd/vX.Y.Z-hochformat
docker build -f support/docker/production/Dockerfile -t blitzdonner/peertube:vX.Y.Z-bd1 .
```

## Deploy und Rückweg

In `~/peertube/docker-compose.yaml` steht `image: chocobozzz/peertube:${PEERTUBE_VERSION}`.
Deploy: vorher DB-Dump und Kopie von `docker-compose.yaml`, `.env` und
`docker-volume/config/`, dann die Image-Zeile auf `blitzdonner/peertube:vX.Y.Z-bd1`
setzen und `docker compose up -d peertube`.
Rückweg: Image-Zeile zurück auf `chocobozzz/peertube:${PEERTUBE_VERSION}`,
`docker compose up -d peertube`. Keine DB-Migration, die neuen Thumbnails sind gewöhnliche
Zeilen in `thumbnail` (`aspectRatio = 'original'`); das offizielle Image ignoriert sie
beim Anzeigen, sie stören nicht.

## AGPL-Quellenhinweis

Die Instanzbeschreibung auf video.blitzdonner.swiss verlinkt den laufenden Quellcode
(Branch dieses Forks). Bei jedem neuen Branch `bd/<tag>-hochformat` den Link dort nachführen
(Administration, Konfiguration, Instanzbeschreibung).

## Offen beim nächsten Update: schlankes Image (LAAN M1)

`v8.2.4-bd1` ist 4,13 GB (offiziell 2,89 GB). Ein Versuch mit `ALREADY_BUILT=1` ergab 4,56 GB,
vermutlich weil Build-Reste im Kontext mitkopiert wurden. Beim nächsten Update: aus einem
sauberen Klon bauen, nur `dist/` und `client/dist/` ergänzen, `.dockerignore` prüfen, Grösse
gegen das offizielle Image vergleichen.
