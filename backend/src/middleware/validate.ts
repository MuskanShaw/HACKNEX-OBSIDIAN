import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

export type ValidationSchema =
  | ZodTypeAny
  | {
      body?: ZodTypeAny;
      query?: ZodTypeAny;
      params?: ZodTypeAny;
    };

export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('parseAsync' in schema) {
        req.body = await schema.parseAsync(req.body);
      } else {
        if (schema.body) {
          req.body = await schema.body.parseAsync(req.body);
        }
        if (schema.query) {
          req.query = (await schema.query.parseAsync(req.query)) as any;
        }
        if (schema.params) {
          req.params = (await schema.params.parseAsync(req.params)) as any;
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
};
