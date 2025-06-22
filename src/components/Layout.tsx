import { FC } from 'hono/jsx';

type LayoutProps = {
  title?: string;
  children: any;
};

export const Layout: FC<LayoutProps> = ({ title = 'Utah Churches', children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a202c;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
          }
          
          /* Header styles */
          .site-header {
            text-align: center;
            padding: 3rem 0 2rem;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 3rem;
          }
          
          .site-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 0.5rem;
            letter-spacing: -0.025em;
          }
          
          .site-tagline {
            font-size: 1.125rem;
            color: #718096;
            font-weight: 400;
          }
          
          /* County grid styles */
          .counties-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 4rem;
          }
          
          .county-card {
            display: block;
            padding: 1.25rem;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
            text-align: center;
          }
          
          .county-card:hover {
            border-color: #cbd5e0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transform: translateY(-2px);
          }
          
          .county-name {
            font-size: 1.125rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.25rem;
          }
          
          .church-count {
            font-size: 0.875rem;
            color: #718096;
          }
          
          /* Map card special styling */
          .map-card {
            background-color: #f7fafc;
            border-color: #4299e1;
          }
          
          .map-card:hover {
            background-color: #edf2f7;
            border-color: #3182ce;
          }
          
          .map-card .county-name {
            color: #2b6cb0;
          }
          
          /* Church grid and card styles */
          .church-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 4rem;
          }
          
          .church-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            padding: 1.5rem;
            transition: all 0.2s;
          }
          
          .church-card:hover {
            border-color: #cbd5e0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          
          .church-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.75rem;
            line-height: 1.25;
          }
          
          .church-info {
            color: #718096;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: flex-start;
            line-height: 1.5;
          }
          
          .church-info span:first-child {
            margin-right: 0.5rem;
            flex-shrink: 0;
          }
          
          .church-info a {
            color: #4299e1;
            text-decoration: none;
          }
          
          .church-info a:hover {
            text-decoration: underline;
          }
          
          .status-badge {
            display: inline-block;
            padding: 0.25rem 0.625rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 500;
            margin-top: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }
          
          .status-listed {
            background-color: #c6f6d5;
            color: #22543d;
          }
          
          .status-ready {
            background-color: #bee3f8;
            color: #2c5282;
          }
          
          .status-assess {
            background-color: #fefcbf;
            color: #744210;
          }
          
          .status-needs-data {
            background-color: #fed7d7;
            color: #742a2a;
          }
          
          .status-unlisted {
            background-color: #e2e8f0;
            color: #2d3748;
          }
          
          .status-heretical {
            background-color: #742a2a;
            color: white;
          }
          
          .status-closed {
            background-color: #4a5568;
            color: white;
          }
          
          /* Form styles */
          .form-group {
            margin-bottom: 1.5rem;
          }
          
          .label {
            display: block;
            font-weight: 500;
            margin-bottom: 0.5rem;
            color: #374151;
          }
          
          .input, .select, .textarea {
            display: block;
            width: 100%;
            padding: 0.5rem 0.75rem;
            font-size: 1rem;
            line-height: 1.5;
            color: #374151;
            background-color: white;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
          }
          
          .input:focus, .select:focus, .textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .button {
            display: inline-block;
            padding: 0.5rem 1rem;
            font-size: 1rem;
            font-weight: 500;
            color: white;
            background-color: #3b82f6;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            transition: background-color 0.15s ease-in-out;
          }
          
          .button:hover {
            background-color: #2563eb;
          }
          
          .error {
            color: #dc2626;
            font-size: 0.875rem;
            margin-top: 0.25rem;
          }
          
          /* Admin table styles */
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .table-header {
            background-color: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .table th {
            padding: 0.75rem 1rem;
            text-align: left;
            font-weight: 600;
            color: #374151;
            font-size: 0.875rem;
            text-transform: uppercase;
          }
          
          .table-row {
            border-bottom: 1px solid #e5e7eb;
          }
          
          .table-row:hover {
            background-color: #f9fafb;
          }
          
          .table td {
            padding: 0.75rem 1rem;
            color: #6b7280;
          }
          
          .admin-badge {
            background-color: #dbeafe;
            color: #1e40af;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            font-weight: 500;
          }
          
          .contributor-badge {
            background-color: #f3f4f6;
            color: #4b5563;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            font-weight: 500;
          }
          
          .edit-button {
            background-color: #3b82f6;
            color: white;
            padding: 0.375rem 0.75rem;
            border: none;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            cursor: pointer;
            margin-right: 0.5rem;
          }
          
          .edit-button:hover {
            background-color: #2563eb;
          }
          
          .delete-button {
            background-color: #ef4444;
            color: white;
            padding: 0.375rem 0.75rem;
            border: none;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            cursor: pointer;
          }
          
          .delete-button:hover {
            background-color: #dc2626;
          }
          
          .add-button {
            background-color: #10b981;
            color: white;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 1rem;
          }
          
          .add-button:hover {
            background-color: #059669;
          }
        `}</style>
      </head>
      <body>
        <div class="container">
          {children}
        </div>
      </body>
    </html>
  );
};