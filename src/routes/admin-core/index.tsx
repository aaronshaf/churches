import { Hono } from 'hono';
import type { AuthVariables, Bindings } from '../../types';
import { countiesRoutes } from './counties';
import { dashboardRoutes } from './dashboard';
import { monitoringRoutes } from './monitoring';
import { pagesRoutes } from './pages';
import { settingsRoutes } from './settings';
import { submissionsRoutes } from './submissions';

type Variables = AuthVariables;

export const adminCoreRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Mount all admin core route modules
adminCoreRoutes.route('/', dashboardRoutes);
adminCoreRoutes.route('/', monitoringRoutes);
adminCoreRoutes.route('/', countiesRoutes);
adminCoreRoutes.route('/', pagesRoutes);
adminCoreRoutes.route('/', settingsRoutes);
adminCoreRoutes.route('/', submissionsRoutes);
