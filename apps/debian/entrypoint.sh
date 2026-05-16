#!/bin/bash
set -e

SSH_USER="${SSH_USER}"
SSH_PASSWORD="${SSH_PASSWORD}"

# Create user only if it doesn't exist
if ! id -u "$SSH_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$SSH_USER"
    usermod -aG sudo "$SSH_USER"
fi

# Always update the password (picks up env var changes on restart)
echo "$SSH_USER:$SSH_PASSWORD" | chpasswd

# Ensure sshd runtime dir exists
mkdir -p /run/sshd

exec /usr/sbin/sshd -D
