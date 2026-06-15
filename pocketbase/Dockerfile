FROM alpine:3.19

ARG PB_VERSION=0.22.23

RUN apk add --no-cache curl ca-certificates unzip && \
    curl -fsSL \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
      -o /tmp/pb.zip && \
    unzip /tmp/pb.zip pocketbase -d /app && \
    rm /tmp/pb.zip && \
    chmod +x /app/pocketbase

VOLUME /pb_data

EXPOSE 8090

CMD ["/app/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
