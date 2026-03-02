FROM python:3.11-bookworm as pick20_base

ARG USERNAME=pick20
ARG USER_UID=1000
ARG USER_GID=$USER_UID

ENV PICK20_HOME="/home/pick20"
ENV PICK20_WORKDIR="/home/workdir"
ENV PICK20_DATA_DIR="${PICK20_WORKDIR}/pick20-data"
ENV UV_CACHE_DIR="${PICK20_WORKDIR}/.uv_cache"

RUN mkdir -p ${PICK20_WORKDIR} && chown -R ${USER_UID}:${USER_GID} ${PICK20_WORKDIR}

# do NOT install virtual environment during build step, only the tools necessary to create one
# we want to store the virtual environment externally to the container to reduce container size
RUN pip install --no-compile --no-cache-dir uv==0.10.0

# install other OS level utilities required by our server
RUN apt-get update && apt-get install --no-install-recommends -y \
    # required dependencies
    bash-completion \
    sudo \
    # clean up after ourselves to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


# Create our non-root user for vscode dev container
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    --home $PICK20_HOME --create-home --skel /etc/skel --shell /bin/bash \
    #
    # [Optional] Add sudo support. Omit if you don't need it.
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# this var allow us to externally mount bash and ipython histories for convenience between container
# the directory is created on demand during the entrypoint
ENV HISTFILE="${PICK20_DATA_DIR}/bash/.bash_history"
ENV IPYTHONDIR="${PICK20_DATA_DIR}/ipython"

FROM pick20_base as dev

# setup entrypoint
COPY docker/development/entrypoint.sh /bin/entrypoint.sh
RUN chmod +x /bin/entrypoint.sh

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN \
    apt-get update \
    && apt-get install --no-install-recommends -y \
    # required dev deps,
    unzip vim bat exa \
    # Install packages required for frontend development
    yarn nodejs npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Update to the latest stable node version
RUN npm install -g n --ignore-scripts && n lts

USER $USERNAME

RUN \
    # setup dev aliases
    echo "alias ll='exa -aFbghHliS'" >> ${PICK20_HOME}/.bashrc \
    && echo "alias cat='batcat -pp'" >> ${PICK20_HOME}/.bashrc \
    && echo 'export PS1="\[\033[38;5;10m\]\u@\h\[$(tput sgr0)\]:\[$(tput sgr0)\]\[\033[38;5;12m\]\w\[$(tput sgr0)\]\\$ \[$(tput sgr0)\]"' >> ${PICK20_HOME}/.bashrc

WORKDIR ${PICK20_WORKDIR}
EXPOSE 8000

ENTRYPOINT [ "/bin/bash", "entrypoint.sh" ]
# when running the container by itself, just dump us to a shell. This will be overridden in the compose files
# to start a development server
CMD ["bash"]

FROM pick20_base as pick20_backend

WORKDIR /pick20_backend_src

# for the production build, we need to copy over the source code because it will not be mounted
# from the development directory
COPY src/backend /pick20_backend_src
COPY pyproject.toml /pick20_backend_src/pyproject.toml
COPY uv.lock /pick20_backend_src/uv.lock

# setup entrypoint
COPY docker/production/entrypoint.sh /bin/entrypoint.sh
RUN chmod +x /bin/entrypoint.sh

ENTRYPOINT [ "/bin/bash", "entrypoint.sh" ]
CMD ["gunicorn", "pick20.wsgi:application", "-b", "0.0.0.0:8000"]

FROM node:24-alpine as pick20_frontend_builder
COPY src/frontend /pick20_frontend
WORKDIR /pick20_frontend
RUN \
    npm install \
    && npm run build

FROM nginx:stable as pick20_frontend

# since we can compile the frontend into a static site, we can just use NGINX to serve it

RUN \
    rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /var/www/pick20

COPY docker/production/nginx-conf.d /etc/nginx/conf.d
COPY --from=pick20_frontend_builder /pick20_frontend/dist /var/www/pick20