import { Hono } from 'hono';
import type { AuthVariables, Bindings } from '../../types';

type Variables = AuthVariables;

export const countiesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// TODO: Extract admin counties routes here
// For now, empty module to satisfy imports
