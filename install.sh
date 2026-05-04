#!/usr/bin/env sh
# install recall: shared memory for ai agents on this mac.
# pulls the latest github release, builds it, links a `recall` binary into ~/.local/bin.
set -eu

REPO="venkateshamatam/recall"
INSTALL_DIR="${RECALL_INSTALL_DIR:-$HOME/.local/share/recall}"
BIN_DIR="${RECALL_BIN_DIR:-$HOME/.local/bin}"

err() { printf "error: %s\n" "$*" >&2; exit 1; }
note() { printf "%s\n" "$*"; }

# need node 20+. better-sqlite3 ships native bindings that bun can't load yet.
command -v node >/dev/null 2>&1 || err "node not found. install node 20+ from https://nodejs.org and retry."
NODE_MAJOR=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')
[ "$NODE_MAJOR" -ge 20 ] || err "node $NODE_MAJOR detected; recall needs >= 20."

# pick a download tool that's already on a fresh mac.
if command -v curl >/dev/null 2>&1; then
  DL() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  DL() { wget -q "$1" -O "$2"; }
else
  err "neither curl nor wget on PATH."
fi

# resolve the latest release tag via github's redirect. no auth, no jq.
note "→ resolving latest release..."
TAG=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" | sed -E 's|.*/tag/||')
[ -n "$TAG" ] || err "could not resolve latest release. is the repo public yet?"
note "  found $TAG"

TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$TAG.tar.gz"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

note "→ downloading $TAG..."
DL "$TARBALL_URL" "$TMP/recall.tgz"
tar -xzf "$TMP/recall.tgz" -C "$TMP"
SRC=$(find "$TMP" -maxdepth 1 -type d -name 'recall-*' | head -1)
[ -d "$SRC" ] || err "extracted archive looks empty."

# better-sqlite3, sqlite-vec, and transformers.js have native parts. let npm
# resolve the right prebuilt binaries for this host instead of shipping them.
note "→ installing dependencies (one time, ~30s)..."
mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR"/*
cp -R "$SRC"/* "$INSTALL_DIR"/
cd "$INSTALL_DIR"
command -v npm >/dev/null 2>&1 || err "npm not found (it ships with node, try \`brew install node\`)."
# install runtime + a couple of build deps so we can compile from source.
npm install --silent --no-audit --no-fund

note "→ building..."
npm run build --silent

# drop devDependencies after build.
npm prune --omit=dev --silent --no-audit --no-fund 2>/dev/null || true

mkdir -p "$BIN_DIR"
chmod +x "$INSTALL_DIR/dist/cli.js"
ln -sf "$INSTALL_DIR/dist/cli.js" "$BIN_DIR/recall"

note ""
note "✓ recall $TAG installed."
note "  binary: $BIN_DIR/recall"
note "  files:  $INSTALL_DIR"
note ""
case ":$PATH:" in
  *":$BIN_DIR:"*) note "next: \`recall init\`" ;;
  *) note "$BIN_DIR is not on your PATH yet. add this to ~/.zshrc or ~/.bashrc:"
     note ""
     note "  export PATH=\"$BIN_DIR:\$PATH\""
     note ""
     note "then open a new shell and run \`recall init\`." ;;
esac
