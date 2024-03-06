# https://github.com/aws-samples/rag-with-amazon-bedrock-and-pgvector/tree/main

# https://github.com/aws-samples/amazon-bedrock-workshop/tree/main/03_QuestionAnswering
# https://medium.com/@jenniferjasperse/how-to-use-postgres-with-aws-lambda-and-python-44e9d9154513
# https://medium.com/@tahir.rauf/similarity-search-using-langchain-and-bedrock-4140b0ae9c58
# https://github.com/aws-samples/rag-using-langchain-amazon-bedrock-and-opensearch

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import BedrockEmbeddings
from langchain.llms.bedrock import Bedrock
from langchain.vectorstores.pgvector import PGVector
import boto3
import psycopg2
import json
import os
import sys

def getCredentials(secret_name, region_name):
    credential = {}

    session = boto3.session.Session()
    client = session.client(service_name='secretsmanager', region_name=region_name)

    print("Retrieving database creedentials from Secrets Manager")
    get_secret_value_response = client.get_secret_value(SecretId=secret_name)
    
    secret = json.loads(get_secret_value_response['SecretString'])
    credential['username'] = secret['username']
    credential['password'] = secret['password']
    credential['host'] = secret['host']
    credential['port'] = secret['port']
    credential['dbname'] = secret['dbname']

    print("Credentials retrieved successfully")
    return credential

try:
    print("Connecting to database")
    secret_name = os.environ['SECRET_NAME']
    region_name = os.environ['REGION_NAME']
    credential = getCredentials(secret_name, region_name)
    conn = psycopg2.connect(host=credential['host'], database=credential['dbname'], user=credential['username'], password=credential['password'], port=credential['port'])
except:
    print("ERROR: Could not connect to database")
    sys.exit()

print("SUCCESS: Connection to database succeeded")

def reads3():
    bucket_name = os.environ['S3_BUCKET_NAME']
    object_key = 'imis_guide.pdf'
    tmp_file_path = '/tmp/imis_guide.pdf'

    # Download object from S3 bucket to Lambda temporary space
    s3 = boto3.client('s3')
    #response = s3.get_object(Bucket=bucket_name, Key=object_key)
    s3.download_file(bucket_name, object_key, tmp_file_path)

    # Read the content of the object
    with open(tmp_file_path, 'rb') as file:
        content = file.read()
    #print(f"Content of {object_key}: {content}")

    return content

def handler(event, context):
    print("Received event", event)

    # get document
    print("Download file from S3")
    content = reads3()
    print("File downloaded from S3")

    # load document in vector store
    load()

    # items = []
    # item_count = 0
    # with conn.cursor() as cur:
    #     cur.execute("SELECT * FROM test")
    #     print("The following items have been found in the db:")
    #     for row in cur.fetchall():
    #         item_count += 1
    #         print(row)
    #         items.append(row)
    # conn.commit()
    #print("Found %d items to RDS Postgresql table" %(item_count))
    #return items

    return

def load():
    # load the document 
    loader = PyPDFLoader("/tmp/imis_guide.pdf")
    pages = loader.load()
    print(f"Split into {len(pages)} chunks.")

    # split it into chunks
    #text_splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=100, length_function=len, add_start_index=True)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(pages)
    print(f"Split {len(pages)} documents into {len(docs)} chunks.")

    # create the embedding function
    #session = boto3.Session(profile_name='bach-dev', region_name='us-east-1')
    session = boto3.Session()
    bedrock_client = session.client(service_name='bedrock-runtime')
    llm = Bedrock(model_id="anthropic.claude-v2", client=bedrock_client, model_kwargs={'max_tokens_to_sample':200})
    bedrock_embeddings = BedrockEmbeddings(model_id="amazon.titan-embed-text-v1", client=bedrock_client)
    print("Created Bedrock client")

    # store in vector store
    DRIVER="psycopg2"
    HOST=credential["host"]
    PORT=credential["port"]
    DATABASE=credential["dbname"]
    USER=credential["username"]
    PASSWORD=credential["password"]

    conn = psycopg2.connect(dbname=DATABASE,user=USER,host=HOST,password=PASSWORD)
    cur = conn.cursor()
    cur.execute('CREATE EXTENSION IF NOT EXISTS vector;')
    conn.commit()
    print("Connected to DB")

    CONNECTION_STRING = PGVector.connection_string_from_db_params(
        driver=DRIVER,
        host=HOST,
        port=PORT,
        database=DATABASE,
        user=USER,
        password=PASSWORD
    )
    COLLECTION_NAME = "imis_info"
    print("Creating documents")
    db = PGVector.from_documents(
        embedding=bedrock_embeddings,
        documents=docs,
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING
    )
    print("Created documents")

    # Create PGVector Store
    vectorstore = PGVector(
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING,
        embedding_function=bedrock_embeddings,
    )
    print("Created PGVector")

    # query = "What is eBill?"
    # result = vectorstore.similarity_search(query, k=3)
    # print("Result", result)

    return
