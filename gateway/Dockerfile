# Base images are pinned by digest: tags are mutable, so the same Dockerfile could
# build a different image. To update, take the new digest from
# `docker buildx imagetools inspect <image>`
# Build stage: compile the Angular app with Node.js
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /src

# Install dependencies first: this layer stays cached until the package files change
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Runtime stage: nginx serves the compiled app and forwards backend calls
FROM nginx:1.30-alpine@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951 AS runtime
COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/game-explorer/browser /usr/share/nginx/html
EXPOSE 80
