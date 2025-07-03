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
  // Only show comments section for logged-in users
  if (!user) {
    return null;
  }

  const canSeeAllComments = user && (user.role === 'admin' || user.role === 'contributor');
  const visibleComments = canSeeAllComments 
    ? comments 
    : comments.filter(comment => comment.isOwn);

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">
            {canSeeAllComments ? 'User Feedback' : 'My Notes'}
          </h3>
          <p class="text-sm text-gray-600 mt-0.5">
            {canSeeAllComments 
              ? 'Private comments from community members' 
              : 'Your personal notes about this church'
            }
          </p>
        </div>
        {visibleComments.length > 0 && (
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {visibleComments.length} {visibleComments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {/* Add Comment Form */}
      {user && (
        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <form method="POST" action={`/churches/${churchPath}/comments`} class="space-y-4">
            <div>
              <label for="comment-content" class="sr-only">
                Add your thoughts about {churchName}
              </label>
              <textarea
                id="comment-content"
                name="content"
                rows="4"
                required
                class="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm placeholder-gray-400 resize-none"
                placeholder={`Share your thoughts about ${churchName}...`}
              ></textarea>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1 text-xs text-gray-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Private comment - only visible to you and admin team</span>
              </div>
              <button
                type="submit"
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded-lg transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Comment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comments List */}
      {visibleComments.length > 0 ? (
        <div class="space-y-3">
          {visibleComments.map((comment, index) => (
            <div key={comment.id} class="group">
              <div class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div class="flex items-start space-x-3">
                  {/* Avatar */}
                  <div class="flex-shrink-0">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <span class="text-sm font-semibold text-white">
                        {comment.userName ? comment.userName.charAt(0).toUpperCase() : comment.userEmail.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center space-x-2">
                        <p class="text-sm font-medium text-gray-900">
                          {comment.userName || comment.userEmail.split('@')[0]}
                        </p>
                        {comment.isOwn && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-800">
                            You
                          </span>
                        )}
                        {canSeeAllComments && !comment.isOwn && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            Member
                          </span>
                        )}
                      </div>
                      <time class="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: new Date(comment.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        })}
                      </time>
                    </div>
                    <div class="prose prose-sm max-w-none">
                      <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div class="text-center py-12">
          <div class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h4 class="text-sm font-medium text-gray-900 mb-1">
            {canSeeAllComments ? 'No community feedback yet' : 'No personal notes yet'}
          </h4>
          <p class="text-sm text-gray-500 mb-4">
            {canSeeAllComments 
              ? 'Be the first to share feedback about this church'
              : 'Add your first note about this church above'
            }
          </p>
        </div>
      )}
    </div>
  );
};