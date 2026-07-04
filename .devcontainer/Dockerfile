# ============================================================
# Forgotten Letters — Dev Container
# Base: Debian Bookworm slim + Node 22 LTS
# ============================================================
FROM debian:bookworm-slim

ARG USERNAME=developer
ARG USER_UID=1000
ARG USER_GID=${USER_UID}

# Avoid interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# ── System packages ──────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget gnupg sudo git \
    zsh locales build-essential \
    && rm -rf /var/lib/apt/lists/*

# Generate locale
RUN sed -i 's/# en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8

# ── Create non-root user ────────────────────────────────────
RUN groupadd --gid ${USER_GID} ${USERNAME} \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m -s /usr/bin/zsh ${USERNAME} \
    && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${USERNAME} \
    && chmod 0440 /etc/sudoers.d/${USERNAME}

# ── Install zsh (root stage, before switching user) ──────────
COPY dependencies/install_zsh.sh /tmp/dependencies/install_zsh.sh
RUN chmod +x /tmp/dependencies/install_zsh.sh && /tmp/dependencies/install_zsh.sh

# ── Copy dependency scripts ─────────────────────────────────
COPY dependencies/ /tmp/dependencies/
RUN chmod +x /tmp/dependencies/*.sh

# ── Copy config files ───────────────────────────────────────
COPY config/ /tmp/config/

# ── Switch to non-root user ─────────────────────────────────
USER ${USERNAME}
WORKDIR /home/${USERNAME}

# ── Run user-level setup (oh-my-zsh, tools, node, etc.) ─────
COPY --chmod=755 --chown=${USER_UID}:${USER_GID} setup-user.sh /tmp/setup-user.sh
RUN /tmp/setup-user.sh

# ── Supabase CLI ─────────────────────────────────────────────
RUN curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh -s -- -b /home/${USERNAME}/.local/bin
ENV PATH="/home/${USERNAME}/.local/bin:${PATH}"

# ── Sanity CLI (installed globally via npm) ──────────────────
RUN sudo npm install -g sanity@latest

# ── Vercel CLI ───────────────────────────────────────────────
RUN sudo npm install -g vercel@latest

# ── Working directory ────────────────────────────────────────
WORKDIR /workspace

# ── Entrypoint ───────────────────────────────────────────────
COPY --chmod=755 --chown=${USER_UID}:${USER_GID} entrypoint.sh /tmp/entrypoint.sh
ENTRYPOINT ["/tmp/entrypoint.sh"]
CMD ["sleep", "infinity"]