#!/bin/bash

yum install docker sqlite -y

usermod -a -G docker ec2-user

systemctl enable docker
systemctl start docker

mkdir /home/ec2-user/chroma-storage
chown ec2-user:ec2-user /home/ec2-user/chroma-storage

docker pull chromadb/chroma

docker run -d -p 8000:8000 -e CHROMA_SERVER_AUTH_CREDENTIALS_PROVIDER="chromadb.auth.token.TokenConfigServerAuthCredentialsProvider" -e CHROMA_SERVER_AUTH_PROVIDER="chromadb.auth.token.TokenAuthServerProvider" -e CHROMA_SERVER_AUTH_CREDENTIALS="sk-mytoken" -e CHROMA_SERVER_AUTH_TOKEN_TRANSPORT_HEADER="X_CHROMA_TOKEN" -v /home/ec2-user/chroma-storage/:/chroma/chroma/ chromadb/chroma
