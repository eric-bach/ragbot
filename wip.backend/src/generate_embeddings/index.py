# https://github.com/aws-samples/rag-with-amazon-bedrock-and-pgvector/tree/main

# https://github.com/aws-samples/amazon-bedrock-workshop/tree/main/03_QuestionAnswering
# https://medium.com/@jenniferjasperse/how-to-use-postgres-with-aws-lambda-and-python-44e9d9154513
# https://medium.com/@tahir.rauf/similarity-search-using-langchain-and-bedrock-4140b0ae9c58
# https://github.com/aws-samples/rag-using-langchain-amazon-bedrock-and-opensearch

from langchain_community.document_loaders import PyPDFLoader
from langchain.prompts import ChatPromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.chat_models import BedrockChat
from langchain_community.embeddings import BedrockEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.llms.bedrock import Bedrock
import boto3
import os

CHROMA_PATH = "/tmp/chroma"
PROMPT_TEMPLATE = """
Answer the question based only on the following context:

{context}

---

Answer the question based on the above context: {question}
"""

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
    # #session = boto3.Session(profile_name='bach-dev', region_name='us-east-1')
    # session = boto3.Session()
    # bedrock_client = session.client(service_name='bedrock-runtime')
    # llm = Bedrock(model_id="anthropic.claude-v2", client=bedrock_client, model_kwargs={'max_tokens_to_sample':200})
    # bedrock_embeddings = BedrockEmbeddings(model_id="amazon.titan-embed-text-v1", client=bedrock_client)
    # print("Created Bedrock client")

    # load it into Chroma
    # db = Chroma.from_documents(docs, bedrock_embeddings, collection_metadata={"hnsw:space": "cosine"})
    # db.persist()
    # print(f"Saved {len(docs)} chunks to {CHROMA_PATH}.")

    # use Chroma external
    # https://python.langchain.com/docs/integrations/vectorstores/chroma#basic-example-using-the-docker-container
    #chroma_client = chromadb.HttpClient(host='44.204.97.86', port=8000)
    #collection = chroma_client.create_collection("my_collection")
    #for doc in docs:
    #   collection.add(
    #      ids=[str(uuid.uuid1())], metadatas=doc.metadata, documents=doc.page_content
    #   )
    #db = Chroma(client=chroma_client, collection_name="my_collection", embedding_function=bedrock_embeddings)

    # query it
    # query_text = "What is the difference between eBill and email address?"
    # results = db.similarity_search_with_relevance_scores(query=query_text)
    # print(results)

    # if len(results) == 0 or results[0][1] < 0.7:
    #     print(f"Unable to find matching results.")

    # context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])
    # prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    # prompt = prompt_template.format(context=context_text, question=query_text)
    # print(prompt)

    # model = BedrockChat(model_id="anthropic.claude-v2", model_kwargs={"temperature": 0.1}, client=bedrock_client)
    # response_text = model.predict(prompt)

    # sources = [doc.metadata.get("source", None) for doc, _score in results]
    # formatted_response = f"Response: {response_text}\nSources: {sources}"
    # print(formatted_response)

    return
