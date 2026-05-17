# Lightweight Rust-based Static Web Server
FROM joseluisq/static-web-server:2-alpine

# Set the directory where SWS will look for files
ENV SERVER_ROOT=/public

# Redirect all 404 requests to index.html
ENV SERVER_PAGE_FALLBACK=/public/index.html

# Enable automatic Gzip and Brotli compression for faster load times
ENV SERVER_COMPRESSION=true

# Set aggressive caching for static assets, but avoid caching the index.html
ENV SERVER_CACHE_CONTROL_HEADERS=true


# Copy your pre-built Vite app from the Nx output folder
COPY dist/apps/client /public

# Expose port 80 (default for SWS)
EXPOSE 80
