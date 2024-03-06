import { Stack, RemovalPolicy, Duration, CfnOutput, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess, BucketEncryption, EventType, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, ServerSideEncryption, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { RestApi, LambdaIntegration, Cors, CognitoUserPoolsAuthorizer, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { CanonicalUserPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { S3EventSource, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LambdaPowertoolsLayer } from 'cdk-aws-lambda-powertools-layer';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import {
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  GeoRestriction,
  OriginAccessIdentity,
  PriceClass,
  SSLMethod,
  SecurityPolicyProtocol,
  ViewerCertificate,
} from 'aws-cdk-lib/aws-cloudfront';
import { AccountRecovery, UserPool, UserPoolClient, UserPoolDomain, UserPoolEmail, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { WebSocketLambdaAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as path from 'path';

const dotenv = require('dotenv');
dotenv.config();

interface RagbotStackProps extends StackProps {
  appName: string;
  envName: string;
}

export class RagbotStack extends Stack {
  constructor(scope: Construct, id: string, props: RagbotStackProps) {
    super(scope, id, props);

    /**********
     * Auth
     **********/

    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${props.appName}_user_pool_${props.envName}`,
      selfSignUpEnabled: true,
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      autoVerify: {
        email: true,
      },
      email: UserPoolEmail.withSES({
        // @ts-ignore
        fromEmail: process.env.SENDER_EMAIL,
        fromName: 'RAGBot',
        sesRegion: this.region,
      }),
      userVerification: {
        emailSubject: 'RAGBot - Verify your new account',
        emailBody: 'Thanks for signing up! Please enter the verification code {####} to confirm your account.',
        emailStyle: VerificationEmailStyle.CODE,
      },
      signInAliases: {
        username: false,
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new UserPoolDomain(this, `UserPoolDomain`, {
      userPool: userPool,
      cognitoDomain: {
        domainPrefix: `${props.appName}-${props.envName}`,
      },
    });

    const userPoolClient = new UserPoolClient(this, 'UserPoolWebClient', {
      userPoolClientName: `${props.appName}_user_client`,
      accessTokenValidity: Duration.hours(4),
      idTokenValidity: Duration.hours(4),
      userPool,
    });

    /**********
     * Storage
     **********/

    const bucket = new Bucket(this, 'PdfBucket', {
      bucketName: `${props.appName}-pdfbucket-${props.envName}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      cors: [
        {
          allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST, HttpMethods.DELETE, HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const documentTable = new Table(this, 'DocumentTable', {
      tableName: `${props.appName}-document-${props.envName}`,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'documentId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const sessionTable = new Table(this, 'SessionTable', {
      tableName: `${props.appName}-session-${props.envName}`,
      partitionKey: { name: 'SessionId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const table = new Table(this, 'WebsocketConnections', {
      tableName: `${props.appName}-connections-${props.envName}`,
      partitionKey: { name: 'connectionId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const embeddingQueue = new Queue(this, 'EmbeddingQueue', {
      queueName: `${props.appName}-embeddings-${props.envName}`,
      visibilityTimeout: Duration.seconds(180),
      retentionPeriod: Duration.seconds(3600),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**********
     * Functions
     **********/

    // Lambda Powertools Layer
    const powertoolsLayer = new LambdaPowertoolsLayer(this, 'PowertoolsLayer', {
      version: '2.32.0',
      includeExtras: true,
    });

    const generatePresignedUrl = new PythonFunction(this, 'GeneratePresignedUrl', {
      functionName: `${props.appName}-GeneratePresignedUrl-${props.envName}`,
      entry: 'src/generate_presigned_url',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        REGION: this.region,
        BUCKET_NAME: bucket.bucketName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    generatePresignedUrl.role?.addManagedPolicy({ managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess' });

    const uploadTrigger = new PythonFunction(this, 'UploadTrigger', {
      functionName: `${props.appName}-UploadTrigger-${props.envName}`,
      entry: 'src/upload_trigger',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        QUEUE_URL: embeddingQueue.queueUrl,
        DOCUMENT_TABLE: documentTable.tableName,
        SESSION_TABLE: sessionTable.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    uploadTrigger.role?.addManagedPolicy({ managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess' });
    uploadTrigger.addToRolePolicy(
      new PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [embeddingQueue.queueArn],
      })
    );
    uploadTrigger.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:PutItem'],
        resources: [documentTable.tableArn, sessionTable.tableArn],
      })
    );
    uploadTrigger.addEventSource(
      new S3EventSource(bucket, {
        events: [EventType.OBJECT_CREATED],
        filters: [{ suffix: '.pdf' }],
      })
    );
    bucket.grantRead(uploadTrigger);

    const generateEmbeddings = new PythonFunction(this, 'GenerateEmbeddings', {
      functionName: `${props.appName}-GenerateEmbeddings-${props.envName}`,
      entry: 'src/generate_embeddings',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 2048,
      timeout: Duration.minutes(2),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        DOCUMENT_TABLE: documentTable.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    generateEmbeddings.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'sqs:ChangeMessageVisibility',
          'sqs:ChangeMessageVisibilityBatch',
          'sqs:DeleteMessage',
          'sqs:DeleteMessageBatch',
          'sqs:GetQueueAttributes',
          'sqs:ReceiveMessage',
        ],
        resources: [embeddingQueue.queueArn],
      })
    );
    generateEmbeddings.addToRolePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObject',
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:GetObjectVersion',
          's3:PutObject',
          's3:PutObjectAcl',
          's3:GetLifecycleConfiguration',
          's3:PutLifecycleConfiguration',
          's3:DeleteObject',
        ],
        resources: [bucket.bucketArn, bucket.bucketArn + '/*'],
      })
    );
    generateEmbeddings.addToRolePolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1'],
      })
    );
    generateEmbeddings.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [documentTable.tableArn],
      })
    );
    generateEmbeddings.addEventSource(new SqsEventSource(embeddingQueue, { batchSize: 1 }));

    const getAllDocuments = new PythonFunction(this, 'GetAllDocuments', {
      functionName: `${props.appName}-GetAllDocuments-${props.envName}`,
      entry: 'src/get_all_documents',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        DOCUMENT_TABLE: documentTable.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    getAllDocuments.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [documentTable.tableArn],
      })
    );

    const getDocument = new PythonFunction(this, 'GetDocument', {
      functionName: `${props.appName}-GetDocument-${props.envName}`,
      entry: 'src/get_document',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        DOCUMENT_TABLE: documentTable.tableName,
        SESSION_TABLE: sessionTable.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    getDocument.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem'],
        resources: [documentTable.tableArn, sessionTable.tableArn],
      })
    );

    const deleteDocument = new PythonFunction(this, 'DeleteDocument', {
      functionName: `${props.appName}-DeleteDocument-${props.envName}`,
      entry: 'src/delete_document',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        DOCUMENT_TABLE: documentTable.tableName,
        SESSION_TABLE: sessionTable.tableName,
        BUCKET_NAME: bucket.bucketName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    deleteDocument.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket', 's3:DeleteObject'],
        resources: [bucket.bucketArn, bucket.bucketArn + '/*'],
      })
    );
    deleteDocument.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:DeleteItem'],
        resources: [documentTable.tableArn, sessionTable.tableArn],
      })
    );

    const addConversation = new PythonFunction(this, 'AddConversation', {
      functionName: `${props.appName}-AddConversation-${props.envName}`,
      entry: 'src/add_conversation',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        DOCUMENT_TABLE: documentTable.tableName,
        SESSION_TABLE: sessionTable.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    addConversation.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [documentTable.tableArn, sessionTable.tableArn],
      })
    );

    const generateResponse = new PythonFunction(this, 'GenerateResponse', {
      functionName: `${props.appName}-GenerateResponse-${props.envName}`,
      entry: 'src/generate_response',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 2048,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        SESSION_TABLE: sessionTable.tableName,
        TABLE_NAME: table.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    table.grantReadData(generateResponse);
    sessionTable.grantReadWriteData(generateResponse);
    generateResponse.addToRolePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObject',
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:GetObjectVersion',
          's3:PutObject',
          's3:PutObjectAcl',
          's3:GetLifecycleConfiguration',
          's3:PutLifecycleConfiguration',
          's3:DeleteObject',
        ],
        resources: [bucket.bucketArn, bucket.bucketArn + '/*'],
      })
    );
    generateResponse.addToRolePolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['arn:aws:bedrock:*::foundation-model/anthropic.claude-v2', 'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1'],
      })
    );

    const connectWebsocket = new PythonFunction(this, 'ConnectWebsocket', {
      functionName: `${props.appName}-ConnectWebsocket-${props.envName}`,
      entry: 'src/connect_websocket',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME: table.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    table.grantReadWriteData(connectWebsocket);

    const disconnectWebsocket = new PythonFunction(this, 'DisconnectWebsocket', {
      functionName: `${props.appName}-DisconnectWebsocket-${props.envName}`,
      entry: 'src/disconnect_websocket',
      runtime: Runtime.PYTHON_3_10,
      architecture: Architecture.ARM_64,
      memorySize: 384,
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME: table.tableName,
      },
      retryAttempts: 0,
      layers: [powertoolsLayer],
    });
    table.grantReadWriteData(disconnectWebsocket);

    const authWebsocket = new NodejsFunction(this, 'AuthWebsocket', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'src/auth_websocket/index.ts',
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        APP_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    /**********
     * APIs
     **********/

    const api = new RestApi(this, 'API', {
      restApiName: `${props.appName}-api-${props.envName}`,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', { cognitoUserPools: [userPool] });
    const docResource = api.root.addResource('doc');
    const docIdResource = docResource.addResource('{documentId}');
    const docIdConversationIdResource = docIdResource.addResource('{conversationId}');

    // GET /generate_presigned_url
    const generatePresignedUrlApiIntegration = new LambdaIntegration(generatePresignedUrl, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    api.root.addResource('generate_presigned_url').addMethod('GET', generatePresignedUrlApiIntegration, {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });

    // GET /doc
    const getDocumentsApiIntegration = new LambdaIntegration(getAllDocuments, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    docResource.addMethod('GET', getDocumentsApiIntegration, {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });

    // POST /doc/{documentId}
    const addConversationApiIntegration = new LambdaIntegration(addConversation, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    docIdResource.addMethod('POST', addConversationApiIntegration, {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });

    // GET /doc/{documentId}/{conversationId}
    const getDocumentApiIntegration = new LambdaIntegration(getDocument, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    docIdConversationIdResource.addMethod('GET', getDocumentApiIntegration, {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });

    // DELETE /doc/{documentId}/{conversationId}
    const deleteDocumentApiIntegration = new LambdaIntegration(deleteDocument, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    docIdConversationIdResource.addMethod('DELETE', deleteDocumentApiIntegration, {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });

    // WSS /{documentId}/{conversationId}
    const webSocketApi = new WebSocketApi(this, 'GenerateResponseWebsocket', {
      apiName: `${props.appName}-websocket-api-${props.envName}`,
      connectRouteOptions: {
        authorizer: new WebSocketLambdaAuthorizer('Authorizer', authWebsocket, {
          identitySource: ['route.request.querystring.idToken'],
        }),
        integration: new WebSocketLambdaIntegration('ConnectHandlerIntegration', connectWebsocket),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('DisconnectHandlerIntegration', disconnectWebsocket),
      },
      routeSelectionExpression: '$request.body.action',
    });
    const apiStage = new WebSocketStage(this, 'WebsocketStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });
    webSocketApi.addRoute('GenerateResponse', {
      integration: new WebSocketLambdaIntegration('GenerateResponseIntegration', generateResponse),
    });

    // Add permissions to websocket function to manage websocket connections
    generateResponse.addToRolePolicy(
      new PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [
          this.formatArn({
            service: 'execute-api',
            resourceName: `${apiStage.stageName}/POST/*`,
            resource: webSocketApi.apiId,
          }),
        ],
      })
    );

    //**********
    // Frontend
    //**********

    const cloudfrontOAI = new OriginAccessIdentity(this, 'CloudFrontOAI', {
      comment: `OAI for RAGBot CloudFront`,
    });

    const websiteBucket = new Bucket(this, 'WebsiteBucket', {
      bucketName: `${props.appName}-website-${props.envName}`,
      websiteIndexDocument: 'index.html',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      cors: [
        {
          allowedHeaders: ['Authorization', 'Content-Length'],
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ['*'],
          maxAge: 3000,
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    websiteBucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [websiteBucket.arnForObjects('*')],
        principals: [new CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      })
    );

    // @ts-ignore
    // Existing ACM certificate
    const certificate = Certificate.fromCertificateArn(this, 'Certificate', process.env.CERTIFICATE_ARN);

    const distribution = new CloudFrontWebDistribution(this, 'CloudFrontDistribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultRootObject: 'container/latest/index.html',
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: websiteBucket,
            originAccessIdentity: cloudfrontOAI,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              defaultTtl: Duration.hours(1),
              minTtl: Duration.seconds(0),
              maxTtl: Duration.days(1),
              compress: true,
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            },
          ],
        },
      ],
      geoRestriction: GeoRestriction.allowlist('CA'),
      errorConfigurations: [
        {
          errorCode: 403,
          errorCachingMinTtl: 60,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
      ],
      viewerCertificate:
        props.envName === 'prod'
          ? ViewerCertificate.fromAcmCertificate(certificate, {
              aliases: ['ragbot.ericbach.dev'],
              securityPolicy: SecurityPolicyProtocol.TLS_V1_2_2021,
              sslMethod: SSLMethod.SNI,
            })
          : undefined,
    });

    if (props.envName === 'prod') {
      // Route53 HostedZone A record
      var existingHostedZone = HostedZone.fromLookup(this, 'Zone', {
        domainName: 'ericbach.dev',
      });
      new ARecord(this, 'AliasRecord', {
        zone: existingHostedZone,
        recordName: `${props.appName}.ericbach.dev`,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });
    }

    new BucketDeployment(this, 'WebsiteBucketDeployment', {
      sources: [Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: websiteBucket,
      retainOnDelete: false,
      contentLanguage: 'en',
      //storageClass: StorageClass.INTELLIGENT_TIERING,
      serverSideEncryption: ServerSideEncryption.AES_256,
      cacheControl: [CacheControl.setPublic(), CacheControl.maxAge(Duration.minutes(1))],
      distribution,
      distributionPaths: ['/static/css/*'],
    });

    // /**********
    //  * Outputs
    //  **********/

    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, 'CloudFrontDistributionName', {
      value: distribution.distributionDomainName,
    });

    new CfnOutput(this, 'WebSocketApiUrl', {
      value: apiStage.url,
    });
  }
}
