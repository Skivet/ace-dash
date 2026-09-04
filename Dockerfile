FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server/ ./server/
COPY public/ ./public/
RUN mkdir -p /app/data/results /app/data/normalized
RUN useradd -m -u 1000 ace
USER ace
ENV ACE_RESULTS_DIR=/app/data/results
ENV ACE_NORMALIZED_DIR=/app/data/normalized
ENV ACE_PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "server/server.js"]
