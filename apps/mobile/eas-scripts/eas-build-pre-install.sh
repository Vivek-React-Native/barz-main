#!/bin/bash

# Before installing dependencies, make sure the correct version of pnpm is installed globally
# If this is not set up, then dependencies will fail to install because the pnpm version is too old
npm install -g pnpm@8.6.2

echo "pnpm version"
pnpm --version

rm -drf node_modules
