FROM python:3.14-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.14-slim
WORKDIR /app
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=8080

COPY --from=build /usr/local/lib/python3.14/site-packages/ /usr/local/lib/python3.14/site-packages/
COPY . .

EXPOSE 8080

CMD ["python", "run.py"]
