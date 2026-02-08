#!/bin/bash

# provide a helper script to set up anything necessary within containers before development can start

printf "\033[0;34mCreating virtual environment and installing dependencies...\033[0m\n"
uv sync
printf "\033[0;32m...done\033[0m\n"

printf "\033[0;34mRunning Django migrations....\033[0m\n"
SCRIPT_DIR=$(realpath "$(dirname "${BASH_SOURCE[0]}")")
uv run "$SCRIPT_DIR"/manage.py migrate
printf "\033[0;32m...done\033[0m\n"

# printf "\033[0;34mCreating test users....\033[0m\n"
# SCRIPT_DIR=$(realpath "$(dirname "${BASH_SOURCE[0]}")")
# uv run "$SCRIPT_DIR"/manage.py createtestusers
# printf "\033[0;32m...done\033[0m\n"
