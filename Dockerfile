# Builds room-viewer from the repo root: the app imports README.md, docs/images,
# the bfl-challenge images and labs_prompts from outside its own folder.
FROM node:22-alpine AS build
WORKDIR /app
COPY room-viewer/package.json room-viewer/package-lock.json room-viewer/
RUN cd room-viewer && npm ci
COPY README.md ./
COPY docs ./docs
COPY bfl-challenge ./bfl-challenge
COPY labs_prompts ./labs_prompts
COPY room-viewer ./room-viewer
RUN cd room-viewer && npm run build

FROM nginx:alpine
COPY --from=build /app/room-viewer/dist /usr/share/nginx/html
EXPOSE 80
