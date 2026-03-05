# Use official Bun image (matches bun.lock in yieldprop-workflow)
FROM oven/bun:1.2-alpine

# Install bash and other system tools
RUN apk add --no-cache bash curl jq tzdata

# Install the CRE CLI globally (requires npm/node for global install)
RUN apk add --no-cache nodejs npm && npm install -g @chainlink/cre-cli 2>/dev/null || true

WORKDIR /app/cre-workflow

# Copy workflow package files and install with Bun
COPY cre-workflow/yieldprop-workflow/package.json cre-workflow/yieldprop-workflow/bun.lock* ./yieldprop-workflow/
WORKDIR /app/cre-workflow/yieldprop-workflow
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy the workflow source files
WORKDIR /app/cre-workflow
COPY cre-workflow/yieldprop-workflow ./yieldprop-workflow
COPY cre-workflow/project.yaml ./project.yaml
COPY cre-workflow/secrets.yaml ./secrets.yaml

# Copy and prepare the execution script
COPY cre-workflow/run-workflow-cron.sh ./run-workflow-cron.sh
RUN chmod +x ./run-workflow-cron.sh

# The container will run the cron script by default
CMD ["./run-workflow-cron.sh"]
