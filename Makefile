.PHONY: all frontend backend clean run

BINARY_NAME=wzos-panel
BACKEND_DIR=backend
FRONTEND_DIR=frontend
DIST_DIR=$(BACKEND_DIR)/dist

all: frontend backend

frontend:
	@echo "📦 Building Angular frontend..."
	cd $(FRONTEND_DIR) && ng build --configuration production
	@echo "📋 Copying frontend dist to backend..."
	rm -rf $(DIST_DIR)
	cp -r $(FRONTEND_DIR)/dist $(DIST_DIR)

backend:
	@echo "🔧 Building Golang backend..."
	cd $(BACKEND_DIR) && go build -o ../$(BINARY_NAME) .

run:
	@echo "🚀 Starting development server..."
	cd $(BACKEND_DIR) && go run .

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf $(DIST_DIR)
	rm -f $(BINARY_NAME)
	rm -f wzos-panel-linux-*

build-linux-amd64:
	@echo "Building for linux/amd64..."
	cd $(BACKEND_DIR) && GOOS=linux GOARCH=amd64 go build -o ../$(BINARY_NAME)-linux-amd64 .

build-linux-arm64:
	@echo "Building for linux/arm64..."
	cd $(BACKEND_DIR) && GOOS=linux GOARCH=arm64 go build -o ../$(BINARY_NAME)-linux-arm64 .

build-all: frontend build-linux-amd64 build-linux-arm64
	@echo "✅ Build completed!"
