# RagBot

This sample application demonstrates the use of text generation and analytics capabilities of LLMs to provide a chatbot capable of answering questions with context from an external PDF document. It allows a user to upload a PDF document, accompanied with the use of Langchain and Retrival Augemented Generation (RAG), to answer questions with context about the PDF document using natural language questions.

The application makes use of Amazon Bedrock it's LLMs, along with Langchain, and FAISS.

The [blog post on the AWS Serverless Blog](https://aws.amazon.com/blogs/compute/building-a-serverless-document-chat-with-aws-lambda-and-amazon-bedrock/) was used a a reference for this application.

[This repo](https://github.com/aws-samples/websocket-api-cognito-auth-sample/) was used for the websocket Lambda authorizer function

## Directory Structure

- `notebook` - this folder contains Jupyter Notebook scripts that can be used to walk through each implementation of various vector stores like ChromaDB, FAISS, and PGVector
- `backend` and `frontend` - these folders contain the RagBot application built with CDK and ReactJS Vite
- `wip.backend` - this folder contains a WIP CDK application using a persistent Vector DB like Amazon Aurora Postgres

## Getting Started

- Copy the `/backend/.env.example` file to `/backend/.env` and set the `CERTIFICATE_ANR` and `SENDER_EMAIL` to a verified email address. This will be the sender address for Cognito verification emails.
- In the `backend` folder run `npm run deploy` deploy the app.
- Copy the outputs from the CloudFormation stack to set the Vite environment vairables in the `/frontend/.env.example` file (make a copy of this to `/frontend/.env`)
- Redeploy the application

## TODO

- With multiple conversations, the response always defaults to the previous conversationId when the websocket receives a message
