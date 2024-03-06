import os
import boto3
import json
import PyPDF2
import shortuuid
import urllib
from datetime import datetime
from aws_lambda_powertools import Logger

DOCUMENT_TABLE = os.environ["DOCUMENT_TABLE"]
SESSION_TABLE = os.environ["SESSION_TABLE"]
QUEUE_URL = os.environ["QUEUE_URL"]
BUCKET_NAME = os.environ["BUCKET_NAME"]

ddb = boto3.resource("dynamodb")
document_table = ddb.Table(DOCUMENT_TABLE)
session_table = ddb.Table(SESSION_TABLE)

sqs = boto3.client("sqs")
s3 = boto3.client("s3")

logger = Logger()

@logger.inject_lambda_context(log_event=True)
def handler(event, context):
    key = urllib.parse.unquote_plus(event["Records"][0]["s3"]["object"]["key"])
    split = key.split("/")
    user_id = split[0]
    file_name = split[1]

    document_id = shortuuid.uuid()

    s3.download_file(BUCKET_NAME, key, f"/tmp/{file_name}")

    with open(f"/tmp/{file_name}", "rb") as f:
        reader = PyPDF2.PdfReader(f)
        pages = str(len(reader.pages))

    conversation_id = shortuuid.uuid()

    timestamp = datetime.utcnow()
    timestamp_str = timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    document = {
        "userId": user_id,
        "documentId": document_id,
        "filename": file_name,
        "created": timestamp_str,
        "pages": pages,
        "filesize": str(event["Records"][0]["s3"]["object"]["size"]),
        "docStatus": "UPLOADED",
        "conversations": [],
    }

    conversation = {"conversationId": conversation_id, "created": timestamp_str}
    document["conversations"].append(conversation)

    document_table.put_item(Item=document)

    conversation = {"SessionId": conversation_id, "History": []}
    session_table.put_item(Item=conversation)

    message = {
        "documentId": document_id,
        "key": key,
        "user": user_id,
    }
    sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(message))
