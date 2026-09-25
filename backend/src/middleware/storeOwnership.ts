import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { dataStore } from '../services/dataStore.js';

export const verifyStoreOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const storeId = req.params.id || req.params.storeId;

  if (!storeId) {
    res.status(400).json({ error: 'Bad Request', message: 'Store ID is required' });
    return;
  }

  if (!req.currentUser) {
    res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    return;
  }

  try {
    const store = await dataStore.getStoreById(storeId);

    if (!store) {
      res.status(404).json({ error: 'Not Found', message: 'Store not found' });
      return;
    }

    const isOwner =
      (store.owner_id && store.owner_id === req.currentUser.id) ||
      store.user_id === req.currentUser.id;

    if (!isOwner) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage this store.',
      });
      return;
    }

    req.validatedStore = store;
    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
