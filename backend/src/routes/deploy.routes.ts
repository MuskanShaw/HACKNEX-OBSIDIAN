import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verifyStoreOwnership } from '../middleware/storeOwnership.js';
import { deployRateLimiter } from '../middleware/rateLimiter.js';
import {
  AuthenticatedRequest,
  VercelDeploymentState,
  DEPLOYMENT_STATE_MESSAGES,
} from '../types/index.js';
import { dataStore } from '../services/dataStore.js';
import { generatorService } from '../services/generatorService.js';
import { vercelService } from '../services/vercelService.js';

export const deployRoutes = Router({ mergeParams: true });
export const deploymentStatusRoutes = Router({ mergeParams: true });

/**
 * POST /api/stores/:id/deploy
 * Compiles storefront & deploys to Vercel via backend REST API orchestration.
 * Automatically reuses existing Vercel project ID and polls for readiness.
 */
deployRoutes.post(
  '/',
  requireAuth,
  verifyStoreOwnership,
  deployRateLimiter,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const store = req.validatedStore!;
      const products = await dataStore.getProductsByStoreId(store.id);

      // 1. Compile actual storefront files in-memory
      const template = req.body?.template || store.selected_template_id || 'modern';
      const generatedFiles = generatorService.compileStorefront(store, products, template);

      // 2. Deploy through Vercel REST API orchestration (reuses store.vercel_project_id)
      const result = await vercelService.deployStore(store, generatedFiles);

      // 3. Save deployment record in database
      const deploymentRecord = await dataStore.createDeployment({
        store_id: store.id,
        vercel_project_id: result.projectId || store.vercel_project_id || null,
        vercel_deployment_id: result.deploymentId,
        deployment_url: result.url,
        live_url: result.status === 'READY' ? result.url : null,
        status: result.status,
        error_message: result.error || null,
      });

      // 4. Update store live_url and vercel_project_id
      const updatedStore = await dataStore.updateStore(store.id, {
        live_url: result.status === 'READY' ? result.url : store.live_url || result.url,
        vercel_project_id: result.projectId || store.vercel_project_id,
        is_deployed: result.status === 'READY',
      });

      const normalizedStatus = result.status === 'READY' ? 'live' : result.status.toLowerCase();

      res.status(200).json({
        success: true,
        message: result.statusMessage || 'Store deployed successfully',
        deploymentId: result.deploymentId,
        status: normalizedStatus,
        state: result.status,
        statusMessage: result.statusMessage,
        liveUrl: result.status === 'READY' ? result.url : null,
        deploymentUrl: result.url,
        errorMessage: result.error || null,
        isMock: result.isMock ?? false,
        deployment: deploymentRecord,
        store: updatedStore,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/stores/:id/deployment-status
 * Checks latest deployment progress and history from database and Vercel.
 * Updates Supabase on status transitions without creating duplicate deployments.
 */
deploymentStatusRoutes.get(
  '/',
  requireAuth,
  verifyStoreOwnership,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const store = req.validatedStore!;
      const latest = await dataStore.getLatestDeployment(store.id);

      if (!latest) {
        res.status(200).json({
          success: true,
          status: 'not_deployed',
          state: 'NOT_DEPLOYED',
          statusMessage: DEPLOYMENT_STATE_MESSAGES.NOT_DEPLOYED,
          message: 'No deployments found for this store',
          deploymentId: null,
          liveUrl: store.live_url || null,
          deploymentUrl: null,
          errorMessage: null,
        });
        return;
      }

      // Check current status if still marked as active building or queued
      let currentStatus = (latest.status || 'BUILDING').toUpperCase() as VercelDeploymentState;
      let currentMessage = DEPLOYMENT_STATE_MESSAGES[currentStatus] || 'Building your store';
      let liveUrl = latest.live_url || store.live_url || null;
      let errorMessage = latest.error_message || null;

      if (currentStatus === 'BUILDING' || currentStatus === 'QUEUED') {
        try {
          const liveCheck = await vercelService.getDeploymentStatus(latest.vercel_deployment_id);
          currentStatus = liveCheck.status;
          currentMessage = liveCheck.statusMessage;
          if (liveCheck.error) errorMessage = liveCheck.error;

          if (currentStatus === 'READY') {
            liveUrl = liveCheck.url || latest.deployment_url;
            await dataStore.updateDeploymentByVercelId(latest.vercel_deployment_id, {
              status: 'READY',
              live_url: liveUrl,
              error_message: null,
            });
            await dataStore.updateStore(store.id, {
              live_url: liveUrl,
              is_deployed: true,
            });
          } else if (currentStatus === 'ERROR' || currentStatus === 'CANCELED') {
            await dataStore.updateDeploymentByVercelId(latest.vercel_deployment_id, {
              status: currentStatus,
              error_message: errorMessage || 'Deployment failed on Vercel',
            });
          } else if (currentStatus !== latest.status) {
            await dataStore.updateDeploymentByVercelId(latest.vercel_deployment_id, {
              status: currentStatus,
            });
          }
        } catch (pollErr: any) {
          // Keep current status if external check fails; log sanitized error
          console.warn('[DeploymentStatus] Poll warning:', pollErr.message);
        }
      }

      const normalizedStatus = currentStatus === 'READY' ? 'live' : currentStatus.toLowerCase();

      res.status(200).json({
        success: true,
        deploymentId: latest.vercel_deployment_id,
        status: normalizedStatus,
        state: currentStatus,
        statusMessage: currentMessage,
        deploymentUrl: latest.deployment_url,
        liveUrl,
        errorMessage,
        createdAt: latest.created_at,
        updatedAt: latest.updated_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default deployRoutes;
