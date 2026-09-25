import { env } from '../config/env.js';
import {
  StoreRecord,
  VercelDeploymentState,
  DEPLOYMENT_STATE_MESSAGES,
} from '../types/index.js';
import { GeneratedFile } from './generatorService.js';

export interface VercelDeploymentResult {
  deploymentId: string;
  url: string;
  status: VercelDeploymentState;
  statusMessage: string;
  projectId?: string;
  isMock?: boolean;
  error?: string;
}

/**
 * Maps Vercel readyState into exact application state and human-friendly messages.
 * QUEUED → Deployment queued
 * BUILDING → Building your store
 * READY → Deployment successful
 * ERROR → Deployment failed
 * CANCELED → Deployment canceled
 */
export function mapVercelState(readyState?: string): {
  status: VercelDeploymentState;
  statusMessage: string;
} {
  const normalized = (readyState || '').toUpperCase();
  switch (normalized) {
    case 'QUEUED':
      return { status: 'QUEUED', statusMessage: DEPLOYMENT_STATE_MESSAGES.QUEUED };
    case 'BUILDING':
    case 'INITIALIZING':
      return { status: 'BUILDING', statusMessage: DEPLOYMENT_STATE_MESSAGES.BUILDING };
    case 'READY':
      return { status: 'READY', statusMessage: DEPLOYMENT_STATE_MESSAGES.READY };
    case 'ERROR':
      return { status: 'ERROR', statusMessage: DEPLOYMENT_STATE_MESSAGES.ERROR };
    case 'CANCELED':
      return { status: 'CANCELED', statusMessage: DEPLOYMENT_STATE_MESSAGES.CANCELED };
    default:
      return { status: 'BUILDING', statusMessage: DEPLOYMENT_STATE_MESSAGES.BUILDING };
  }
}

export const vercelService = {
  isConfigured(): boolean {
    return (
      Boolean(env.VERCEL_API_TOKEN) &&
      !env.VERCEL_API_TOKEN.includes('sample_') &&
      env.VERCEL_API_TOKEN.length > 10
    );
  },

  /**
   * Compiles storefront and creates a Vercel deployment.
   * Automatically reuses existing store.vercel_project_id to prevent duplicate projects.
   * Never uses mock simulation if real Vercel credentials are configured.
   */
  async deployStore(store: StoreRecord, files: GeneratedFile[]): Promise<VercelDeploymentResult> {
    if (!this.isConfigured()) {
      // Offline / Developer Mock Simulation (only when real token is not configured)
      const simulatedId = `dpl_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const baseDomain = env.VERCEL_PROJECT_BASE_DOMAIN || 'vercel.app';
      const liveUrl = `https://${store.slug}.${baseDomain}`;
      const projectId = store.vercel_project_id || `prj_${store.slug}`;

      return {
        deploymentId: simulatedId,
        url: liveUrl,
        status: 'READY',
        statusMessage: DEPLOYMENT_STATE_MESSAGES.READY,
        projectId,
        isMock: true,
      };
    }

    try {
      let endpoint = 'https://api.vercel.com/v13/deployments';
      if (env.VERCEL_TEAM_ID) {
        endpoint += `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`;
      }

      const projectName = `obsidian-${store.slug}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

      const payload: any = {
        name: projectName,
        files: files.map((f) => ({
          file: f.file,
          data: f.data,
          encoding: f.encoding || 'utf-8',
        })),
        projectSettings: {
          framework: null,
        },
      };

      // Reuse existing Vercel project ID if already established for this store
      if (store.vercel_project_id) {
        payload.project = store.vercel_project_id;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vercel API error (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const deploymentId = data.id;
      if (!deploymentId) {
        throw new Error('Vercel API returned an invalid response with missing deployment ID.');
      }

      const initialUrl = data.url ? `https://${data.url}` : `https://${store.slug}.vercel.app`;
      const projectId = data.projectId || store.vercel_project_id;

      let { status: finalStatus, statusMessage: finalMessage } = mapVercelState(data.readyState);
      let finalUrl = initialUrl;

      // Quick polling: if in QUEUED or BUILDING, poll every 1.5s for up to 6 iterations (~9s)
      if (finalStatus === 'BUILDING' || finalStatus === 'QUEUED') {
        for (let i = 0; i < 6; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          try {
            const check = await this.getDeploymentStatus(deploymentId);
            finalStatus = check.status;
            finalMessage = check.statusMessage;
            if (check.status === 'READY') {
              finalUrl = check.url || finalUrl;
              break;
            }
            if (check.status === 'ERROR' || check.status === 'CANCELED') {
              break;
            }
          } catch {
            // Non-blocking check failure
          }
        }
      }

      return {
        deploymentId,
        url: finalUrl,
        status: finalStatus,
        statusMessage: finalMessage,
        projectId,
        isMock: false,
      };
    } catch (err: any) {
      // Redact any Authorization tokens from logs and errors
      const sanitized = (err.message || '').replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer [REDACTED]');
      console.error('[Vercel] Deployment error:', sanitized);
      throw new Error(`Deployment orchestration error: ${sanitized}`);
    }
  },

  /**
   * Retrieves deployment state directly from Vercel API.
   * Maps Vercel readyState into exact application state.
   */
  async getDeploymentStatus(deploymentId: string): Promise<VercelDeploymentResult> {
    if (!deploymentId) {
      throw new Error('Deployment ID is required to check deployment status.');
    }

    if (!this.isConfigured() || deploymentId.startsWith('dpl_mock_')) {
      return {
        deploymentId,
        url: `https://sample.vercel.app`,
        status: 'READY',
        statusMessage: DEPLOYMENT_STATE_MESSAGES.READY,
        isMock: true,
      };
    }

    let endpoint = `https://api.vercel.com/v13/deployments/${deploymentId}`;
    if (env.VERCEL_TEAM_ID) {
      endpoint += `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`;
    }

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Vercel deployment '${deploymentId}' was not found.`);
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid Vercel credentials or unauthorized access to deployment.');
        }
        throw new Error(`Failed to check deployment status (${response.status}): ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const { status, statusMessage } = mapVercelState(data.readyState);

      return {
        deploymentId: data.id,
        url: data.url ? `https://${data.url}` : '',
        status,
        statusMessage,
        projectId: data.projectId,
        isMock: false,
        error: data.errorMessage || undefined,
      };
    } catch (err: any) {
      const sanitized = (err.message || '').replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer [REDACTED]');
      throw new Error(sanitized);
    }
  },
};
