FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server server
COPY docs docs
ENV PORT=8080 WORLD_DB=/data/world.sqlite3
VOLUME /data
EXPOSE 8080
CMD ["python","server/app.py"]
