import { appEnv } from '@/config/env';
import { appwriteFunctions } from '@/lib/appwrite';

export async function runParser() {
  const functionId = appEnv.appwriteFunctionId;
  if (!functionId) {
    throw new Error('Appwrite function ID is not configured.');
  }

  return appwriteFunctions.createExecution(functionId, '', true);
}
