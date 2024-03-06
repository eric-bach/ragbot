import os
import boto3
import json
from aws_lambda_powertools import Logger

BUCKET_NAME = os.environ["BUCKET_NAME"]
DOCUMENT_TABLE = os.environ["DOCUMENT_TABLE"]
SESSION_TABLE = os.environ["SESSION_TABLE"]

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")
document_table = ddb.Table(DOCUMENT_TABLE)
session_table = ddb.Table(SESSION_TABLE)

logger = Logger()

@logger.inject_lambda_context(log_event=True)
def handler(event, context):
    event_body = json.loads(event["body"])
    file_name = event_body["fileName"]
 
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    document_id = event["pathParameters"]["documentId"]
    conversation_id = event["pathParameters"]["conversationId"]

    document_table.delete_item(Key={"userId": user_id, "documentId": document_id})
    
    session_table.delete_item(Key={"SessionId": conversation_id})

    objects = s3.list_objects(Bucket=BUCKET_NAME, Prefix=f"{user_id}/{file_name}")
    for item in objects.get("Contents"):
        s3.delete_object(Bucket=BUCKET_NAME, Key=item["Key"])
    s3.delete_object(Bucket=BUCKET_NAME, Key=f"{user_id}/{file_name}")
    
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
                "documentId": document_id,
                "conversationId": conversation_id,
            },
            default=str,
        ),
    }
