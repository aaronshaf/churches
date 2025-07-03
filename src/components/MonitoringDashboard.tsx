import type { FC } from 'hono/jsx';

type MonitoringDashboardProps = {
  loginStats: {
    totalUsers: number;
    activeUsers24h: number;
    recentLogins: Array<{
      id: string;
      user: string;
      email: string;
      role: 'admin' | 'contributor' | 'user';
      loginTime: Date;
      ipAddress?: string;
    }>;
  };
  activityStats: {
    totalComments: number;
    commentsToday: number;
    recentActivity: Array<{
      id: string;
      type: 'login' | 'comment' | 'data_change';
      user: string;
      description: string;
      timestamp: Date;
    }>;
  };
};

const RoleBadge: FC<{ role: 'admin' | 'contributor' | 'user' }> = ({ role }) => {
  const roleConfig = {
    admin: { color: 'bg-red-100 text-red-800', label: 'Admin' },
    contributor: { color: 'bg-blue-100 text-blue-800', label: 'Contributor' },
    user: { color: 'bg-gray-100 text-gray-800', label: 'User' },
  };

  const config = roleConfig[role];

  return (
    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const MetricCard: FC<{ title: string; value: string; subtitle?: string }> = ({ title, value, subtitle }) => {
  return (
    <div class="bg-white rounded-lg shadow p-6">
      <div>
        <h3 class="text-sm font-medium text-gray-500">{title}</h3>
        <p class="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p class="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

const ActivityItem: FC<{ activity: MonitoringDashboardProps['activityStats']['recentActivity'][0] }> = ({ activity }) => {
  const typeConfig = {
    login: { icon: '👤', color: 'text-green-600', bgColor: 'bg-green-100' },
    comment: { icon: '💬', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    data_change: { icon: '✏️', color: 'text-purple-600', bgColor: 'bg-purple-100' },
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
          <span class="font-medium">{activity.user}</span> {activity.description}
        </p>
        <p class="text-xs text-gray-500 mt-1">
          {timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}
        </p>
      </div>
    </div>
  );
};

const LoginItem: FC<{ login: MonitoringDashboardProps['loginStats']['recentLogins'][0] }> = ({ login }) => {
  const timeAgo = Math.floor((Date.now() - login.loginTime.getTime()) / 1000 / 60);

  return (
    <div class="flex items-center justify-between py-3">
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">
          👤
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900">{login.user}</p>
          <p class="text-xs text-gray-500">{login.email}</p>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <RoleBadge role={login.role} />
        <div class="text-right">
          <p class="text-xs text-gray-500">
            {timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}
          </p>
          {login.ipAddress && (
            <p class="text-xs text-gray-400">{login.ipAddress}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const MonitoringDashboard: FC<MonitoringDashboardProps> = ({ loginStats, activityStats }) => {
  return (
    <div class="space-y-8">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Activity Monitoring</h1>
        <p class="mt-2 text-gray-600">User login and activity statistics for Utah Churches</p>
      </div>

      {/* Key Metrics */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={`${loginStats.totalUsers}`}
          subtitle="Registered users"
        />
        <MetricCard
          title="Active Users (24h)"
          value={`${loginStats.activeUsers24h}`}
          subtitle="Users who logged in"
        />
        <MetricCard
          title="Total Comments"
          value={`${activityStats.totalComments}`}
          subtitle="User comments posted"
        />
        <MetricCard
          title="Comments Today"
          value={`${activityStats.commentsToday}`}
          subtitle="New comments posted"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Logins */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Logins</h2>
          </div>
          <div class="px-6 py-4">
            {loginStats.recentLogins.length > 0 ? (
              <div class="space-y-2">
                {loginStats.recentLogins.slice(0, 8).map((login) => (
                  <LoginItem key={login.id} login={login} />
                ))}
              </div>
            ) : (
              <p class="text-gray-500 text-sm py-4">No recent logins</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div class="px-6 py-4">
            {activityStats.recentActivity.length > 0 ? (
              <div class="space-y-2">
                {activityStats.recentActivity.slice(0, 8).map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <p class="text-gray-500 text-sm py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};