import { Hono } from 'hono';
import type { AuthVariables, Bindings } from '../../types';

type Variables = AuthVariables;

export const settingsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// TODO: Extract admin settings routes here
// For now, empty module to satisfy imports
