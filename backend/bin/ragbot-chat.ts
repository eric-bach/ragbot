#!/usr/bin/env node
import 'source-map-support/register';
import { App, StackProps } from 'aws-cdk-lib';
import { RagbotStack } from '../lib/ragbot-stack';

const app = new App();

const appName = app.node.tryGetContext('appName');
const envName = app.node.tryGetContext('envName');

const baseProps: StackProps = {
  env: {
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  tags: {
    environment: envName,
    application: appName,
  },
};

new RagbotStack(app, `${appName}-chat-${envName}`, { ...baseProps, appName, envName });
