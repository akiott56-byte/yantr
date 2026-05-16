#!/bin/bash
set -e

SSH_USER="${SSH_USER}"
SSH_PASSWORD="${SSH_PASSWORD}"

# Create user only if it doesn't exist
if ! id -u "$SSH_USER" &>/dev/null; then
    adduser -D -s /bin/bash "$SSH_USER"
    adduser "$SSH_USER" wheel
fi

# Always update the password
echo "$SSH_USER:$SSH_PASSWORD" | chpasswd

# Ensure sshd runtime dir exists
mkdir -p /run/sshd

exec /usr/sbin/sshd -D
