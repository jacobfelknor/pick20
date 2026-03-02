#!/bin/bash

# exit when any command fails
set -e

# developer nicities to share between containers
mkdir -p $PICK20_DATA_DIR/bash
mkdir -p $PICK20_DATA_DIR/ipython

# Launch the CMD *after* the ENTRYPOINT completes
exec "uv" "run" "--frozen" "--no-dev" "$@"