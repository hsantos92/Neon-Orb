#!/usr/bin/env bash
set -euo pipefail
app_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$app_dir"
exec "$app_dir/node_modules/electron/dist/electron" "$app_dir" --ozone-platform=wayland "$@"
