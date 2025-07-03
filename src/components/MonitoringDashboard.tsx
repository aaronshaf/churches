import type { FC } from 'hono/jsx';

type MonitoringDashboardProps = {
  systemHealth: {
    database: {
      status: 'healthy' | 'warning' | 'error';
      responseTime: number;
      connections: number;
    };
    application: {
      uptime: number;
      memoryUsage: number;
      requestRate: number;
    };
    externalServices: {
      googleMaps: 'healthy' | 'warning' | 'error';
      cloudflareImages: 'healthy' | 'warning' | 'error';
      googleOAuth: 'healthy' | 'warning' | 'error';
    };
  };
  recentActivity: Array<{
    id: string;
    type: 'login' | 'logout' | 'data_change' | 'error' | 'image_upload';
    user?: string;
    description: string;
    timestamp: Date;
    severity?: 'info' | 'warning' | 'error';
  }>;
  errorSummary: {
    total24h: number;
    recent: Array<{
      id: string;
      message: string;
      count: number;
      lastOccurred: Date;
      severity: 'warning' | 'error';
    }>;
  };
};

const StatusIndicator: FC<{ status: 'healthy' | 'warning' | 'error'; label: string }> = ({ status, label }) => {
  const statusConfig = {
    healthy: { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' },
    warning: { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50' },
    error: { color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
  };

  const config = statusConfig[status];

  return (
    <div class={`${config.bgColor} rounded-lg p-3 flex items-center space-x-3`}>
      <div class={`w-3 h-3 rounded-full ${config.color}`}></div>
      <span class={`text-sm font-medium ${config.textColor}`}>{label}</span>
    </div>
  );
};

const MetricCard: FC<{ title: string; value: string; subtitle?: string; trend?: 'up' | 'down' | 'stable' }> = ({ title, value, subtitle, trend }) => {
  return (
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-gray-500">{title}</h3>
          <p class="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p class="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {trend && (
          <div class={`flex items-center ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'}`}>
            {trend === 'up' && (
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            {trend === 'down' && (
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            )}
            {trend === 'stable' && (
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityItem: FC<{ activity: MonitoringDashboardProps['recentActivity'][0] }> = ({ activity }) => {
  const typeConfig = {
    login: { icon: '👤', color: 'text-green-600', bgColor: 'bg-green-100' },
    logout: { icon: '🚪', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    data_change: { icon: '✏️', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    error: { icon: '⚠️', color: 'text-red-600', bgColor: 'bg-red-100' },
    image_upload: { icon: '📷', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  };

  const config = typeConfig[activity.type];
  const timeAgo = Math.floor((Date.now() - activity.timestamp.getTime()) / 1000 / 60);

  return (
    <div class="flex items-start space-x-3 py-3">
      <div class={`flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center text-sm`}>
        {config.icon}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-900">
          {activity.user && <span class="font-medium">{activity.user}</span>} {activity.description}
        </p>
        <p class="text-xs text-gray-500 mt-1">
          {timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}
        </p>
      </div>
    </div>
  );
};

export const MonitoringDashboard: FC<MonitoringDashboardProps> = ({ systemHealth, recentActivity, errorSummary }) => {
  return (
    <div class="space-y-8">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold text-gray-900">System Monitoring</h1>
        <p class="mt-2 text-gray-600">Real-time monitoring and analytics for Utah Churches</p>
      </div>

      {/* System Health Overview */}
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">System Health</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusIndicator 
              status={systemHealth.database.status} 
              label={`Database (${systemHealth.database.responseTime}ms)`} 
            />
            <StatusIndicator 
              status={systemHealth.externalServices.googleMaps} 
              label="Google Maps API" 
            />
            <StatusIndicator 
              status={systemHealth.externalServices.cloudflareImages} 
              label="Cloudflare Images" 
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Application Uptime"
          value={`${Math.floor(systemHealth.application.uptime / 3600)}h`}
          subtitle="Since last restart"
          trend="stable"
        />
        <MetricCard
          title="Memory Usage"
          value={`${systemHealth.application.memoryUsage}%`}
          subtitle="Of allocated memory"
          trend={systemHealth.application.memoryUsage > 80 ? 'up' : 'stable'}
        />
        <MetricCard
          title="Request Rate"
          value={`${systemHealth.application.requestRate}`}
          subtitle="Requests per minute"
          trend="stable"
        />
        <MetricCard
          title="Errors (24h)"
          value={`${errorSummary.total24h}`}
          subtitle="Total error count"
          trend={errorSummary.total24h > 10 ? 'up' : 'stable'}
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div class="px-6 py-4">
            {recentActivity.length > 0 ? (
              <div class="space-y-2">
                {recentActivity.slice(0, 8).map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <p class="text-gray-500 text-sm py-4">No recent activity</p>
            )}
          </div>
        </div>

        {/* Error Summary */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Errors</h2>
          </div>
          <div class="px-6 py-4">
            {errorSummary.recent.length > 0 ? (
              <div class="space-y-3">
                {errorSummary.recent.slice(0, 5).map((error) => (
                  <div key={error.id} class="flex items-start justify-between py-2">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900 truncate">{error.message}</p>
                      <p class="text-xs text-gray-500 mt-1">
                        {error.count} occurrences • Last: {Math.floor((Date.now() - error.lastOccurred.getTime()) / 1000 / 60)}m ago
                      </p>
                    </div>
                    <span class={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      error.severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {error.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p class="text-gray-500 text-sm py-4">No recent errors</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div class="p-6">
          <div class="flex flex-wrap gap-3">
            <button class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              📊 View Detailed Logs
            </button>
            <button class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              🔄 Clear Cache
            </button>
            <button class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              📤 Export Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};