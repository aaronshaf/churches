import { Hono } from 'hono';
import type { D1SessionVariables } from '../../middleware/d1-session';
import type { AuthVariables, Bindings } from '../../types';

type Variables = AuthVariables & D1SessionVariables;

export const submissionsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// TODO: Extract admin submissions routes here
// For now, empty module to satisfy imports
