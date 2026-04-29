#!/bin/bash
source ~/.nvm/nvm.sh
nvm use 22 > /dev/null 2>&1
exec vitest "$@"
