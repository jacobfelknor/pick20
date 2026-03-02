#!/bin/bash

# exit when any command fails
set -e

printf "\033[0;34mCreating virtual environment and installing dependencies...\033[0m\n"
# NOTE: use the --no-dev flag to skip installing development dependencies
uv sync --frozen --no-dev
printf "\033[0;32m...done\033[0m\n"

printf "\033[0;34mRunning Django migrations....\033[0m\n"
uv run ./manage.py migrate
printf "\033[0;32m...done\033[0m\n"

printf "\033[0;34mCollecting staticfiles....\033[0m\n"
uv run ./manage.py collectstatic --noinput
printf "\033[0;32m...done\033[0m\n"

exec "uv" "run" "--frozen" "--no-dev" "$@"
