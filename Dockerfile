FROM node:lts-alpine3.24
RUN corepack enable
RUN apk add --update curl python3 make g++ && rm -rf /var/cache/apk/*
RUN npm install -g @agegr/pi-web@latest
USER node

ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pi-web", "-p", "7777", "-H", "0.0.0.0", "--no-open"]
