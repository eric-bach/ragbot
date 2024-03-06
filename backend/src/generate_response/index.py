import os
import boto3
import json
from langchain.llms.bedrock import Bedrock
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain.memory import ConversationBufferMemory
from langchain_community.embeddings import BedrockEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chains import ConversationalRetrievalChain
from aws_lambda_powertools import Logger

BUCKET_NAME = os.environ["BUCKET_NAME"]
SESSION_TABLE = os.environ["SESSION_TABLE"]
TABLE_NAME = os.environ["TABLE_NAME"]

s3 = boto3.client("s3")
ddb_client = boto3.client("dynamodb")
ddb = boto3.resource("dynamodb")
table = ddb.Table(TABLE_NAME)

logger = Logger()

@logger.inject_lambda_context(log_event=True)
def handler(event, context):
    event_body = json.loads(event["body"])
    file_name = event_body["fileName"]
    human_input = event_body["prompt"]
    conversation_id = event_body["conversationId"] #event["pathParameters"]["conversationId"]
    user = event_body["userId"] #event["requestContext"]["authorizer"]["claims"]["sub"]
    paginator = ddb_client.get_paginator("scan")
    connectionIds = []

    api_gateway_management_api = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url= "https://" + event["requestContext"]["domainName"] + "/" + event["requestContext"]["stage"]
    )

    # Extend connections
    for page in paginator.paginate(TableName=TABLE_NAME):
        connectionIds.extend(page["Items"])

    s3.download_file(BUCKET_NAME, f"{user}/{file_name}/index.faiss", "/tmp/index.faiss")
    s3.download_file(BUCKET_NAME, f"{user}/{file_name}/index.pkl", "/tmp/index.pkl")

    bedrock_runtime = boto3.client(service_name="bedrock-runtime", region_name="us-east-1")

    embeddings = BedrockEmbeddings(model_id="amazon.titan-embed-text-v1", client=bedrock_runtime, region_name="us-east-1")
    llm = Bedrock(model_id="anthropic.claude-v2", client=bedrock_runtime, region_name="us-east-1")
    faiss_index = FAISS.load_local("/tmp", embeddings)

    message_history = DynamoDBChatMessageHistory(table_name=SESSION_TABLE, session_id=conversation_id, primary_key_name='SessionId')

    memory = ConversationBufferMemory(
        memory_key="chat_history",
        chat_memory=message_history,
        input_key="question",
        output_key="answer",
        return_messages=True,
    )

    qa = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=faiss_index.as_retriever(),
        memory=memory,
        return_source_documents=True,
    )

    res = qa.invoke({"question": human_input})
    logger.info(res)

    for connectionId in connectionIds:
        try:
            logger.info("Sending message to connectionId: " + connectionId["connectionId"]["S"])
            api_gateway_management_api.post_to_connection(
                ConnectionId=connectionId["connectionId"]["S"],
                Data=json.dumps({"message": res["answer"], "conversationId": conversation_id})
            )
        except Exception as e:
             logger.error(f"Error sending message to connectionId {connectionId}: {e}")

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps(res["answer"]),
    }
