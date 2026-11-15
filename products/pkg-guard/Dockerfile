FROM apify/actor-node:22
COPY package*.json ./
RUN npm install --omit=dev --omit=optional --no-audit --no-fund
COPY . ./
CMD ["node", "src/actor/main.js"]
