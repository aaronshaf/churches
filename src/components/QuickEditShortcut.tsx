import type { FC } from 'hono/jsx';

type QuickEditShortcutProps = {
  userRole?: string;
};

export const QuickEditShortcut: FC<QuickEditShortcutProps> = ({ userRole }) => {
  // Only render for contributors and admins
  if (!userRole || (userRole !== 'admin' && userRole !== 'contributor')) {
    return null;
  }

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          // Quick edit keyboard shortcut handler
          document.addEventListener('DOMContentLoaded', function() {
            document.addEventListener('keydown', function(e) {
              // Check if user is not in an input field
              const tagName = e.target.tagName.toLowerCase();
              const isInputField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || e.target.contentEditable === 'true';
              
              // Quick edit with 'E' key (only for contributors and admins)
              if (e.key === 'E' && !isInputField && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                const currentPath = window.location.pathname;
                
                // Check if we're on a church detail page
                const churchMatch = currentPath.match(/^\\/churches\\/(.+)$/);
                if (churchMatch) {
                  // Find the church ID from the page
                  const churchIdElement = document.querySelector('[data-church-id]');
                  if (churchIdElement) {
                    const churchId = churchIdElement.getAttribute('data-church-id');
                    window.location.href = '/admin/churches/' + churchId + '/edit';
                  }
                  return;
                }
                
                // Check if we're on a county page
                const countyMatch = currentPath.match(/^\\/counties\\/(.+)$/);
                if (countyMatch) {
                  // Find the county ID from the page
                  const countyIdElement = document.querySelector('[data-county-id]');
                  if (countyIdElement) {
                    const countyId = countyIdElement.getAttribute('data-county-id');
                    window.location.href = '/admin/counties/' + countyId + '/edit';
                  }
                }
              }
            });
          });
        `,
      }}
    />
  );
};