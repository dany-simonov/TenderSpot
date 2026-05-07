import { Account, Client, Databases, Functions } from 'appwrite';
import { appEnv } from '@/config/env';

export const appwriteClient = new Client()
  .setEndpoint(appEnv.endpoint || 'https://cloud.appwrite.io/v1')
  .setProject(appEnv.projectId || '');

export const appwriteAccount = new Account(appwriteClient);
export const appwriteDatabases = new Databases(appwriteClient);
export const appwriteFunctions = new Functions(appwriteClient);
