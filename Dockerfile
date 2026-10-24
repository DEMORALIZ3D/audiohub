FROM python:3.12-slim
WORKDIR /app

# Install system dependencies including ffmpeg for audio handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/app ./app

# Copy pre-compiled frontend distribution
COPY backend/frontend_dist ./frontend_dist

# Set environment defaults
ENV PORT=4533
ENV DATA_DIR=/data
ENV MUSIC_DIR=/music
ENV STORAGE_MODE=stream_only

EXPOSE 4533

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4533"]
