#!/bin/bash

# WZOS Build Script
# Supports cross-compilation for different architectures

set -e

BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
DIST_DIR="backend/dist"

echo "🚀 Building WZOS Linux Panel..."

# Build Frontend
echo "📦 Building Angular frontend..."
cd $FRONTEND_DIR
ng build --configuration production
cd ..

# Copy frontend dist to backend
echo "📋 Copying frontend dist to backend..."
rm -rf $DIST_DIR
cp -r $FRONTEND_DIR/dist $DIST_DIR

# Build Backend
echo "🔧 Building Golang backend..."
cd $BACKEND_DIR

# Default build
echo "Building for linux/amd64..."
GOOS=linux GOARCH=amd64 go build -o ../wzos-panel-linux-amd64 .

# ARM64 build (if cross-compilation is supported)
echo "Building for linux/arm64..."
GOOS=linux GOARCH=arm64 go build -o ../wzos-panel-linux-arm64 .

cd ..

echo "✅ Build completed successfully!"
echo "📁 Binaries:"
echo "   - wzos-panel-linux-amd64"
echo "   - wzos-panel-linux-arm64"
