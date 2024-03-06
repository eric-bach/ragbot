import os
import boto3
import json
from boto3.dynamodb.conditions import Key
from aws_lambda_powertools import Logger

DOCUMENT_TABLE = os.environ["DOCUMENT_TABLE"]
SESSION_TABLE = os.environ["SESSION_TABLE"]

ddb = boto3.resource("dynamodb")
document_table = ddb.Table(DOCUMENT_TABLE)
session_table = ddb.Table(SESSION_TABLE)

logger = Logger()

@logger.inject_lambda_context(log_event=True)
def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    document_id = event["pathParameters"]["documentId"]
    conversation_id = event["pathParameters"]["conversationId"]

    response = document_table.get_item(Key={"userId": user_id, "documentId": document_id})
    document = response["Item"]
    document["conversations"] = sorted(document["conversations"], key=lambda conv: conv["created"], reverse=True)

    response = session_table.get_item(Key={"SessionId": conversation_id})

    messages = response["Item"]["History"]

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps(
            {
                "conversationId": conversation_id,
                "document": document,
                "messages": messages,
            },
            default=str,
        ),
    }
