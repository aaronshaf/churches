import type { FC } from 'hono/jsx';

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  userName?: string;
  userEmail: string;
  userId: string;
  isOwn: boolean;
};

type ChurchCommentsProps = {
  churchId: number;
  churchName: string;
  churchPath: string;
  comments: Comment[];
  user?: {
    id: string;
    name?: string;
    email: string;
    role: 'admin' | 'contributor' | 'user';
  };
};

export const ChurchComments: FC<ChurchCommentsProps> = ({ churchId, churchName, churchPath, comments, user }) => {
  const canSeeAllComments = user && (user.role === 'admin' || user.role === 'contributor');
  const visibleComments = canSeeAllComments 
    ? comments 
    : comments.filter(comment => comment.isOwn);

  return (
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">
          {canSeeAllComments ? 'User Comments' : 'My Comments'}
        </h2>
        {canSeeAllComments && (
          <p class="text-sm text-gray-600 mt-1">
            All user comments for this church (visible to admins and contributors only)
          </p>
        )}
      </div>

      <div class="px-6 py-4 space-y-6">
        {/* Add Comment Form - Only for logged in users */}
        {user && (
          <form method="POST" action={`/churches/${churchPath}/comments`} class="space-y-4">
            <div>
              <label for="comment-content" class="block text-sm font-medium text-gray-700 mb-2">
                Add a private comment about {churchName}
              </label>
              <textarea
                id="comment-content"
                name="content"
                rows="3"
                required
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="Share your thoughts about this church (only you, admins, and contributors can see this)"
              ></textarea>
            </div>
            <div class="flex justify-between items-center">
              <p class="text-xs text-gray-500">
                This comment will be private - only visible to you, admins, and contributors
              </p>
              <button
                type="submit"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Add Comment
              </button>
            </div>
          </form>
        )}

        {/* Comments List */}
        {visibleComments.length > 0 ? (
          <div class="space-y-4">
            <div class="border-t border-gray-200 pt-4">
              <h3 class="text-sm font-medium text-gray-900 mb-3">
                {visibleComments.length} comment{visibleComments.length !== 1 ? 's' : ''}
              </h3>
              <div class="space-y-4">
                {visibleComments.map((comment) => (
                  <div key={comment.id} class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex items-center space-x-2">
                        <div class="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span class="text-sm font-medium text-primary-700">
                            {comment.userName ? comment.userName.charAt(0).toUpperCase() : comment.userEmail.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p class="text-sm font-medium text-gray-900">
                            {comment.userName || comment.userEmail}
                            {comment.isOwn && <span class="text-xs text-gray-500 ml-2">(You)</span>}
                          </p>
                          <p class="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()} at {new Date(comment.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {canSeeAllComments && !comment.isOwn && (
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          User Comment
                        </span>
                      )}
                    </div>
                    <div class="mt-3">
                      <p class="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div class="border-t border-gray-200 pt-4">
            <div class="text-center py-6">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p class="mt-2 text-sm text-gray-500">
                {canSeeAllComments ? 'No comments yet' : 'You haven\'t posted any comments yet'}
              </p>
              {!user && (
                <p class="mt-1 text-sm text-gray-500">
                  <a href="/auth/signin" class="text-primary-600 hover:text-primary-500">Sign in</a> to add comments
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};